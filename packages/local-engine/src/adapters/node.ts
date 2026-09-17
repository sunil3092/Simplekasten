import fs from "node:fs";
import path from "node:path";
import type { FileSystemAdapter } from "../types";

/**
 * Node `fs`-backed implementation of `FileSystemAdapter` — every path the
 * engine passes in is relative to `vaultRoot`, resolved here against the
 * actual vault folder on disk. Runs in Electron's main process; the
 * renderer never touches `fs` directly (see apps/desktop/preload.js).
 */
export function createNodeFsAdapter(vaultRoot: string): FileSystemAdapter {
  const resolve = (relativePath: string) => path.join(vaultRoot, relativePath);

  return {
    async listFiles(dir) {
      const full = resolve(dir);
      if (!fs.existsSync(full)) return [];
      return fs.readdirSync(full).filter((name) => fs.statSync(path.join(full, name)).isFile());
    },
    async readFile(filePath) {
      return fs.readFileSync(resolve(filePath), "utf8");
    },
    async writeFile(filePath, contents) {
      const full = resolve(filePath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents, "utf8");
    },
    async deleteFile(filePath) {
      fs.rmSync(resolve(filePath), { force: true });
    },
    async exists(filePath) {
      return fs.existsSync(resolve(filePath));
    },
    async ensureDir(dir) {
      fs.mkdirSync(resolve(dir), { recursive: true });
    },
    async copyFile(sourcePath, destPath) {
      const full = resolve(destPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.copyFileSync(sourcePath, full);
    },
    resolvePath(relativePath) {
      return resolve(relativePath);
    },
  };
}
