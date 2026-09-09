import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { registerUser } from "./test-helpers";

const app = createApp();

// A minimal valid 1x1 PNG — real image bytes, not just a mislabeled buffer,
// in case a future change starts sniffing content rather than trusting the
// declared mimetype.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function uploadFile(noteId: string, token: string, buffer: Buffer, filename: string, contentType: string) {
  return request(app)
    .post(`/attachments/${noteId}`)
    .set("Authorization", `Bearer ${token}`)
    .attach("file", buffer, { filename, contentType });
}

describe("POST /attachments/:noteId", () => {
  it("rejects a request with no token", async () => {
    const res = await request(app).post("/attachments/whatever").attach("file", PNG_1PX, "x.png");
    expect(res.status).toBe(401);
  });

  it("rejects a note the caller doesn't own", async () => {
    const alice = await registerUser("attach-owns-a");
    const bob = await registerUser("attach-owns-b");
    const note = await alice.caller.note.create({ kbId: alice.kb.id, title: "Private", content: "", type: "fleeting" });

    const res = await uploadFile(note.id, bob.accessToken, PNG_1PX, "photo.png", "image/png");
    expect(res.status).toBe(404);
  });

  it("rejects a mimetype that isn't image/* or audio/*", async () => {
    const { caller, kb, accessToken } = await registerUser("attach-badtype");
    const note = await caller.note.create({ kbId: kb.id, title: "Note", content: "", type: "fleeting" });

    const res = await uploadFile(note.id, accessToken, Buffer.from("hi"), "notes.txt", "text/plain");
    expect(res.status).toBe(400);
  });

  it("uploads a photo, and it's fetchable and listed on the note", async () => {
    const { caller, kb, accessToken } = await registerUser("attach-photo");
    const note = await caller.note.create({ kbId: kb.id, title: "Note", content: "", type: "fleeting" });

    const uploadRes = await uploadFile(note.id, accessToken, PNG_1PX, "photo.png", "image/png");
    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body).toMatchObject({ kind: "photo", mimeType: "image/png", size: PNG_1PX.length });

    const fileRes = await request(app)
      .get(`/attachments/file/${uploadRes.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers["content-type"]).toBe("image/png");
    expect((fileRes.body as Buffer).equals(PNG_1PX)).toBe(true);

    const list = await caller.attachment.list({ noteId: note.id });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: uploadRes.body.id, kind: "photo" });

    const detail = await caller.note.getById({ id: note.id });
    expect(detail.attachments).toHaveLength(1);
  });

  it("classifies an audio upload as a voice attachment", async () => {
    const { caller, kb, accessToken } = await registerUser("attach-voice");
    const note = await caller.note.create({ kbId: kb.id, title: "Note", content: "", type: "fleeting" });

    const res = await uploadFile(note.id, accessToken, Buffer.from("fake audio bytes"), "memo.m4a", "audio/m4a");
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("voice");
  });

  it("rejects fetching another user's attachment", async () => {
    const alice = await registerUser("attach-fetch-a");
    const bob = await registerUser("attach-fetch-b");
    const note = await alice.caller.note.create({ kbId: alice.kb.id, title: "Note", content: "", type: "fleeting" });
    const uploadRes = await uploadFile(note.id, alice.accessToken, PNG_1PX, "photo.png", "image/png");

    const res = await request(app)
      .get(`/attachments/file/${uploadRes.body.id}`)
      .set("Authorization", `Bearer ${bob.accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe("attachment.delete", () => {
  it("removes the attachment so it no longer lists or fetches", async () => {
    const { caller, kb, accessToken } = await registerUser("attach-delete");
    const note = await caller.note.create({ kbId: kb.id, title: "Note", content: "", type: "fleeting" });
    const uploadRes = await uploadFile(note.id, accessToken, PNG_1PX, "photo.png", "image/png");

    await caller.attachment.delete({ id: uploadRes.body.id });

    expect(await caller.attachment.list({ noteId: note.id })).toHaveLength(0);
    const fileRes = await request(app)
      .get(`/attachments/file/${uploadRes.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(fileRes.status).toBe(404);
  });

  it("rejects deleting an attachment on a note the caller doesn't own", async () => {
    const alice = await registerUser("attach-delete-a");
    const bob = await registerUser("attach-delete-b");
    const note = await alice.caller.note.create({ kbId: alice.kb.id, title: "Note", content: "", type: "fleeting" });
    const uploadRes = await uploadFile(note.id, alice.accessToken, PNG_1PX, "photo.png", "image/png");

    await expect(bob.caller.attachment.delete({ id: uploadRes.body.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
