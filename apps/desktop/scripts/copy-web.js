const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "web", "out");
const dest = path.join(__dirname, "..", "renderer");

if (!fs.existsSync(src)) {
  console.error(`${src} does not exist — run "npm run build -w @simplekasten/web" first.`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
