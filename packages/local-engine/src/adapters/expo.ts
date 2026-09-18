// expo-file-system's default "." export (SDK 54+) only re-exports the new
// Paths/File/Directory API plus deprecated stubs of the old async functions
// that throw at runtime — the real implementations, documentDirectory
// included, now live under the /legacy subpath.
import * as FileSystem from "expo-file-system/legacy";
import type { FileSystemAdapter } from "../types";

/**
 * `expo-file-system`-backed implementation of `FileSystemAdapter`, mirroring
 * `adapters/node.ts` but for React Native. `vaultRoot` is an absolute
 * `file://` URI with no trailing slash (e.g. `${FileSystem.documentDirectory}vault`,
 * noting `documentDirectory` already ends in `/`) — every path passed in is
 * relative to it.
 */
export function createExpoFsAdapter(vaultRoot: string): FileSystemAdapter {
  const resolve = (relativePath: string) => `${vaultRoot}/${relativePath}`;
  const parentDir = (uri: string) => uri.slice(0, uri.lastIndexOf("/"));

  return {
    async listFiles(dir) {
      const full = resolve(dir);
      const info = await FileSystem.getInfoAsync(full);
      if (!info.exists) return [];

      const names = await FileSystem.readDirectoryAsync(full);
      const files: string[] = [];
      for (const name of names) {
        const childInfo = await FileSystem.getInfoAsync(`${full}/${name}`);
        if (childInfo.exists && !childInfo.isDirectory) files.push(name);
      }
      return files;
    },
    async readFile(filePath) {
      return FileSystem.readAsStringAsync(resolve(filePath));
    },
    async writeFile(filePath, contents) {
      const full = resolve(filePath);
      await FileSystem.makeDirectoryAsync(parentDir(full), { intermediates: true });
      await FileSystem.writeAsStringAsync(full, contents);
    },
    async deleteFile(filePath) {
      await FileSystem.deleteAsync(resolve(filePath), { idempotent: true });
    },
    async exists(filePath) {
      const info = await FileSystem.getInfoAsync(resolve(filePath));
      return info.exists;
    },
    async ensureDir(dir) {
      await FileSystem.makeDirectoryAsync(resolve(dir), { intermediates: true });
    },
    async copyFile(sourcePath, destPath) {
      const full = resolve(destPath);
      await FileSystem.makeDirectoryAsync(parentDir(full), { intermediates: true });
      await FileSystem.copyAsync({ from: sourcePath, to: full });
    },
    resolvePath(relativePath) {
      return resolve(relativePath);
    },
  };
}
