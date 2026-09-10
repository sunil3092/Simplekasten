import { randomUUID } from "node:crypto";
import { appRouter } from "./router";

/**
 * Direct router calls (tRPC's own recommended testing pattern) — bypasses
 * HTTP and JWT verification entirely, since that's already covered by
 * auth.test.ts and the auth.integration.test.ts login/refresh flow. Every
 * other router test cares about authorization logic and Prisma behavior,
 * not the transport.
 */
export function callerAs(userId: string | null) {
  return appRouter.createCaller({ userId });
}

export const anonCaller = callerAs(null);

/** A unique-per-call email so tests never collide on the shared test database. */
export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.test`;
}

/** Registers a fresh user (with their auto-created default vault) and returns an authenticated caller for them. */
export async function registerUser(label: string) {
  const result = await anonCaller.auth.register({
    email: uniqueEmail(label),
    password: "correcthorse-battery-staple",
    displayName: label,
  });
  const caller = callerAs(result.userId);
  const kbs = await caller.knowledgeBase.list();
  return { ...result, caller, kb: kbs[0]! };
}
