// Renders every app icon from the SVG sources in assets/icon/ — edit those,
// then run `npm run build:icons`. Outputs are committed, so builds don't need
// this step; it only has to be re-run when the artwork changes.
//
//   mark.svg        full mark (two linked slips), transparent 512x512
//   mark-small.svg  the same mark simplified for 32px and below
//   mark-mono.svg   single-colour outline for Android themed icons
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (name) => readFileSync(join(root, "assets/icon", name));
const out = (path) => join(root, path);

// Memphis purple — the tile behind the mark everywhere it has a background.
const TILE = "#672394";

const mark = src("mark.svg");
const markSmall = src("mark-small.svg");
const markMono = src("mark-mono.svg");

/** The mark (scaled to `scale` of the canvas) centred on a `size` canvas. */
async function render(svg, size, { scale = 1, background = null } = {}) {
  const inner = Math.round(size * scale);
  // Rasterise at the target size (not scaled down from 512) so thin strokes stay sharp.
  const art = await sharp(svg, { density: Math.max(72, (72 * inner) / 512) })
    .resize(inner, inner)
    .png()
    .toBuffer();
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: art, left: offset, top: offset }])
    .png()
    .toBuffer();
}

/** The app icon proper: the mark on the purple tile. Small sizes use the simplified mark. */
const tile = (size) => render(size <= 32 ? markSmall : mark, size, { background: TILE, scale: size <= 32 ? 1 : 0.94 });

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

async function main() {
  // ---- Desktop (electron-builder: win .ico, mac .icns, linux .png) --------
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  writeFileSync(out("apps/desktop/icons/icon.ico"), buildIco(await Promise.all(icoSizes.map(async (size) => ({ size, data: await tile(size) })))));

  const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
  writeFileSync(out("apps/desktop/icons/icon.icns"), buildIcns(await Promise.all(icnsSizes.map(async (size) => ({ size, data: await tile(size) })))));

  writeFileSync(out("apps/desktop/icons/icon.png"), await tile(512));

  // ---- Mobile (Expo) ------------------------------------------------------
  const images = "apps/mobile/assets/images";
  // iOS masks its own rounded corners, so the tile goes full-bleed.
  writeFileSync(out(`${images}/icon.png`), await tile(1024));
  // Android adaptive icon: the launcher crops the layers to a shape that can
  // be as small as the central 66% circle, so the mark sits well inside it.
  writeFileSync(out(`${images}/android-icon-foreground.png`), await render(mark, 1024, { scale: 0.68 }));
  writeFileSync(out(`${images}/android-icon-background.png`), await render(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'), 1024, { background: TILE }));
  writeFileSync(out(`${images}/android-icon-monochrome.png`), await render(markMono, 1024, { scale: 0.68 }));
  writeFileSync(out(`${images}/splash-icon.png`), await render(mark, 1024));
  writeFileSync(out(`${images}/favicon.png`), await tile(48));

  console.log("Icons written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
