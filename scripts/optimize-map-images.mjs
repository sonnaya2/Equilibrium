/**
 * OPTIONAL destructive recompress of public/map albedo / atlas / field WebPs for GPU bandwidth.
 * UV math uses game bounds, not texel size - surface may shrink.

 *   node scripts/optimize-map-images.mjs
 */
import { existsSync, statSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const MAP = join(ROOT, "public", "map");

const JOBS = [
  {
    file: "world-surface-wiki.webp",
    // 6144² was ~3MB and heavy VRAM; 4096 long edge still crisp on the table.
    maxEdge: 4096,
    quality: 76,
    effort: 5,
  },
  {
    file: "world-3200.webp",
    maxEdge: 3200,
    quality: 78,
    effort: 5,
  },
  {
    file: "world-1600.webp",
    maxEdge: 1600,
    quality: 80,
    effort: 5,
  },
  {
    file: "poi-atlas.webp",
    // Glyph grid - keep readable pins; 2048 long edge is enough for POI discs.
    maxEdge: 2048,
    quality: 82,
    effort: 5,
  },
  {
    // Signed coast / water / relief pack - do NOT resize (FIELD_TEXEL assumes size).
    file: "terrain-field.webp",
    maxEdge: null,
    quality: 90,
    effort: 5,
    nearLossless: false,
  },
];

async function run(job) {
  const path = join(MAP, job.file);
  if (!existsSync(path)) {
    console.log("skip missing", job.file);
    return;
  }
  const before = statSync(path).size;
  const meta = await sharp(path).metadata();
  let pipeline = sharp(path).rotate();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const edge = Math.max(w, h);
  if (job.maxEdge && edge > job.maxEdge) {
    pipeline = pipeline.resize({
      width: job.maxEdge,
      height: job.maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const buf = await pipeline
    .webp({
      quality: job.quality,
      alphaQuality: 100,
      effort: job.effort,
      smartSubsample: true,
    })
    .toBuffer();

  if (buf.length >= before * 0.98 && !(job.maxEdge && edge > job.maxEdge)) {
    console.log(
      `${job.file}: no gain (${(before / 1024).toFixed(0)}KB, ${w}x${h})`,
    );
    return;
  }

  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, buf);
  try {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
    try {
      renameSync(tmp, path);
    } catch {
      writeFileSync(path, buf);
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
  const after = statSync(path).size;
  const m2 = await sharp(path).metadata();
  console.log(
    `${job.file}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB  ${w}x${h} → ${m2.width}x${m2.height}`,
  );
}

for (const job of JOBS) await run(job);
console.log("map images optimized");
