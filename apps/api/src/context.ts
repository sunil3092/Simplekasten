import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { verifyAccessToken } from "./auth";

export function createContext({ req }: CreateExpressContextOptions) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;

  return {
    userId: payload?.sub ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
