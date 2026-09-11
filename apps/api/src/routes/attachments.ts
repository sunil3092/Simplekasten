import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import { prisma } from "@vaultvista/db";
import { attachmentFilePath } from "../attachments";
import { authMiddleware, asyncHandler, AuthRequest } from "../middleware";
import { Errors } from "../errors";

const router: Router = Router();
router.use(authMiddleware);

async function assertOwnsNote(noteId: string, userId: string) {
  const note = await prisma.note.findFirst({
    where: { id: noteId, deletedAt: null, knowledgeBase: { ownerId: userId } },
  });
  if (!note) throw Errors.notFound("Note");
  return note;
}

// GET /api/attachments?noteId=...
router.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const { noteId } = z.object({ noteId: z.string() }).parse(req.query);

    await assertOwnsNote(noteId, req.userId!);

    const attachments = await prisma.attachment.findMany({
      where: { noteId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        kind: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });

    res.json(attachments);
  }),
);

// DELETE /api/attachments/:id
router.delete(
  "/:id",
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);

    const attachment = await prisma.attachment.findFirst({
      where: {
        id,
        note: { deletedAt: null, knowledgeBase: { ownerId: req.userId! } },
      },
    });

    if (!attachment) throw Errors.notFound("Attachment");

    await prisma.attachment.delete({ where: { id: attachment.id } });
    fs.unlink(attachmentFilePath(attachment.filename), () => {});

    res.json({ id: attachment.id });
  }),
);

export default router;
