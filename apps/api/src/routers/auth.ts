import { loginInput } from "@simplekasten/core";
import { prisma } from "@simplekasten/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
} from "../auth";
import { publicProcedure, router } from "../trpc";

async function issueTokens(userId: string) {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { accessToken: signAccessToken(userId), refreshToken, userId };
}

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

      return issueTokens(user.id);
    }),

  login: publicProcedure.input(loginInput).mutation(async ({ input }) => {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
    }

    return issueTokens(user.id);
  }),

  // Called automatically by the client when an access token has expired.
  // Rotates the refresh token on every use: the old one is revoked and a new
  // one issued, so a stolen-but-unused token has a single-use window.
  refresh: publicProcedure.input(z.object({ refreshToken: z.string() })).mutation(async ({ input }) => {
    const tokenHash = hashRefreshToken(input.refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired, please log in again." });
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueTokens(stored.userId);
  }),

  logout: publicProcedure.input(z.object({ refreshToken: z.string() })).mutation(async ({ input }) => {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(input.refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }),
});
