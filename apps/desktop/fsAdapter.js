const fs = require("fs");
const path = require("path");

// Node `fs`-backed implementation of @simplekasten/local-engine's
// FileSystemAdapter — every path the engine passes in is relative to the
// vault root, resolved here against the actual vault folder on disk.
function createNodeFsAdapter(vaultRoot) {
  const resolve = (relativePath) => path.join(vaultRoot, relativePath);

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
  };
}

module.exports = { createNodeFsAdapter };
