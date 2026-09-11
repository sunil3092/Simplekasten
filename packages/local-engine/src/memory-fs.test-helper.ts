import type { FileSystemAdapter } from "./types";

/** In-memory FileSystemAdapter for tests — no real disk I/O. */
export function createMemoryFs(): FileSystemAdapter {
  const files = new Map<string, string>();

  return {
    async listFiles(dir: string) {
      const prefix = `${dir}/`;
      const names: string[] = [];
      for (const path of files.keys()) {
        if (path.startsWith(prefix) && !path.slice(prefix.length).includes("/")) {
          names.push(path.slice(prefix.length));
        }
      }
      return names;
    },
    async readFile(path: string) {
      const contents = files.get(path);
      if (contents === undefined) throw new Error(`ENOENT: ${path}`);
      return contents;
    },
    async writeFile(path: string, contents: string) {
      files.set(path, contents);
    },
    async deleteFile(path: string) {
      files.delete(path);
    },
    async exists(path: string) {
      return files.has(path);
    },
    async ensureDir() {
      // No directory entries in this in-memory model — writes just work.
    },
  };
}
