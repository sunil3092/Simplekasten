import { beforeEach, describe, expect, it, vi } from "vitest";

const { files, dirs } = vi.hoisted(() => ({
  files: new Map<string, string>(),
  dirs: new Set<string>(),
}));

vi.mock("expo-file-system/legacy", () => ({
  getInfoAsync: vi.fn(async (uri: string) => {
    if (files.has(uri)) return { exists: true, isDirectory: false, uri };
    if (dirs.has(uri)) return { exists: true, isDirectory: true, uri };
    return { exists: false, isDirectory: false, uri };
  }),
  readDirectoryAsync: vi.fn(async (uri: string) => {
    const prefix = `${uri}/`;
    const names = new Set<string>();
    for (const path of [...files.keys(), ...dirs.keys()]) {
      if (path.startsWith(prefix)) names.add(path.slice(prefix.length).split("/")[0]);
    }
    return [...names];
  }),
  readAsStringAsync: vi.fn(async (uri: string) => {
    const contents = files.get(uri);
    if (contents === undefined) throw new Error(`ENOENT: ${uri}`);
    return contents;
  }),
  writeAsStringAsync: vi.fn(async (uri: string, contents: string) => {
    files.set(uri, contents);
  }),
  deleteAsync: vi.fn(async (uri: string) => {
    files.delete(uri);
  }),
  makeDirectoryAsync: vi.fn(async (uri: string) => {
    dirs.add(uri);
  }),
  copyAsync: vi.fn(async ({ from, to }: { from: string; to: string }) => {
    const contents = files.get(from);
    if (contents === undefined) throw new Error(`ENOENT: ${from}`);
    files.set(to, contents);
  }),
}));

import { createExpoFsAdapter } from "./expo";

describe("createExpoFsAdapter", () => {
  const vaultRoot = "file:///vault";

  beforeEach(() => {
    files.clear();
    dirs.clear();
  });

  it("writes then reads a file, creating parent directories as needed", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);

    await adapter.writeFile("notes/abc.md", "hello");

    expect(await adapter.readFile("notes/abc.md")).toBe("hello");
    expect(dirs.has(`${vaultRoot}/notes`)).toBe(true);
  });

  it("lists only files, not subdirectories, and returns [] for a missing dir", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");
    await adapter.writeFile("notes/b.md", "b");
    await adapter.ensureDir("notes/nested");

    expect((await adapter.listFiles("notes")).sort()).toEqual(["a.md", "b.md"]);
    expect(await adapter.listFiles("missing")).toEqual([]);
  });

  it("deletes a file and reports existence correctly", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    await adapter.writeFile("notes/a.md", "a");

    expect(await adapter.exists("notes/a.md")).toBe(true);
    await adapter.deleteFile("notes/a.md");
    expect(await adapter.exists("notes/a.md")).toBe(false);
  });

  it("copies a file from an arbitrary source URI into the vault, creating parent directories", async () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    files.set("file:///picker/photo.jpg", "fake-image-bytes");

    await adapter.copyFile("file:///picker/photo.jpg", "attachments/photo.jpg");

    expect(await adapter.readFile("attachments/photo.jpg")).toBe("fake-image-bytes");
    expect(dirs.has(`${vaultRoot}/attachments`)).toBe(true);
  });

  it("resolves a vault-relative path to an absolute URI", () => {
    const adapter = createExpoFsAdapter(vaultRoot);
    expect(adapter.resolvePath("notes/abc.md")).toBe(`${vaultRoot}/notes/abc.md`);
  });
});
