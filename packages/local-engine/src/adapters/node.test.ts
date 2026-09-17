import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createNodeFsAdapter } from "./node";

describe("createNodeFsAdapter", () => {
  let vaultRoot: string;

  beforeEach(() => {
    vaultRoot = fs.mkdtempSync(path.join(os.tmpdir(), "simplekasten-vault-"));
  });

  afterEach(() => {
    fs.rmSync(vaultRoot, { recursive: true, force: true });
  });

  it("writes then reads a file, creating parent directories as needed", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);

    await adapter.writeFile("notes/abc.md", "hello");

    expect(await adapter.readFile("notes/abc.md")).toBe("hello");
    expect(fs.existsSync(path.join(vaultRoot, "notes", "abc.md"))).toBe(true);
  });

  it("lists only files, not subdirectories, and returns [] for a missing dir", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");
    await adapter.writeFile("notes/b.md", "b");
    await adapter.ensureDir("notes/nested");

    expect((await adapter.listFiles("notes")).sort()).toEqual(["a.md", "b.md"]);
    expect(await adapter.listFiles("missing")).toEqual([]);
  });

  it("deletes a file and reports existence correctly", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");

    expect(await adapter.exists("notes/a.md")).toBe(true);
    await adapter.deleteFile("notes/a.md");
    expect(await adapter.exists("notes/a.md")).toBe(false);
  });

  it("copies a file from an arbitrary source path into the vault, creating parent directories", async () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    const sourcePath = path.join(os.tmpdir(), `simplekasten-source-${Date.now()}.jpg`);
    fs.writeFileSync(sourcePath, "fake-image-bytes");

    await adapter.copyFile(sourcePath, "attachments/photo.jpg");

    expect(await adapter.readFile("attachments/photo.jpg")).toBe("fake-image-bytes");
    fs.rmSync(sourcePath, { force: true });
  });

  it("resolves a vault-relative path to an absolute path", () => {
    const adapter = createNodeFsAdapter(vaultRoot);
    expect(adapter.resolvePath("notes/abc.md")).toBe(path.join(vaultRoot, "notes", "abc.md"));
  });
});
