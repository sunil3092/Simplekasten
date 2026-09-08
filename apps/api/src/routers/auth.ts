import { loginInput } from "@vaultvista/core";
import { prisma } from "@vaultvista/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPassword, signAccessToken, verifyPassword } from "../auth";
import { publicProcedure, router } from "../trpc";

export const authRouter = router({
  register: publicProcedure
    .input(loginInput.extend({ displayName: z.string().min(1).max(120) }))
    .mutation(async ({ input }) => {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with that email already exists." });
      }

      const user = await prisma.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash: hashPassword(input.password),
          knowledgeBases: {
            create: { name: "My Vault", slug: "my-vault", isDefault: true },
          },
        },
      });

      return { accessToken: signAccessToken(user.id), userId: user.id };
    }),

  login: publicProcedure.input(loginInput).mutation(async ({ input }) => {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
    }

    return { accessToken: signAccessToken(user.id), userId: user.id };
  }),
});
