import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = "15m";
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export interface AccessTokenPayload {
  sub: string; // userId
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies AccessTokenPayload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
