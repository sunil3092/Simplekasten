import { createNoteInput, updateNoteInput } from "@vaultvista/core";
import { prisma } from "@vaultvista/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nextZettelId, resolveIncomingLinks, syncOutboundLinks } from "../links";
import { protectedProcedure, router } from "../trpc";

async function assertOwnsKb(kbId: string, userId: string) {
  const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, ownerId: userId } });
  if (!kb) throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge base not found." });
}

export const noteRouter = router({
  list: protectedProcedure.input(z.object({ kbId: z.string() })).query(async ({ ctx, input }) => {
    await assertOwnsKb(input.kbId, ctx.userId);
    return prisma.note.findMany({
      where: { kbId: input.kbId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, zettelId: true, title: true, type: true, updatedAt: true },
    });
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const note = await prisma.note.findFirst({
      where: { id: input.id, deletedAt: null, knowledgeBase: { ownerId: ctx.userId } },
      include: {
        tags: { include: { tag: true } },
        outboundLinks: true,
        inboundLinks: {
          where: { resolved: true },
          include: { sourceNote: { select: { id: true, title: true, zettelId: true } } },
        },
      },
    });
    if (!note) throw new TRPCError({ code: "NOT_FOUND" });

    return {
      ...note,
      backlinks: note.inboundLinks.map((link) => ({
        noteId: link.sourceNote!.id,
        title: link.sourceNote!.title,
        zettelId: link.sourceNote!.zettelId,
        context: link.context,
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
    }
    if (input.title !== undefined) {
      await resolveIncomingLinks(note.id, note.kbId, note.title);
    }

    return note;
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
