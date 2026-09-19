import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "./app";

const app = createApp();

/** A unique-per-call email so tests never collide on the shared test database. */
export function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.test`;
}

class RestError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call(method: "get" | "post" | "delete", path: string, token: string, body?: unknown) {
  const res = await request(app)[method](path).set("Authorization", `Bearer ${token}`).send(body);
  if (res.status >= 400) {
    throw new RestError(res.body.error?.code ?? "UNKNOWN", res.body.error?.message ?? res.text);
  }
  return res.body;
}

/**
 * A thin REST-over-supertest client, shaped like the old tRPC caller it
 * replaced — bypasses nothing (every call is a real HTTP request through
 * the actual Express app, same as production traffic), it's here only so
 * fixture setup in the surviving integration tests reads as one call per
 * step instead of a `request(app).post(...).set(...).send(...)` chain.
 */
function callerFor(token: string) {
  return {
    note: {
      create: (input: { kbId: string; title: string; content: string; type: string }) =>
        call("post", "/api/notes", token, input),
      getById: (input: { id: string }) => call("get", `/api/notes/${input.id}`, token),
      delete: (input: { id: string }) => call("delete", `/api/notes/${input.id}`, token),
    },
    attachment: {
      list: (input: { noteId: string }) => call("get", `/api/attachments?noteId=${input.noteId}`, token),
      delete: (input: { id: string }) => call("delete", `/api/attachments/${input.id}`, token),
    },
  };
}

/** Registers a fresh user (with their auto-created default vault) and returns an authenticated caller for them. */
export async function registerUser(label: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email: uniqueEmail(label), password: "correcthorse-battery-staple", displayName: label });

  const { accessToken, userId } = res.body;
  const vaults = await request(app).get("/api/vaults").set("Authorization", `Bearer ${accessToken}`);

  return { userId, accessToken, caller: callerFor(accessToken), kb: vaults.body[0] };
}
