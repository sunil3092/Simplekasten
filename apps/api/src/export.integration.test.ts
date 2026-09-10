import JSZip from "jszip";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { registerUser } from "./test-helpers";

const app = createApp();

async function fetchZip(url: string, token?: string) {
  const req = request(app).get(url);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return req.buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(chunk));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });
}

describe("GET /export/:kbId", () => {
  it("rejects a request with no token", async () => {
    const res = await request(app).get("/export/whatever");
    expect(res.status).toBe(401);
  });

  it("rejects a vault the caller doesn't own", async () => {
    const alice = await registerUser("export-owns-a");
    const bob = await registerUser("export-owns-b");
    const res = await fetchZip(`/export/${alice.kb.id}`, bob.accessToken);
    expect(res.status).toBe(404);
  });

  it("zips one markdown file per note, with frontmatter and the raw wiki-link/hashtag syntax preserved", async () => {
    const { caller, kb, accessToken } = await registerUser("export-ok");
    await caller.note.create({
      kbId: kb.id,
      title: "Atomicity",
      content: "One idea per note. #zettelkasten",
      type: "permanent",
    });
    await caller.note.create({ kbId: kb.id, title: "Linking Notes", content: "See [[Atomicity]].", type: "fleeting" });

    const res = await fetchZip(`/export/${kb.id}`, accessToken);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/zip");

    const zip = await JSZip.loadAsync(res.body as Buffer);
    const filenames = Object.keys(zip.files);
    expect(filenames).toHaveLength(2);

    const atomicityName = filenames.find((f) => f.includes("atomicity"));
    expect(atomicityName).toBeDefined();
    const content = await zip.files[atomicityName!].async("string");
    expect(content).toContain('title: "Atomicity"');
    expect(content).toContain("type: permanent");
    expect(content).toContain("One idea per note. #zettelkasten");

    const linkingName = filenames.find((f) => f.includes("linking-notes"));
    const linkingContent = await zip.files[linkingName!].async("string");
    expect(linkingContent).toContain("See [[Atomicity]].");
  });

  it("excludes soft-deleted notes", async () => {
    const { caller, kb, accessToken } = await registerUser("export-deleted");
    const note = await caller.note.create({ kbId: kb.id, title: "Gone", content: "", type: "fleeting" });
    await caller.note.delete({ id: note.id });

    const res = await fetchZip(`/export/${kb.id}`, accessToken);
    const zip = await JSZip.loadAsync(res.body as Buffer);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});
