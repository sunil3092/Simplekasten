import { createNoteInput, updateNoteInput } from "@simplekasten/core";
import { Prisma, prisma } from "@simplekasten/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nextZettelId, resolveIncomingLinks, syncOutboundLinks, syncTags } from "../links";
import { protectedProcedure, router } from "../trpc";

async function assertOwnsKb(kbId: string, userId: string) {
  const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, ownerId: userId } });
  if (!kb) throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge base not found." });
}

// ts_headline wraps matches in these sentinel characters instead of HTML, so
// the client can split and highlight them without ever touching
// dangerouslySetInnerHTML on a snippet built from the user's own note text.
const HL_START = "\u0001";
const HL_STOP = "\u0002";

export const noteRouter = router({
  list: protectedProcedure
    .input(z.object({ kbId: z.string(), tag: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertOwnsKb(input.kbId, ctx.userId);
      return prisma.note.findMany({
        where: {
          kbId: input.kbId,
          deletedAt: null,
          tags: input.tag ? { some: { tag: { name: input.tag } } } : undefined,
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, zettelId: true, title: true, type: true, updatedAt: true },
      });
    }),

  search: protectedProcedure
    .input(z.object({ kbId: z.string(), query: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      await assertOwnsKb(input.kbId, ctx.userId);
      return prisma.$queryRaw<
        { id: string; zettelId: string; title: string; type: string; snippet: string }[]
      >(Prisma.sql`
        SELECT id, "zettelId", title, type,
          ts_headline('english', content, plainto_tsquery('english', ${input.query}),
            ${`StartSel=${HL_START}, StopSel=${HL_STOP}, MaxFragments=1, MaxWords=18, MinWords=6`}
          ) AS snippet
        FROM notes
        WHERE "kbId" = ${input.kbId} AND "deletedAt" IS NULL
          AND "searchVector" @@ plainto_tsquery('english', ${input.query})
        ORDER BY ts_rank("searchVector", plainto_tsquery('english', ${input.query})) DESC
        LIMIT 20
      `);
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const note = await prisma.note.findFirst({
      where: { id: input.id, deletedAt: null, knowledgeBase: { ownerId: ctx.userId } },
      include: {
        tags: { include: { tag: true } },
        outboundLinks: {
          include: { targetNote: { select: { id: true, title: true, zettelId: true } } },
        },
        inboundLinks: {
          where: { resolved: true },
          include: { sourceNote: { select: { id: true, title: true, zettelId: true } } },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, kind: true, mimeType: true, size: true, createdAt: true },
        },
      },
    });
    if (!note) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      ...note,
      tagNames: note.tags.map((t) => t.tag.name),
      backlinks: note.inboundLinks.map((link) => ({
        noteId: link.sourceNote!.id,
        title: link.sourceNote!.title,
        zettelId: link.sourceNote!.zettelId,
        context: link.context,
      })),
      // A Map of Content's whole purpose is the curated list of notes it
      // links to — surfaced as "contents" here so the UI can render it as a
      // table of contents rather than making the reader open the editor to
      // see what the note organizes. An unresolved link (no note yet) still
      // appears, just without a noteId to navigate to.
      contents: note.outboundLinks.map((link) => ({
        noteId: link.targetNote?.id ?? null,
        title: link.targetNote?.title ?? link.targetTitle,
        zettelId: link.targetNote?.zettelId ?? null,
        resolved: link.resolved,
      })),
    };
  }),

  create: protectedProcedure.input(createNoteInput).mutation(async ({ ctx, input }) => {
    await assertOwnsKb(input.kbId, ctx.userId);
    const zettelId = await nextZettelId(input.kbId);

    const note = await prisma.note.create({
      data: {
        kbId: input.kbId,
        authorId: ctx.userId,
        zettelId,
        title: input.title,
        content: input.content,
        type: input.type,
      },
    });

    await syncOutboundLinks(note.id, input.kbId, input.content);
    await resolveIncomingLinks(note.id, input.kbId, note.title);
    await syncTags(note.id, input.kbId, input.content);

    return note;
  }),

  update: protectedProcedure.input(updateNoteInput).mutation(async ({ ctx, input }) => {
    const existing = await prisma.note.findFirst({
      where: { id: input.id, deletedAt: null, knowledgeBase: { ownerId: ctx.userId } },
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

    const note = await prisma.note.update({
      where: { id: input.id },
      data: {
        title: input.title,
        content: input.content,
        type: input.type,
      },
    });

    if (input.content !== undefined) {
      await syncOutboundLinks(note.id, note.kbId, note.content);
      await syncTags(note.id, note.kbId, note.content);
    }
    if (input.title !== undefined) {
      await resolveIncomingLinks(note.id, note.kbId, note.title);
    }

    return note;
  }),

  // Nodes + edges for the graph view — every note in the vault, and every
  // resolved link between two notes that both still exist. Unresolved links
  // (pointing at a title with no note yet) have no targetNoteId and so have
  // nothing to draw an edge to.
  graph: protectedProcedure.input(z.object({ kbId: z.string() })).query(async ({ ctx, input }) => {
    await assertOwnsKb(input.kbId, ctx.userId);
    const [notes, links] = await Promise.all([
      prisma.note.findMany({
        where: { kbId: input.kbId, deletedAt: null },
        select: { id: true, title: true, zettelId: true, type: true },
      }),
      prisma.link.findMany({
        where: { sourceNote: { kbId: input.kbId, deletedAt: null }, resolved: true, targetNoteId: { not: null } },
        select: { sourceNoteId: true, targetNoteId: true },
      }),
    ]);

    return {
      nodes: notes,
      edges: links.map((link) => ({ source: link.sourceNoteId, target: link.targetNoteId! })),
    };
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const existing = await prisma.note.findFirst({
      where: { id: input.id, knowledgeBase: { ownerId: ctx.userId } },
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

    await prisma.note.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
    return { id: input.id };
  }),
});
