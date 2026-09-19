import { describe, expect, it } from "vitest";
import type { FileSystemAdapter } from "@simplekasten/local-engine";
import { memphisTheme } from "./builtin";
import { installTheme, listInstalledThemes, removeTheme } from "./storage";

// Minimal in-memory FileSystemAdapter (local-engine's test helper isn't exported).
function memoryFs(): FileSystemAdapter {
  const files = new Map<string, string>();
  return {
    async listFiles(dir) {
      const prefix = `${dir}/`;
      return [...files.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/")).map((p) => p.slice(prefix.length));
    },
    async readFile(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`ENOENT: ${path}`);
      return v;
    },
    async writeFile(path, contents) { files.set(path, contents); },
    async deleteFile(path) { files.delete(path); },
    async exists(path) { return files.has(path); },
    async ensureDir() {},
    async copyFile(s, d) { files.set(d, files.get(s) ?? ""); },
    resolvePath: (p) => p,
  };
}

const custom = { ...memphisTheme, id: "sunset", name: "Sunset" };

describe("theme storage", () => {
  it("installs a valid theme and lists it", async () => {
    const fs = memoryFs();
    const result = await installTheme(fs, JSON.stringify(custom));
    expect(result.ok).toBe(true);
    const listed = await listInstalledThemes(fs);
    expect(listed.themes.map((t) => t.id)).toEqual(["sunset"]);
    expect(listed.skipped).toEqual([]);
  });

  it("rejects a reserved built-in id", async () => {
    const result = await installTheme(memoryFs(), JSON.stringify({ ...custom, id: "memphis" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/built-in/i);
  });

  it("returns validation errors and writes nothing for invalid JSON", async () => {
    const fs = memoryFs();
    const result = await installTheme(fs, "{nope");
    expect(result.ok).toBe(false);
    expect((await listInstalledThemes(fs)).themes).toEqual([]);
  });

  it("overwrites an existing theme with the same id", async () => {
    const fs = memoryFs();
    await installTheme(fs, JSON.stringify(custom));
    await installTheme(fs, JSON.stringify({ ...custom, name: "Sunset v2" }));
    const listed = await listInstalledThemes(fs);
    expect(listed.themes).toHaveLength(1);
    expect(listed.themes[0].name).toBe("Sunset v2");
  });

  it("skips (and reports) invalid files on disk instead of failing", async () => {
    const fs = memoryFs();
    await installTheme(fs, JSON.stringify(custom));
    await fs.writeFile("themes/broken.json", "{oops");
    await fs.writeFile("themes/readme.txt", "ignored");
    const listed = await listInstalledThemes(fs);
    expect(listed.themes.map((t) => t.id)).toEqual(["sunset"]);
    expect(listed.skipped.map((s) => s.file)).toEqual(["broken.json"]);
  });

  it("removes an installed theme and ignores unknown ids", async () => {
    const fs = memoryFs();
    await installTheme(fs, JSON.stringify(custom));
    await removeTheme(fs, "sunset");
    await removeTheme(fs, "never-installed");
    expect((await listInstalledThemes(fs)).themes).toEqual([]);
  });
});
