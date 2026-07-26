/**
 * Procedural region surface textures for the War Table slabs.
 *
 * Not generated art — deterministic noise from a seed, using the per-region
 * parameter table in docs/wartable-plan.md. Every region runs the same graph
 * and differs only by its parameters, then every one gets the identical grade
 * pass toward BOARD_MEAN. That shared grade is what makes eleven surfaces read
 * as one carved board instead of eleven stickers.
 *
 *   node scripts/gen-region-textures.mjs [--size 512]
 *
 * Writes assets/rs3/terrain/<region>.png (tileable) plus _contact-sheet.png.
 * Copy to public/game/terrain/ for production (this script does both).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ASSETS = path.join(HERE, "..", "assets", "rs3", "terrain");
const OUT_PUBLIC = path.join(HERE, "..", "public", "game", "terrain");
const SIZE = Number(process.argv[process.argv.indexOf("--size") + 1]) || 512;

/** Board mean. Every region is graded 14% toward this. */
const BOARD_MEAN = "#2a2318";

// Identity comes from structure first, hue second: at slab scale on a dark
// board, four muddy greens are indistinguishable but furrows / hedgerows /
// canopy clumps are not. `sat` pulls a region back toward neutral when its
// chroma would break the board's unity (desert being the loud one).
// Slightly wider low/high spans than the first pass so midtones survive the
// 14% board grade without going flat.
// id, tintLow, tintHigh, grain, speckle, speckAmt, feature, sat
const REGIONS = [
  ["misthalin", "#354428", "#647848", 5.5, "#7a8a54", 0.12, "furrow", 1],
  ["havenhythe", "#334438", "#6e8464", 4.0, "#9a8e74", 0.18, "heath", 1],
  ["karamja", "#182818", "#4a6a38", 8.0, "#100c08", 0.32, "canopy", 1],
  ["asgarnia", "#34332a", "#666258", 4.0, "#7a766c", 0.22, "stone", 1],
  ["kandarin", "#2e3e28", "#5e7a4c", 5.0, "#b0a488", 0.14, "hedgerow", 1],
  ["fremennik", "#404548", "#8e9692", 3.0, "#e0d6c0", 0.24, "snow", 0.85],
  ["forinthry", "#2a2218", "#564432", 7.0, "#14100c", 0.34, "scorch", 1],
  ["desert", "#5e4c2c", "#b08a48", 3.5, "#c4a060", 0.1, "dunes", 0.62],
  ["morytania", "#242228", "#504c5c", 6.5, "#14100c", 0.22, "blight", 1],
  ["tirannwn", "#1c3418", "#4c8440", 6.0, "#57e0ae", 0.07, "canopy", 1],
  ["anachronia", "#283420", "#627840", 7.5, "#4e4230", 0.22, "canopy", 1],
];

/** Runs in the browser: everything below is pure canvas 2D. */
function render({ size, regions, boardMean }) {
  const rng = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hex = (h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  // Gentle S-curve: lifts midtones and keeps highs/lows readable after board grade.
  const contrastCurve = (t, k = 0.22) => {
    const x = clamp01(t);
    const s = smooth(x);
    return clamp01(x + (s - x) * k + (x - 0.5) * 0.08);
  };

  /** Periodic value noise: the lattice wraps, so the tile is seamless. */
  const lattice = (period, seed) => {
    const r = rng(seed);
    const g = new Float32Array(period * period);
    for (let i = 0; i < g.length; i++) g[i] = r();
    return (x, y) => {
      const fx = x * period, fy = y * period;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const i0 = ((x0 % period) + period) % period;
      const j0 = ((y0 % period) + period) % period;
      const i1 = (i0 + 1) % period, j1 = (j0 + 1) % period;
      const a = g[j0 * period + i0], b = g[j0 * period + i1];
      const c = g[j1 * period + i0], d = g[j1 * period + i1];
      return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    };
  };

  /**
   * Periodic Worley. mode:
   *  "f1"  — distance to nearest (default)
   *  "f2"  — distance to second nearest
   *  "edge"— f2-f1 cell borders
   */
  const cells = (period, seed, mode = "f1") => {
    const r = rng(seed);
    const pts = [];
    for (let j = 0; j < period; j++)
      for (let i = 0; i < period; i++) pts.push([i + r(), j + r()]);
    return (x, y) => {
      const fx = x * period, fy = y * period;
      const ci = Math.floor(fx), cj = Math.floor(fy);
      let f1 = Infinity, f2 = Infinity;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const i = ((ci + di) % period + period) % period;
          const j = ((cj + dj) % period + period) % period;
          const p = pts[j * period + i];
          const px = p[0] + (ci + di - i);
          const py = p[1] + (cj + dj - j);
          const d = Math.sqrt((fx - px) ** 2 + (fy - py) ** 2);
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) f2 = d;
        }
      if (mode === "edge") return f2 - f1;
      if (mode === "f2") return f2;
      return f1;
    };
  };

  const fbm = (baseP, seed, octaves) => {
    const layers = [];
    for (let o = 0; o < octaves; o++)
      layers.push([lattice(baseP * 2 ** o, seed + o * 977), 1 / 2 ** o]);
    const norm = layers.reduce((s, [, w]) => s + w, 0);
    return (x, y) => layers.reduce((s, [n, w]) => s + n(x, y) * w, 0) / norm;
  };

  // Ridge noise (absolute deviation from mid) — good for cracks / scorch veins.
  const ridge = (baseP, seed, octaves) => {
    const n = fbm(baseP, seed, octaves);
    return (x, y) => {
      const v = Math.abs(n(x, y) - 0.5) * 2;
      return 1 - v;
    };
  };

  const out = {};
  const mean = hex(boardMean);

  for (const [id, lowHex, highHex, grain, speckHex, speckAmt, feature, sat] of regions) {
    const seed = [...id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) | 0;
    const low = hex(lowHex), high = hex(highHex);
    const speck = speckHex ? hex(speckHex) : null;

    const base = fbm(Math.max(2, Math.round(grain)), seed, 5);
    const broad = lattice(2, seed + 4001);
    const mid = fbm(Math.max(4, Math.round(grain * 1.5)), seed + 5503, 3);
    const detail = fbm(Math.max(10, Math.round(grain * 4)), seed + 8009, 3);
    const fine = fbm(Math.max(18, Math.round(grain * 7)), seed + 9101, 2);
    const plots = cells(6, seed + 1213, "f1");
    const plotEdge = cells(6, seed + 1213, "edge");
    const blot = cells(4, seed + 3307, "f1");
    const crowns = cells(5, seed + 4411, "f1");
    const crownEdge = cells(5, seed + 4411, "edge");
    const cobble = cells(9, seed + 5521, "edge");
    const scorchRidge = ridge(Math.max(3, Math.round(grain * 0.7)), seed + 6631, 4);

    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = px / size, y = py / size;
        let n = base(x, y) * 0.55 + mid(x, y) * 0.28 + detail(x, y) * 0.12 + fine(x, y) * 0.05;
        // Large-scale lift/kill so the tile does not read as a flat stamp.
        n = n * 0.88 + broad(x, y) * 0.12;

        // Feature layer: the thing that makes a region recognisable at a glance.
        if (feature === "dunes") {
          // Primary wind ridges + weaker cross-ripples; crest highlight via sin^2.
          const warp = broad(x, y) * 2.8 + mid(x, y) * 0.55;
          const ridge1 = Math.sin((x * 3.5 + warp) * Math.PI * 2);
          const ridge2 = Math.sin((x * 7.2 + y * 1.1 + mid(x + 0.2, y) * 1.4) * Math.PI * 2) * 0.28;
          const crest = Math.pow(Math.max(0, ridge1), 2);
          n = 0.42 + ridge1 * 0.28 + ridge2 * 0.12 + crest * 0.1 + n * 0.22;
        } else if (feature === "canopy") {
          // Multi-scale crowns: Worley clumps as leaf masses, soft holes between.
          const c1 = 1 - Math.min(1, crowns(x, y) * 1.55);
          const c2 = 1 - Math.min(1, blot(x, y) * 1.9);
          const gap = Math.min(1, crownEdge(x, y) * 3.2);
          const mass = smooth(smooth(c1 * 0.72 + c2 * 0.28));
          n = n * 0.28 + mass * 0.58 + gap * 0.08 + detail(x, y) * 0.06;
          // Slight darkening in canopy interiors so crowns read as volume.
          n -= (1 - gap) * mass * 0.06;
        } else if (feature === "snow") {
          // Packed drifts: high base, soft ridge peaks, dark rock freckles below.
          const drift = smooth(broad(x, y) * 0.55 + mid(x, y) * 0.45);
          const rockPeek = detail(x, y) < 0.18 ? detail(x, y) * 0.9 : 0;
          n = 0.58 + drift * 0.32 + n * 0.14 - rockPeek;
        } else if (feature === "scorch") {
          // Char plateaus + thin ridge cracks (ridge FBM) + ash freckle.
          const plate = smooth(base(x, y));
          const crack = scorchRidge(x, y);
          const vein = crack > 0.78 ? (crack - 0.78) * 3.2 : 0;
          n = plate * 0.55 + n * 0.25 + detail(x, y) * 0.1 - vein * 0.55;
          if (detail(x * 1.3, y * 1.3) > 0.82) n -= 0.08;
        } else if (feature === "blight") {
          // Standing pools + sickly raised banks; soft edges, not hard blotches.
          const pool = 1 - Math.min(1, blot(x, y) * 1.45);
          const bank = Math.min(1, blot(x, y) * 2.1);
          const mire = smooth(pool);
          n = n * 0.4 + (1 - mire) * 0.42 + bank * 0.12 + detail(x, y) * 0.06;
          n -= mire * 0.18;
        } else if (feature === "stone") {
          // Flagstone plates: Worley cell edges as mortar, noisy plate faces.
          const mortar = Math.min(1, cobble(x, y) * 4.5);
          const face = mid(x, y) * 0.55 + detail(x, y) * 0.45;
          n = face * 0.55 + mortar * 0.35 + n * 0.1;
          // Slight plate-to-plate value steps from broad noise.
          n += (broad(x, y) - 0.5) * 0.08;
        } else if (feature === "furrow") {
          // Warped plow strips: readable structure, not countable corduroy.
          // Ridge tops slightly brighter (soil turning).
          const warp = broad(x, y) * 2.4 + mid(x, y) * 0.7;
          const rows = Math.sin((y * 6.2 + warp) * Math.PI * 2);
          const ridge = Math.pow(Math.max(0, rows), 1.6);
          const trough = Math.pow(Math.max(0, -rows), 1.4);
          n = n * 0.62 + 0.38 * (0.5 + rows * 0.22 + ridge * 0.14 - trough * 0.1);
          n += detail(x, y) * 0.06;
        } else if (feature === "hedgerow") {
          // Enclosed pasture: lit interiors, dark hedge borders with soft width.
          const edge = Math.min(1, plotEdge(x, y) * 3.8);
          const interior = Math.min(1, plots(x, y) * 2.1);
          const hedge = 1 - smooth(edge);
          n = n * 0.32 + interior * 0.48 + edge * 0.12 - hedge * 0.22;
          n += detail(x, y) * 0.08;
        } else if (feature === "heath") {
          // Open coastal scrub: low undulation + patchy scrub clumps.
          const scrub = 1 - Math.min(1, blot(x, y) * 2.6);
          const dunelet = Math.sin((x * 2.2 + broad(x, y) * 1.4) * Math.PI * 2) * 0.08;
          n = 0.38 + n * 0.42 + scrub * 0.16 + dunelet + detail(x, y) * 0.06;
        }

        n = contrastCurve(clamp01(n), 0.28);

        // Baked micro-relief: slight darken in local lows so structure holds under
        // PBR lighting without needing a normal map.
        const relief = (detail(x, y) - 0.5) * 0.07 + (fine(x, y) - 0.5) * 0.035;
        n = clamp01(n + relief);

        let r = low[0] + (high[0] - low[0]) * n;
        let g = low[1] + (high[1] - low[1]) * n;
        let b = low[2] + (high[2] - low[2]) * n;

        if (speck && speckAmt > 0) {
          // Multi-threshold freckles: a few large + more fine grit.
          const s1 = detail(x * 1.7 + 0.31, y * 1.7 + 0.71);
          const s2 = fine(x * 2.3 + 0.17, y * 2.3 + 0.53);
          if (s1 > 1 - speckAmt * 0.5) {
            const k = 0.5 + speckAmt * 0.25;
            r += (speck[0] - r) * k;
            g += (speck[1] - g) * k;
            b += (speck[2] - b) * k;
          } else if (s2 > 1 - speckAmt * 0.35) {
            const k = 0.28;
            r += (speck[0] - r) * k;
            g += (speck[1] - g) * k;
            b += (speck[2] - b) * k;
          }
        }

        // Pull chroma back where it would break the board (desert, snow).
        if (sat < 1) {
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r += (lum - r) * (1 - sat);
          g += (lum - g) * (1 - sat);
          b += (lum - b) * (1 - sat);
        }

        // Mild per-channel contrast expand around mid before board grade so the
        // 14% pull does not flatten everything into mud.
        const midC = 42;
        r = midC + (r - midC) * 1.12;
        g = midC + (g - midC) * 1.12;
        b = midC + (b - midC) * 1.12;

        // The unifier: identical for every region.
        r += (mean[0] - r) * 0.14;
        g += (mean[1] - g) * 0.14;
        b += (mean[2] - b) * 0.14;

        const o = (py * size + px) * 4;
        d[o] = clamp01(r / 255) * 255;
        d[o + 1] = clamp01(g / 255) * 255;
        d[o + 2] = clamp01(b / 255) * 255;
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    out[id] = c;
  }

  // Contact sheet so all eleven can be judged together.
  const cols = 4, cell = 168;
  const rows = Math.ceil(regions.length / cols);
  const sheet = document.createElement("canvas");
  sheet.width = cols * cell;
  sheet.height = rows * (cell + 18);
  const sc = sheet.getContext("2d");
  sc.fillStyle = "#0d0a07";
  sc.fillRect(0, 0, sheet.width, sheet.height);
  regions.forEach(([id], i) => {
    const cx = (i % cols) * cell, cy = Math.floor(i / cols) * (cell + 18);
    sc.drawImage(out[id], cx + 4, cy + 4, cell - 8, cell - 8);
    sc.fillStyle = "#d3c8b0";
    sc.font = "11px monospace";
    sc.fillText(id, cx + 6, cy + cell + 10);
  });

  const toUrl = (canvas) => canvas.toDataURL("image/png").split(",")[1];

  const result = {};
  for (const [id] of regions) result[id] = toUrl(out[id]);
  result._sheet = toUrl(sheet);
  return result;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // Larger default viewport not required; canvas is offscreen.
  page.setDefaultTimeout(120_000);
  const images = await page.evaluate(render, {
    size: SIZE,
    regions: REGIONS,
    boardMean: BOARD_MEAN,
  });
  for (const dir of [OUT_ASSETS, OUT_PUBLIC]) fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const [id, b64] of Object.entries(images)) {
    const buf = Buffer.from(b64, "base64");
    const name = id === "_sheet" ? "_contact-sheet.png" : `${id}.png`;
    fs.writeFileSync(path.join(OUT_ASSETS, name), buf);
    // Public only ships the 11 region tiles (no contact sheet).
    if (id !== "_sheet") {
      fs.writeFileSync(path.join(OUT_PUBLIC, name), buf);
      total += buf.length;
    }
    console.log(`${name.padEnd(22)} ${(buf.length / 1024).toFixed(1)} KB`);
  }
  console.log(`\n11 textures, ${(total / 1024).toFixed(0)} KB total at ${SIZE}px`);
  console.log(`assets: ${OUT_ASSETS}`);
  console.log(`public: ${OUT_PUBLIC}`);
} finally {
  await browser.close();
}
