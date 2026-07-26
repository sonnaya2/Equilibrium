/**
 * Variant A: clean cutout of Equilibrium T1 relic hex icons.
 * Edge-seeded chroma flood: mint/teal field + black side bars -> transparent.
 * Soft ~1px edge, tight trim, center on square canvas.
 *
 * Usage: node scripts/_relic_filter_a_cutout.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "assets/leagues/equilibrium/relics/raw");
const OUT_DIR = path.join(ROOT, "assets/leagues/equilibrium/relics/variants/a-cutout");

const NAMES = ["survivalist", "endless-harvest", "golden-touch"];
const CANVAS = 256;

/**
 * Mint field is cyan-teal (B well above R, modest G-B).
 * Hex face is yellow-green (lower B-R ~48) so it stays opaque.
 */
const MINT_G_MIN = 100;
const MINT_BR_MIN = 55; // B - R
const MINT_GB_MAX = 45; // G - B
const NEAR_BLACK = 28;
const SOFT_RADIUS = 1;

function isMintOrBar(r, g, b, a) {
  if (a < 16) return true;
  if (r <= NEAR_BLACK && g <= NEAR_BLACK && b <= NEAR_BLACK) return true;
  if (g >= MINT_G_MIN && b - r >= MINT_BR_MIN && g - b <= MINT_GB_MAX) return true;
  return false;
}

/** Edge-seeded flood: only expand through mint/bar pixels (no free color walk). */
function floodBackground(data, w, h) {
  const bg = new Uint8Array(w * h);
  const stack = [];

  const mark = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (bg[idx]) return;
    bg[idx] = 1;
    stack.push(x, y);
  };

  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      if (isMintOrBar(data[i], data[i + 1], data[i + 2], data[i + 3])) mark(x, y);
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      if (isMintOrBar(data[i], data[i + 1], data[i + 2], data[i + 3])) mark(x, y);
    }
  }

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    const neigh = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (bg[ny * w + nx]) continue;
      const ni = (ny * w + nx) * 4;
      if (isMintOrBar(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) mark(nx, ny);
    }
  }
  return bg;
}

function dilate(mask, w, h, radius) {
  if (radius <= 0) return mask;
  let cur = mask;
  for (let pass = 0; pass < radius; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let on = 0;
        for (let dy = -1; dy <= 1 && !on; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (cur[ny * w + nx]) {
              on = 1;
              break;
            }
          }
        }
        next[y * w + x] = on;
      }
    }
    cur = next;
  }
  return cur;
}

function erode(mask, w, h, radius) {
  if (radius <= 0) return mask;
  let cur = mask;
  for (let pass = 0; pass < radius; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let on = 1;
        for (let dy = -1; dy <= 1 && on; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
              on = 0;
              break;
            }
            if (!cur[ny * w + nx]) {
              on = 0;
              break;
            }
          }
        }
        next[y * w + x] = on;
      }
    }
    cur = next;
  }
  return cur;
}

/** Soft alpha: opaque core after 1px erode, half-alpha ring on FG perimeter. */
function softAlpha(fgMask, w, h) {
  const core = erode(fgMask, w, h, SOFT_RADIUS);
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (core[i]) alpha[i] = 255;
    else if (fgMask[i]) alpha[i] = 140;
    else alpha[i] = 0;
  }
  return alpha;
}

function fgBBox(fgMask, w, h) {
  let minx = w;
  let miny = h;
  let maxx = -1;
  let maxy = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!fgMask[y * w + x]) continue;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
    }
  }
  if (maxx < 0) return null;
  return { minx, miny, maxx, maxy, bw: maxx - minx + 1, bh: maxy - miny + 1 };
}

async function processOne(name) {
  const srcPath = path.join(RAW_DIR, `${name}.png`);
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  const bg = floodBackground(data, w, h);
  const fgMask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) fgMask[i] = bg[i] ? 0 : 1;

  // Close 1px holes, then soft edge.
  const closed = erode(dilate(fgMask, w, h, 1), w, h, 1);
  const alpha = softAlpha(closed, w, h);

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const si = i * 4;
    out[si] = data[si];
    out[si + 1] = data[si + 1];
    out[si + 2] = data[si + 2];
    out[si + 3] = alpha[i];
  }

  const bbox = fgBBox(closed, w, h);
  if (!bbox) throw new Error(`${name}: empty foreground after cutout`);

  const pad = 2;
  const left = Math.max(0, bbox.minx - pad);
  const top = Math.max(0, bbox.miny - pad);
  const right = Math.min(w - 1, bbox.maxx + pad);
  const bottom = Math.min(h - 1, bbox.maxy + pad);
  const cw = right - left + 1;
  const ch = bottom - top + 1;

  const cropped = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((top + y) * w + (left + x)) * 4;
      const di = (y * cw + x) * 4;
      cropped[di] = out[si];
      cropped[di + 1] = out[si + 1];
      cropped[di + 2] = out[si + 2];
      cropped[di + 3] = out[si + 3];
    }
  }

  const margin = Math.round(CANVAS * 0.06);
  const fit = CANVAS - margin * 2;
  const scale = Math.min(fit / cw, fit / ch);
  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));
  const ox = Math.floor((CANVAS - nw) / 2);
  const oy = Math.floor((CANVAS - nh) / 2);

  const resized = await sharp(cropped, { raw: { width: cw, height: ch, channels: 4 } })
    .resize(nw, nh, { kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 0.55, m1: 0.4, m2: 0.25 })
    .raw()
    .toBuffer();

  const canvas = Buffer.alloc(CANVAS * CANVAS * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const si = (y * nw + x) * 4;
      const di = ((oy + y) * CANVAS + (ox + x)) * 4;
      canvas[di] = resized[si];
      canvas[di + 1] = resized[si + 1];
      canvas[di + 2] = resized[si + 2];
      canvas[di + 3] = resized[si + 3];
    }
  }

  const outPath = path.join(OUT_DIR, `${name}.png`);
  await sharp(canvas, { raw: { width: CANVAS, height: CANVAS, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  let fgPx = 0;
  for (let i = 0; i < w * h; i++) if (closed[i]) fgPx++;

  return {
    name,
    outPath,
    bytes: stat.size,
    src: `${w}x${h}`,
    bbox: `${bbox.bw}x${bbox.bh}`,
    fgPx,
    canvas: CANVAS,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Drop any prior debug dumps from tuning.
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.startsWith("_debug_")) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const results = [];
  for (const name of NAMES) {
    const r = await processOne(name);
    results.push(r);
    console.log(
      `[OK] ${r.name}: ${r.bytes} bytes  src=${r.src}  bbox=${r.bbox}  fgPx=${r.fgPx}  -> ${path.relative(ROOT, r.outPath)}`,
    );
  }

  const notes = `# Variant A — clean cutout

One-shot processor: \`scripts/_relic_filter_a_cutout.mjs\`

## Method
1. **Edge-seeded flood fill** through mint/teal background + pure black side bars only.
2. Mint key (not free color-walk): \`G >= ${MINT_G_MIN}\` and \`B-R >= ${MINT_BR_MIN}\` and \`G-B <= ${MINT_GB_MAX}\`.
   - Outer field is cyan-teal (high B relative to R).
   - Hex face is yellow-green (B-R ~48) so the flood stops at the gem silhouette.
3. Near-black (\`RGB <= ${NEAR_BLACK}\`) and pre-existing transparent pixels always count as background.
4. 1px morphological close on FG, then **soft alpha**: full opaque core (1px erode) + half-alpha ring (~1px AA).
5. Tight trim (+2px pad), center on **${CANVAS}x${CANVAS}** with ~6% margin.
6. Mild unsharp only (\`sigma 0.55\`) — no color grade.

## Thresholds
| Param | Value | Role |
|---|---|---|
| \`MINT_G_MIN\` | ${MINT_G_MIN} | Min green for mint field |
| \`MINT_BR_MIN\` | ${MINT_BR_MIN} | Min B-R (cyan bias vs yellow-green hex face) |
| \`MINT_GB_MAX\` | ${MINT_GB_MAX} | Max G-B (reject yellow-green face) |
| Near-black | R,G,B <= ${NEAR_BLACK} | Side bars |
| Soft edge | 1px half-alpha ring | Anti-alias silhouette |
| Canvas | ${CANVAS} | Square export |

## Outputs
${results.map((r) => `- \`${r.name}.png\` — ${r.bytes} bytes (src ${r.src}, fg bbox ${r.bbox}, fgPx ${r.fgPx})`).join("\n")}

## Edge quality
- Hex silhouette tracks the official gem outline (bevel preserved).
- Soft ring reduces stair-steps after downscale to 256.
- Coin highlight on golden-touch stays fully opaque (not mint-keyed).

## Risks
- Thresholds tuned on these three T1 wiki rasters; other relics may need a re-sweep if art shifts.
- Not a geometric hex clip — pure pixel chroma + connectivity on the official wiki PNG.
- Very soft outer gradients or a future icon with mint-like face chroma could nibble the rim
  (\`MINT_BR_MIN\` too low) or leave mint halo (\`MINT_BR_MIN\` too high).
- Do not ship into Build UI until all seven T1 relics are batch-checked.

Generated by variant A cutout script.
`;

  fs.writeFileSync(path.join(OUT_DIR, "NOTES.md"), notes, "utf8");
  console.log(`[OK] NOTES.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
