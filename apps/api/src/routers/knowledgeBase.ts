import { createKnowledgeBaseInput } from "@vaultvista/core";
import { prisma } from "@vaultvista/db";
import { protectedProcedure, router } from "../trpc";

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vault";
}

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
        slug: slugify(input.name),
      },
    }),
  ),
});
