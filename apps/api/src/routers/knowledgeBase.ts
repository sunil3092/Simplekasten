import { createKnowledgeBaseInput, slugify } from "@vaultvista/core";
import { prisma } from "@vaultvista/db";
import { protectedProcedure, router } from "../trpc";

export const knowledgeBaseRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    prisma.knowledgeBase.findMany({
      where: { ownerId: ctx.userId },
      orderBy: { createdAt: "asc" },
    }),
  ),

  create: protectedProcedure.input(createKnowledgeBaseInput).mutation(({ ctx, input }) =>
    prisma.knowledgeBase.create({
      data: {
        ownerId: ctx.userId,
        name: input.name,
        slug: slugify(input.name, "vault"),
      },
    }),
  ),
});
