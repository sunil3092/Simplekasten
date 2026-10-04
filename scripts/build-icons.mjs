// Renders every app icon from assets/icon/glyph.svg — a white glyph on an
// emerald gradient tile. Edit the glyph or the constants below, then run
// `npm run build:icons`. Outputs are committed, so builds don't need this
// step; it only has to be re-run when the artwork changes.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (path) => join(root, path);

// The Classic theme's emerald, light to deep, top-left to bottom-right.
const TILE_FROM = "#34d399";
const TILE_TO = "#047857";
// Flat stand-in for the gradient where only one colour is possible (the
// Android adaptive-icon fallback and the mobile splash screen in app.json).
export const TILE_FLAT = "#059669";

// Everything is drawn on a 1024-unit canvas and rasterised at the size needed.
const CANVAS = 1024;

// The glyph file is a 14x14 SVG holding one <path>; only that path is reused.
const glyphPath = readFileSync(join(root, "assets/icon/glyph.svg"), "utf8").match(/<path[^>]*\/>/)[0];

/** The glyph, `scale` of the canvas wide, centred. */
function glyph(scale) {
  const size = CANVAS * scale;
  const offset = (CANVAS - size) / 2;
  return `<svg x="${offset}" y="${offset}" width="${size}" height="${size}" viewBox="0 0 14 14">${glyphPath}</svg>`;
}

/**
 * The gradient tile. `inset` leaves transparent space around it and `radius`
 * rounds its corners, both in canvas units.
 */
function tile({ inset = 0, radius = 0 } = {}) {
  const side = CANVAS - inset * 2;
  return `<defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${TILE_FROM}"/><stop offset="1" stop-color="${TILE_TO}"/></linearGradient></defs>
    <rect x="${inset}" y="${inset}" width="${side}" height="${side}" rx="${radius}" fill="url(#tile)"/>`;
}

const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">${body}</svg>`);

/** Rasterises at the target size (not scaled down from 1024) so edges stay sharp. */
const render = (body, size) =>
  sharp(svg(body), { density: (72 * size) / CANVAS })
    .resize(size, size)
    .png()
    .toBuffer();

// Windows and Linux draw the icon as given: a rounded tile filling the canvas.
// The glyph is a little larger at the smallest sizes, where it would otherwise blur.
const rounded = (size) => render(tile({ radius: 230 }) + glyph(size <= 32 ? 0.62 : 0.54), size);
// macOS expects the tile to sit inside the canvas with room for its shadow
// (Apple's icon grid: an 824-unit rounded square in 1024).
const macTile = (size) => render(tile({ inset: 100, radius: 185 }) + glyph(size <= 32 ? 0.5 : 0.44), size);
// iOS rounds the corners itself, so the tile goes edge to edge.
const fullBleed = (size) => render(tile() + glyph(0.54), size);

// ICO: a directory of PNG-encoded images (supported since Windows Vista).
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette colours
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// ICNS: typed chunks of PNG data. These OSTypes all accept PNG payloads.
const ICNS_TYPES = { 16: "icp4", 32: "icp5", 64: "icp6", 128: "ic07", 256: "ic08", 512: "ic09", 1024: "ic10" };
function buildIcns(images) {
  const chunks = images.map(({ size, data }) => {
    const head = Buffer.alloc(8);
    head.write(ICNS_TYPES[size], 0, "ascii");
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

const sized = (sizes, draw) => Promise.all(sizes.map(async (size) => ({ size, data: await draw(size) })));

async function main() {
  // ---- Desktop (electron-builder: win .ico, mac .icns, linux .png) --------
  writeFileSync(out("apps/desktop/icons/icon.ico"), buildIco(await sized([16, 24, 32, 48, 64, 128, 256], rounded)));
  writeFileSync(out("apps/desktop/icons/icon.icns"), buildIcns(await sized([16, 32, 64, 128, 256, 512, 1024], macTile)));
  writeFileSync(out("apps/desktop/icons/icon.png"), await rounded(512));

  // ---- Mobile (Expo) ------------------------------------------------------
  const images = "apps/mobile/assets/images";
  writeFileSync(out(`${images}/icon.png`), await fullBleed(1024));
  // Android adaptive icon: the launcher crops the layers to a shape that can
  // be as small as the central 66% circle, so the glyph sits well inside it.
  writeFileSync(out(`${images}/android-icon-foreground.png`), await render(glyph(0.4), 1024));
  writeFileSync(out(`${images}/android-icon-background.png`), await render(tile(), 1024));
  // Themed icons use only the alpha channel; the launcher tints it.
  writeFileSync(out(`${images}/android-icon-monochrome.png`), await render(glyph(0.4), 1024));
  // Shown on the flat emerald splash background set in app.json.
  writeFileSync(out(`${images}/splash-icon.png`), await render(glyph(0.72), 1024));
  writeFileSync(out(`${images}/favicon.png`), await rounded(48));

  // ---- README ---------------------------------------------------------------
  writeFileSync(out("assets/icon/icon-preview.png"), await rounded(256));

  console.log("Icons written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
