import { Router } from "express";
import { z } from "zod";
import { prisma } from "@vaultvista/db";
import { loginInput } from "@vaultvista/core";
import {
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
} from "../auth";
import { asyncHandler } from "../middleware";
import { Errors } from "../errors";

const router: Router = Router();

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

// POST /api/auth/register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = loginInput
      .extend({ displayName: z.string().min(1).max(120) })
      .parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw Errors.conflict("An account with that email already exists.");
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

    const tokens = await issueTokens(user.id);
    res.status(201).json(tokens);
  }),
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginInput.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw Errors.unauthorized();
    }

    const tokens = await issueTokens(user.id);
    res.json(tokens);
  }),
);

// POST /api/auth/refresh
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string() })
      .parse(req.body);

    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw Errors.unauthorized();
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await issueTokens(stored.userId);
    res.json(tokens);
  }),
);

// POST /api/auth/logout
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = z
      .object({ refreshToken: z.string() })
      .parse(req.body);

    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.json({ ok: true });
  }),
);

export default router;
