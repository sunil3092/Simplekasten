import { prisma } from "@simplekasten/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

export const tagRouter = router({
  list: protectedProcedure.input(z.object({ kbId: z.string() })).query(async ({ ctx, input }) => {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id: input.kbId, ownerId: ctx.userId } });
    if (!kb) throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge base not found." });

    const tags = await prisma.tag.findMany({
      where: { kbId: input.kbId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { notes: true } } },
    });
    return tags.map((t) => ({ id: t.id, name: t.name, noteCount: t._count.notes }));
  }),
});
