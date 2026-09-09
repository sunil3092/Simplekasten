import fs from "node:fs";
import { prisma } from "@vaultvista/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { attachmentFilePath } from "../attachments";
import { protectedProcedure, router } from "../trpc";

async function assertOwnsNote(noteId: string, userId: string) {
  const note = await prisma.note.findFirst({ where: { id: noteId, deletedAt: null, knowledgeBase: { ownerId: userId } } });
  if (!note) throw new TRPCError({ code: "NOT_FOUND", message: "Note not found." });
  return note;
}

export const attachmentRouter = router({
  list: protectedProcedure.input(z.object({ noteId: z.string() })).query(async ({ ctx, input }) => {
    await assertOwnsNote(input.noteId, ctx.userId);
    return prisma.attachment.findMany({
      where: { noteId: input.noteId },
      orderBy: { createdAt: "asc" },
      select: { id: true, kind: true, mimeType: true, size: true, createdAt: true },
    });
  }),

  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const attachment = await prisma.attachment.findFirst({
      where: { id: input.id, note: { deletedAt: null, knowledgeBase: { ownerId: ctx.userId } } },
    });
    if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });

    await prisma.attachment.delete({ where: { id: attachment.id } });
    fs.unlink(attachmentFilePath(attachment.filename), () => {});

    return { id: attachment.id };
  }),
});
