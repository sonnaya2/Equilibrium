/**
 * Procedural region surface textures for the War Table slabs.
 *
 * Not generated art — deterministic noise from a seed, using the per-region
 * parameter table in docs/wartable-plan.md. Every region runs the same graph
 * and differs only by its six values, then every one gets the identical grade
 * pass toward BOARD_MEAN. That shared grade is what makes eleven surfaces read
 * as one carved board instead of eleven stickers.
 *
 *   node scripts/gen-region-textures.mjs [--size 256]
 *
 * Writes out/<region>.png (tileable) plus out/_contact-sheet.png.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "assets", "rs3", "terrain");
const SIZE = Number(process.argv[process.argv.indexOf("--size") + 1]) || 512;

/** Board mean. Every region is graded 14% toward this. */
const BOARD_MEAN = "#2a2318";

// Identity comes from structure first, hue second: at slab scale on a dark
// board, four muddy greens are indistinguishable but furrows / hedgerows /
// canopy clumps are not. `sat` pulls a region back toward neutral when its
// chroma would break the board's unity (desert being the loud one).
// id, tintLow, tintHigh, grain, speckle, speckAmt, feature, sat
const REGIONS = [
  ["misthalin", "#3c4a2c", "#5a6b3c", 5.5, "#6b7a48", 0.1, "furrow", 1],
  ["havenhythe", "#3a4a38", "#63755a", 4.0, "#8b7f68", 0.16, "heath", 1],
  ["karamja", "#1f3320", "#3d5a30", 8.0, "#14100b", 0.3, "canopy", 1],
  ["asgarnia", "#3b3a30", "#57544a", 4.0, "#6b675c", 0.2, "stone", 1],
  ["kandarin", "#35452f", "#526a42", 5.0, "#a2957a", 0.12, "hedgerow", 1],
  ["fremennik", "#4a4f4c", "#7d8480", 3.0, "#d3c8b0", 0.22, "snow", 0.85],
  ["forinthry", "#332a1e", "#4a3b28", 7.0, "#1b1610", 0.3, "scorch", 1],
  ["desert", "#6b5734", "#9c7940", 3.5, "#b89154", 0.08, "dunes", 0.62],
  ["morytania", "#2b2a30", "#454250", 6.5, "#1b1610", 0.2, "blight", 1],
  ["tirannwn", "#24401d", "#417033", 6.0, "#57e0ae", 0.06, "canopy", 1],
  ["anachronia", "#2f3d24", "#556a36", 7.5, "#463a29", 0.2, "canopy", 1],
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

  /** Periodic Worley. Returns distance to the nearest jittered cell point. */
  const cells = (period, seed) => {
    const r = rng(seed);
    const pts = [];
    for (let j = 0; j < period; j++)
      for (let i = 0; i < period; i++) pts.push([i + r(), j + r()]);
    return (x, y) => {
      const fx = x * period, fy = y * period;
      const ci = Math.floor(fx), cj = Math.floor(fy);
      let best = Infinity;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const i = ((ci + di) % period + period) % period;
          const j = ((cj + dj) % period + period) % period;
          const p = pts[j * period + i];
          // Offset by the wrap so distance is measured in unwrapped space.
          const px = p[0] + (ci + di - i);
          const py = p[1] + (cj + dj - j);
          const d = (fx - px) ** 2 + (fy - py) ** 2;
          if (d < best) best = d;
        }
      return Math.sqrt(best);
    };
  };

  const fbm = (baseP, seed, octaves) => {
    const layers = [];
    for (let o = 0; o < octaves; o++)
      layers.push([lattice(baseP * 2 ** o, seed + o * 977), 1 / 2 ** o]);
    const norm = layers.reduce((s, [, w]) => s + w, 0);
    return (x, y) => layers.reduce((s, [n, w]) => s + n(x, y) * w, 0) / norm;
  };

  const out = {};
  const mean = hex(boardMean);

  for (const [id, lowHex, highHex, grain, speckHex, speckAmt, feature, sat] of regions) {
    const seed = [...id].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7) | 0;
    const low = hex(lowHex), high = hex(highHex);
    const speck = speckHex ? hex(speckHex) : null;

    const base = fbm(Math.max(2, Math.round(grain)), seed, 4);
    const broad = lattice(2, seed + 4001);
    const detail = fbm(Math.max(8, Math.round(grain * 3)), seed + 8009, 2);
    const plots = cells(7, seed + 1213);
    const blot = cells(4, seed + 3307);

    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(size, size);
    const d = img.data;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = px / size, y = py / size;
        let n = base(x, y);

        // Feature layer: the thing that makes a region recognisable at a glance.
        if (feature === "dunes") {
          // Wind ridges: sinusoid warped by low-frequency noise, wraps on x.
          // Warped hard enough that the crests wander instead of ruling lines.
          n = 0.5 + 0.5 * Math.sin((x * 4 + broad(x, y) * 2.6) * Math.PI * 2) * 0.42 + n * 0.34;
        } else if (feature === "canopy") {
          // Clumped crowns: sharpen the noise so foliage reads as blobs.
          n = smooth(smooth(n));
        } else if (feature === "snow") {
          n = 0.62 + n * 0.38;
        } else if (feature === "scorch") {
          // Cracks: thin dark veins where the detail noise crosses a ridge.
          const v = Math.abs(detail(x, y) - 0.5);
          n = n * 0.75 + (v < 0.045 ? -0.35 : 0.05);
        } else if (feature === "blight") {
          // Standing pools: soft dark blotches, not bands.
          n = n * 0.62 + (1 - Math.min(1, blot(x, y) * 1.6)) * 0.5;
        } else if (feature === "stone") {
          n = n * 0.7 + detail(x, y) * 0.3;
        } else if (feature === "furrow") {
          // Tilled strips. Kept low and heavily warped: the tile repeats 3x per
          // slab, so ridges that read as fields at 1:1 read as corduroy on the
          // board. Structure you notice, not stripes you count.
          const rows = 0.5 + 0.5 * Math.sin((y * 7 + broad(x, y) * 2.2) * Math.PI * 2);
          n = n * 0.84 + rows * 0.16;
        } else if (feature === "hedgerow") {
          // Enclosed pasture: plot interiors lit, hedge borders dark.
          const edge = Math.min(1, plots(x, y) * 2.4);
          n = n * 0.5 + edge * 0.5;
        } else if (feature === "heath") {
          // Open coastal scrub: fine, even, slightly lifted.
          n = 0.42 + n * 0.5 + (1 - Math.min(1, plots(x, y) * 3.2)) * 0.12;
        }
        n = Math.min(1, Math.max(0, n));

        let r = low[0] + (high[0] - low[0]) * n;
        let g = low[1] + (high[1] - low[1]) * n;
        let b = low[2] + (high[2] - low[2]) * n;

        if (speck && speckAmt > 0) {
          const s = detail(x * 1.7 + 0.31, y * 1.7 + 0.71);
          if (s > 1 - speckAmt * 0.55) {
            const k = 0.55;
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

        // The unifier: identical for every region.
        r += (mean[0] - r) * 0.14;
        g += (mean[1] - g) * 0.14;
        b += (mean[2] - b) * 0.14;

        const o = (py * size + px) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
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
  const images = await page.evaluate(render, { size: SIZE, regions: REGIONS, boardMean: BOARD_MEAN });
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [id, b64] of Object.entries(images)) {
    const buf = Buffer.from(b64, "base64");
    const name = id === "_sheet" ? "_contact-sheet.png" : `${id}.png`;
    fs.writeFileSync(path.join(OUT, name), buf);
    if (id !== "_sheet") total += buf.length;
    console.log(`${name.padEnd(22)} ${(buf.length / 1024).toFixed(1)} KB`);
  }
  console.log(`\n11 textures, ${(total / 1024).toFixed(0)} KB total at ${SIZE}px`);
} finally {
  await browser.close();
}
