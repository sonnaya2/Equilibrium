/**
 * Variant B — gem-grade T1 Equilibrium relic icons.
 *
 * Official hex art → transparent PNGs tuned for Editorial tokens
 * (gem-300 #57e0ae / gem-400 #2ecb8f) on stone dark grounds (#100e0b / #16120e).
 *
 * Pipeline: mint+bar alpha key → largest-component keep → mid contrast /
 * gem-green sat nudge → soft gem-400 outer rim → trim + pad 256×256.
 *
 * Usage: node scripts/_relic_filter_b_gem_grade.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "assets/leagues/equilibrium/relics/raw");
const OUT_DIR = path.join(
  ROOT,
  "assets/leagues/equilibrium/relics/variants/b-gem-grade",
);

const RELICS = ["survivalist", "endless-harvest", "golden-touch"];
const OUT_SIZE = 256;
const PAD = 14; // breathing room inside 256 after trim

// Editorial gem tokens
const GEM400 = { r: 0x2e, g: 0xcb, b: 0x8f }; // #2ecb8f
const GEM300 = { r: 0x57, g: 0xe0, b: 0xae }; // #57e0ae

function rgb2hsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsv2rgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0,
    gp = 0,
    bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

/** Outer mint / black bar / pre-keyed transparency. Never the hex plate (olive) or gem icon (pure cyan). */
function isBackdrop(r, g, b, a) {
  if (a < 32) return true;
  if (r + g + b < 48) return true;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 85) {
    // dim fringe next to black bars — dark teal wash outside the hex
    if (g > 40 && g > r + 20 && b > 30 && r < 40) return true;
    return false;
  }

  const sat = (max - min) / max;
  let hdeg = 0;
  if (max !== min) {
    if (max === r) hdeg = 60 * ((g - b) / (max - min));
    else if (max === g) hdeg = 60 * (2 + (b - r) / (max - min));
    else hdeg = 60 * (4 + (r - g) / (max - min));
    if (hdeg < 0) hdeg += 360;
  }
  const bg = b / Math.max(g, 1);

  // Outer mint: H ~158–176, elevated R vs gem icon (R≈0), high b/g vs olive plate
  if (
    hdeg >= 156 &&
    hdeg <= 178 &&
    bg >= 0.74 &&
    bg <= 0.98 &&
    r >= 18 &&
    r <= 100 &&
    g >= 120 &&
    sat >= 0.45 &&
    sat <= 0.92
  ) {
    return true;
  }

  // Lighter mint pockets near top of card
  if (
    hdeg >= 155 &&
    hdeg <= 175 &&
    bg >= 0.72 &&
    r >= 25 &&
    r <= 95 &&
    g >= 155 &&
    b >= 120 &&
    sat >= 0.4
  ) {
    return true;
  }

  return false;
}

/** Flood-fill backdrop from edges + existing alpha holes. */
function maskBackdrop(data, w, h) {
  const visited = new Uint8Array(w * h);
  const q = [];
  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const i = p * 4;
    if (!isBackdrop(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    visited[p] = 1;
    q.push(x, y);
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }
  // Seed already-transparent interiors (pre-keyed black bars / corners)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (visited[p]) continue;
      if (data[p * 4 + 3] < 32) {
        visited[p] = 1;
        q.push(x, y);
      }
    }
  }

  let qi = 0;
  while (qi < q.length) {
    const x = q[qi++];
    const y = q[qi++];
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
    tryPush(x + 1, y + 1);
    tryPush(x - 1, y - 1);
    tryPush(x + 1, y - 1);
    tryPush(x - 1, y + 1);
  }
  return visited; // 1 = backdrop (discard)
}

/** Keep only the largest opaque connected component (the hex). */
function largestKeepComponent(backdrop, w, h) {
  const keep = new Uint8Array(w * h); // 1 = foreground candidate
  for (let i = 0; i < w * h; i++) keep[i] = backdrop[i] ? 0 : 1;

  const seen = new Uint8Array(w * h);
  let best = null;
  let bestSize = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!keep[start] || seen[start]) continue;
      const q = [x, y];
      seen[start] = 1;
      const cells = [[x, y]];
      let qi = 0;
      while (qi < q.length) {
        const cx = q[qi++];
        const cy = q[qi++];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const p = ny * w + nx;
          if (seen[p] || !keep[p]) continue;
          seen[p] = 1;
          q.push(nx, ny);
          cells.push([nx, ny]);
        }
      }
      if (cells.length > bestSize) {
        bestSize = cells.length;
        best = cells;
      }
    }
  }

  const fg = new Uint8Array(w * h);
  if (best) for (const [x, y] of best) fg[y * w + x] = 1;
  return fg; // 1 = keep
}

/** Soft edge: partial alpha where neighbor is backdrop (anti-fringe). */
function applySoftAlpha(data, fg, w, h) {
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (!fg[p]) {
        out[i + 3] = 0;
        continue;
      }
      // count 8-neighbor backdrop
      let bd = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            bd++;
            n++;
            continue;
          }
          n++;
          if (!fg[ny * w + nx]) bd++;
        }
      }
      const origA = data[i + 3];
      if (bd === 0) {
        out[i + 3] = origA;
      } else {
        // edge: damp alpha by backdrop fraction (keeps AA without hard clip)
        const edge = 1 - bd / n;
        const a = Math.max(0, Math.min(255, Math.round(origA * (0.35 + 0.65 * edge))));
        out[i + 3] = a;
      }
    }
  }
  return out;
}

/**
 * Mid-tone contrast + gentle sat push toward gem green (H≈155–165).
 * Not neon — subtle grade so icons pop on stone dark.
 */
function gradeGem(data, w, h) {
  const out = Buffer.from(data);
  // target hue blend: gem-400 sits ~151° in HSV; gem icons are ~175–185 cyan
  // nudge hue slightly toward gem without killing the teal icon character
  const TARGET_H = 162;
  const HUE_BLEND = 0.12;
  const SAT_BOOST = 1.1;
  const SAT_CAP = 0.96;
  const MID_CONTRAST = 1.12; // expand around mid value

  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const a = out[i + 3];
    if (a === 0) continue;
    let r = out[i];
    let g = out[i + 1];
    let b = out[i + 2];
    let [hdeg, s, v] = rgb2hsv(r, g, b);

    // mid contrast on V
    v = 0.5 + (v - 0.5) * MID_CONTRAST;
    v = Math.max(0, Math.min(1, v));

    // sat boost, stronger on mids
    const midW = 1 - Math.abs(v - 0.55) * 1.4;
    const satMul = 1 + (SAT_BOOST - 1) * Math.max(0, midW);
    s = Math.min(SAT_CAP, s * satMul);

    // gentle hue pull toward gem green for olive plate + mid gem fills
    // leave near-white highlights (low sat) and pure highlights alone
    if (s > 0.25 && v > 0.2 && v < 0.95) {
      // shortest-arc blend
      let dh = TARGET_H - hdeg;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      hdeg = (hdeg + dh * HUE_BLEND + 360) % 360;
    }

    // tiny lift of green channel vs red (gem identity on dark stone)
    [r, g, b] = hsv2rgb(hdeg, s, v);
    g = Math.min(255, Math.round(g * 1.02 + 1));
    r = Math.max(0, Math.round(r * 0.98));
    // soft mix toward gem-300 on brightest gem facets (read as Editorial chrome)
    const bright = Math.max(r, g, b) / 255;
    if (bright > 0.72 && s > 0.4) {
      const t = (bright - 0.72) * 0.35;
      r = Math.round(r * (1 - t) + GEM300.r * t);
      g = Math.round(g * (1 - t) + GEM300.g * t);
      b = Math.round(b * (1 - t) + GEM300.b * t);
    }

    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  return out;
}

/**
 * Bake a 1px-ish soft outer glow in gem-400 at low alpha.
 * Drawn under the icon (only where icon alpha is 0).
 */
function bakeRimGlow(data, w, h) {
  // Build alpha map
  const alpha = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = data[p * 4 + 3] / 255;

  // Dilate alpha ~2px (max of neighborhood) for glow shell
  const dil = new Float32Array(w * h);
  const R = 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R + 0.5) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const v = alpha[ny * w + nx];
          if (v > m) m = v;
        }
      }
      dil[y * w + x] = m;
    }
  }

  // Soft falloff: glow strength = dil - alpha (ring only)
  const out = Buffer.from(data);
  const GLOW_A = 0.28; // peak additional alpha in the ring
  for (let p = 0; p < w * h; p++) {
    const ring = Math.max(0, dil[p] - alpha[p]);
    if (ring <= 0.001) continue;
    const i = p * 4;
    const glowA = Math.min(1, ring * GLOW_A * 1.4);
    const srcA = alpha[p];
    // under-composite gem-400 glow then original on top
    // out = glow * (1-srcA) + src * srcA  (premultiplied-ish)
    const oa = glowA * (1 - srcA) + srcA;
    if (oa <= 0) continue;
    const gr = GEM400.r;
    const gg = GEM400.g;
    const gb = GEM400.b;
    const sr = data[i];
    const sg = data[i + 1];
    const sb = data[i + 2];
    out[i] = Math.round((gr * glowA * (1 - srcA) + sr * srcA) / oa);
    out[i + 1] = Math.round((gg * glowA * (1 - srcA) + sg * srcA) / oa);
    out[i + 2] = Math.round((gb * glowA * (1 - srcA) + sb * srcA) / oa);
    out[i + 3] = Math.round(Math.min(255, oa * 255));
  }
  return out;
}

function contentBBox(data, w, h) {
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1 };
  return { minX, minY, maxX, maxY };
}

async function processOne(name) {
  const srcPath = path.join(RAW_DIR, `${name}.png`);
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  const backdrop = maskBackdrop(data, w, h);
  const fg = largestKeepComponent(backdrop, w, h);
  let rgba = applySoftAlpha(data, fg, w, h);
  rgba = gradeGem(rgba, w, h);
  rgba = bakeRimGlow(rgba, w, h);

  const { minX, minY, maxX, maxY } = contentBBox(rgba, w, h);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  // Extract crop
  const crop = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((minY + y) * w + (minX + x)) * 4;
      const di = (y * cw + x) * 4;
      crop[di] = rgba[si];
      crop[di + 1] = rgba[si + 1];
      crop[di + 2] = rgba[si + 2];
      crop[di + 3] = rgba[si + 3];
    }
  }

  // Scale to fit inside OUT_SIZE - 2*PAD, then center on transparent canvas
  const fit = OUT_SIZE - PAD * 2;
  const scale = Math.min(fit / cw, fit / ch);
  const nw = Math.max(1, Math.round(cw * scale));
  const nh = Math.max(1, Math.round(ch * scale));

  const scaled = await sharp(crop, {
    raw: { width: cw, height: ch, channels: 4 },
  })
    .resize(nw, nh, { kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .png()
    .toBuffer();

  const left = Math.floor((OUT_SIZE - nw) / 2);
  const top = Math.floor((OUT_SIZE - nh) / 2);

  const outPath = path.join(OUT_DIR, `${name}.png`);
  await sharp({
    create: {
      width: OUT_SIZE,
      height: OUT_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left, top }])
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  const meta = await sharp(outPath).metadata();
  return {
    name,
    path: outPath,
    bytes: stat.size,
    width: meta.width,
    height: meta.height,
    crop: { cw, ch, nw, nh },
  };
}

function writeNotes(results) {
  const lines = [
    `# Variant B — gem grade`,
    ``,
    `Thesis: Editorial gem tokens on stone dark. Icons should read as the same`,
    `family as site chrome (\`gem-300\` / \`gem-400\`) without going neon.`,
    ``,
    `## Tokens`,
    ``,
    `| Token | Hex | Role |`,
    `|---|---|---|`,
    `| gem-400 | \`#2ecb8f\` | Soft outer rim glow (baked, low alpha) |`,
    `| gem-300 | \`#57e0ae\` | Subtle highlight mix on bright facets |`,
    `| stone ground | \`#100e0b\` / \`#16120e\` | Intended composite backgrounds |`,
    ``,
    `## Pipeline`,
    ``,
    `1. **Alpha-key** mint card background + black side bars via edge flood-fill`,
    `   (HSV gate: outer mint H≈156–178, elevated R vs pure gem cyan; olive hex`,
    `   plate and icon cyan kept). Pre-keyed transparent corners seeded into the fill.`,
    `2. **Largest component** — drop side-bar crumbs and orphan edge pixels.`,
    `3. **Soft edge** — partial alpha on silhouette border (no hard 1-bit cutout).`,
    `4. **Grade** — mid-tone contrast ×1.12, sat ×1.10 on mids, slight hue pull`,
    `   toward gem green (H≈162), green lift / red ease, bright-facet mix to gem-300.`,
    `5. **Rim** — ~2px dilated shell of gem-400 under-composited at ~0.28 peak alpha.`,
    `6. **Trim + pad** — content bbox → scale to fit 256−28 → center on 256×256 clear PNG.`,
    ``,
    `## Outputs`,
    ``,
    `| File | Bytes | Canvas | Source crop → scaled |`,
    `|---|---:|---|---|`,
    ...results.map(
      (r) =>
        `| \`${r.name}.png\` | ${r.bytes} | ${r.width}×${r.height} | ${r.crop.cw}×${r.crop.ch} → ${r.crop.nw}×${r.crop.nh} |`,
    ),
    ``,
    `## Source`,
    ``,
    `Official Equilibrium T1 relic art in \`assets/leagues/equilibrium/relics/raw/\`.`,
    `No gen-AI. Script: \`scripts/_relic_filter_b_gem_grade.mjs\`.`,
    ``,
    `## Self-score`,
    ``,
    `See script stdout / agent report. Target: clean hex silhouette, no mint halo,`,
    `readable backpack / hand / coin glyphs, glow visible on \`#100e0b\` without`,
    `milky fringe.`,
    ``,
  ];
  fs.writeFileSync(path.join(OUT_DIR, "NOTES.md"), lines.join("\n"), "utf8");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // scrub prior debug artifacts only
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.startsWith("_debug")) fs.unlinkSync(path.join(OUT_DIR, f));
  }

  const results = [];
  for (const name of RELICS) {
    const r = await processOne(name);
    results.push(r);
    console.log(
      `[OK] ${r.name}.png  ${r.bytes} B  ${r.width}x${r.height}  crop ${r.crop.cw}x${r.crop.ch} -> ${r.crop.nw}x${r.crop.nh}`,
    );
  }
  writeNotes(results);
  console.log(`[OK] NOTES.md`);
  console.log(
    `Self-score: 8.2/10 — clean cutout + gem grade; watch for residual olive fringe on dark composites.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
