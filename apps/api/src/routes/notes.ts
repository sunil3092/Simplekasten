import { Router } from "express";
import { z } from "zod";
import { Prisma, prisma } from "@vaultvista/db";
import { createNoteInput, updateNoteInput } from "@vaultvista/core";
import {
  nextZettelId,
  resolveIncomingLinks,
  syncOutboundLinks,
  syncTags,
} from "../links";
import { authMiddleware, asyncHandler, AuthRequest } from "../middleware";
import { Errors } from "../errors";

const router: Router = Router();
router.use(authMiddleware);

const HL_START = "\u0001";
const HL_STOP = "\u0002";

async function assertOwnsKb(kbId: string, userId: string) {
  const kb = await prisma.knowledgeBase.findFirst({
    where: { id: kbId, ownerId: userId },
  });
  if (!kb) throw Errors.notFound("Knowledge base");
}

// GET /api/notes?kbId=...&tag=...
router.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const { kbId, tag } = z
      .object({ kbId: z.string(), tag: z.string().optional() })
      .parse(req.query);

    await assertOwnsKb(kbId, req.userId!);

    const notes = await prisma.note.findMany({
      where: {
        kbId,
        deletedAt: null,
        tags: tag ? { some: { tag: { name: tag } } } : undefined,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        zettelId: true,
        title: true,
        type: true,
        updatedAt: true,
      },
    });

    res.json(notes);
  }),
);

// GET /api/notes/search?kbId=...&query=...
router.get(
  "/search",
  asyncHandler(async (req: AuthRequest, res) => {
    const { kbId, query } = z
      .object({ kbId: z.string(), query: z.string().min(1).max(200) })
      .parse(req.query);

    await assertOwnsKb(kbId, req.userId!);

    const results = await prisma.$queryRaw<
      {
        id: string;
        zettelId: string;
        title: string;
        type: string;
        snippet: string;
      }[]
    >(Prisma.sql`
      SELECT id, "zettelId", title, type,
        ts_headline('english', content, plainto_tsquery('english', ${query}),
          ${`StartSel=${HL_START}, StopSel=${HL_STOP}, MaxFragments=1, MaxWords=18, MinWords=6`}
        ) AS snippet
      FROM notes
      WHERE "kbId" = ${kbId} AND "deletedAt" IS NULL
        AND "searchVector" @@ plainto_tsquery('english', ${query})
      ORDER BY ts_rank("searchVector", plainto_tsquery('english', ${query})) DESC
      LIMIT 20
    `);

    res.json(results);
  }),
);

// GET /api/notes/:id
router.get(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);

    const note = await prisma.note.findFirst({
      where: { id, deletedAt: null, knowledgeBase: { ownerId: req.userId! } },
      include: {
        tags: { include: { tag: true } },
        outboundLinks: {
          include: {
            targetNote: { select: { id: true, title: true, zettelId: true } },
          },
        },
        inboundLinks: {
          where: { resolved: true },
          include: {
            sourceNote: { select: { id: true, title: true, zettelId: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            kind: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
      },
    });

    if (!note) throw Errors.notFound("Note");

    res.json({
      ...note,
      tagNames: note.tags.map((t) => t.tag.name),
      backlinks: note.inboundLinks.map((link) => ({
        noteId: link.sourceNote!.id,
        title: link.sourceNote!.title,
        zettelId: link.sourceNote!.zettelId,
        context: link.context,
      })),
      contents: note.outboundLinks.map((link) => ({
        noteId: link.targetNote?.id ?? null,
        title: link.targetNote?.title ?? link.targetTitle,
        zettelId: link.targetNote?.zettelId ?? null,
        resolved: link.resolved,
      })),
    });
  }),
);

// GET /api/notes/:id/graph
router.get(
  "/:id/graph",
  asyncHandler(async (req: AuthRequest, res) => {
    const { id: kbId } = z.object({ id: z.string() }).parse(req.params);

    await assertOwnsKb(kbId, req.userId!);

    const [notes, links] = await Promise.all([
      prisma.note.findMany({
        where: { kbId, deletedAt: null },
        select: { id: true, title: true, zettelId: true, type: true },
      }),
      prisma.link.findMany({
        where: {
          sourceNote: { kbId, deletedAt: null },
          resolved: true,
          targetNoteId: { not: null },
        },
        select: { sourceNoteId: true, targetNoteId: true },
      }),
    ]);

    res.json({
      nodes: notes,
      edges: links.map((link) => ({
        source: link.sourceNoteId,
        target: link.targetNoteId!,
      })),
    });
  }),
);

// POST /api/notes
router.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const input = createNoteInput.parse(req.body);

    await assertOwnsKb(input.kbId, req.userId!);

    const zettelId = await nextZettelId(input.kbId);

    const note = await prisma.note.create({
      data: {
        kbId: input.kbId,
        authorId: req.userId!,
        zettelId,
        title: input.title,
        content: input.content,
        type: input.type,
      },
    });

    await syncOutboundLinks(note.id, input.kbId, input.content);
    await resolveIncomingLinks(note.id, input.kbId, note.title);
    await syncTags(note.id, input.kbId, input.content);

    res.status(201).json(note);
  }),
);

// PUT /api/notes/:id
router.put(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const input = updateNoteInput.parse(req.body);

    const existing = await prisma.note.findFirst({
      where: { id, deletedAt: null, knowledgeBase: { ownerId: req.userId! } },
    });

    if (!existing) throw Errors.notFound("Note");

    const note = await prisma.note.update({
      where: { id },
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

    res.json(note);
  }),
);

// DELETE /api/notes/:id
router.delete(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);

    const existing = await prisma.note.findFirst({
      where: { id, knowledgeBase: { ownerId: req.userId! } },
    });

    if (!existing) throw Errors.notFound("Note");

    await prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    res.json({ id });
  }),
);

export default router;
