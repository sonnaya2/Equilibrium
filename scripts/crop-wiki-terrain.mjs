/**
 * Rob RS3 surface look from the wiki world map (already vendored, CC BY-NC-SA 3.0).
 * Crops per-region plates from RuneScape_Worldmap.png using atlas-aligned boxes,
 * grades 14% toward BOARD_MEAN so eleven slabs still read as one table, writes
 * public/game/terrain + assets/rs3/terrain.
 *
 *   node scripts/crop-wiki-terrain.mjs [--size 512]
 *
 * Credit: RuneScape Wiki world map, CC BY-NC-SA 3.0.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SRC = path.join(ROOT, "assets", "rs3", "RuneScape_Worldmap.png");
const OUT_PUBLIC = path.join(ROOT, "public", "game", "terrain");
const OUT_ASSETS = path.join(ROOT, "assets", "rs3", "terrain");
const SIZE = Number(process.argv[process.argv.indexOf("--size") + 1]) || 512;

/** Board mean — same as gen-region-textures (shared grade). */
const BOARD_MEAN = { r: 0x2a, g: 0x23, b: 0x18 };
const GRADE = 0.14;

/**
 * Normalized crop boxes on the wiki world map (x east, y south).
 * Anchored to printed region land on File:RuneScape_Worldmap.png / atlas labels.
 * Boxes are intentionally a bit tight so water/labels don't dominate the plate.
 */
const CROPS = {
  // Mainland spine
  misthalin: { u0: 0.46, v0: 0.52, u1: 0.58, v1: 0.68 },
  asgarnia: { u0: 0.38, v0: 0.48, u1: 0.48, v1: 0.64 },
  kandarin: { u0: 0.18, v0: 0.48, u1: 0.36, v1: 0.68 },
  fremennik: { u0: 0.22, v0: 0.34, u1: 0.40, v1: 0.52 },
  forinthry: { u0: 0.40, v0: 0.28, u1: 0.58, v1: 0.48 },
  morytania: { u0: 0.56, v0: 0.46, u1: 0.72, v1: 0.64 },
  tirannwn: { u0: 0.08, v0: 0.54, u1: 0.22, v1: 0.74 },
  desert: { u0: 0.46, v0: 0.66, u1: 0.62, v1: 0.88 },
  karamja: { u0: 0.32, v0: 0.66, u1: 0.46, v1: 0.82 },
  // Islands / late content
  anachronia: { u0: 0.72, v0: 0.02, u1: 0.92, v1: 0.22 },
  // Havenhythe is new — no plate on classic map; sample SE island shelf / use east coast
  havenhythe: { u0: 0.82, v0: 0.48, u1: 0.98, v1: 0.72 },
};

function gradeTowardBoard(buf) {
  // RGBA buffer
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = Math.round(buf[i] * (1 - GRADE) + BOARD_MEAN.r * GRADE);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - GRADE) + BOARD_MEAN.g * GRADE);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - GRADE) + BOARD_MEAN.b * GRADE);
  }
  return buf;
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Missing world map:", SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_PUBLIC, { recursive: true });
  fs.mkdirSync(OUT_ASSETS, { recursive: true });

  const meta = await sharp(SRC).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log(`source ${W}x${H} → tiles ${SIZE}px, grade ${GRADE}`);

  for (const [id, box] of Object.entries(CROPS)) {
    const left = Math.floor(box.u0 * W);
    const top = Math.floor(box.v0 * H);
    const width = Math.max(8, Math.floor((box.u1 - box.u0) * W));
    const height = Math.max(8, Math.floor((box.v1 - box.v0) * H));

    // Extract, cover-resize to square, mild sharpen for slab scale.
    const { data, info } = await sharp(SRC)
      .extract({ left, top, width, height })
      .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
      .sharpen({ sigma: 0.6 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const graded = gradeTowardBoard(Buffer.from(data));
    const png = await sharp(graded, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(path.join(OUT_PUBLIC, `${id}.png`), png);
    fs.writeFileSync(path.join(OUT_ASSETS, `${id}.png`), png);
    console.log(`[OK] ${id}  crop ${width}x${height} @ ${left},${top}  → ${png.length} B`);
  }

  console.log("credit: RuneScape Wiki world map, CC BY-NC-SA 3.0");
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
