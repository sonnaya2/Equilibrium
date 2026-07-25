/**
 * Dev-only authoring aid for src/map/data/regionShapes.ts.
 *
 * The league map has no region borders in it — it draws a coastline and colours
 * the two currently-unlocked regions, leaving the other nine as one green mass.
 * So this cannot extract borders. What it can do is recover the land silhouette
 * and split it by nearest anchor, which gives a draft ring per region with real
 * position and area. A human then moves the interior nodes onto coast, mountain
 * and river lines; the Voronoi chords are a starting point, never the output.
 *
 *   node scripts/bake-region-draft.mjs [--ascii]
 *
 * Writes scripts/.region-draft.json (gitignored) and prints an ASCII plate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets/leagues/equilibrium/official/regions-tab.jpg");
const OUT = path.join(ROOT, "scripts/.region-draft.json");

// Same anchors the scene uses, so drafts land where the markers already are.
const ANCHORS = [
  ["misthalin", 0.516, 0.51],
  ["havenhythe", 0.872, 0.631],
  ["karamja", 0.408, 0.735],
  ["asgarnia", 0.437, 0.465],
  ["kandarin", 0.311, 0.54],
  ["fremennik", 0.295, 0.218],
  ["forinthry", 0.511, 0.218],
  ["desert", 0.553, 0.809],
  ["morytania", 0.638, 0.488],
  ["tirannwn", 0.217, 0.562],
  ["anachronia", 0.78, 0.218],
];

/** Decode the JPEG in a real browser and classify land vs sea per pixel. */
async function landMask() {
  const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(SRC).toString("base64")}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    return await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const bits = new Uint8Array(c.width * c.height);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // Land reads green: green leads both other channels. Sea is blue-dark.
        bits[p] = g > b + 6 && g > r + 6 ? 1 : 0;
      }
      return { w: c.width, h: c.height, bits: Array.from(bits) };
    }, dataUrl);
  } finally {
    await browser.close();
  }
}

const at = (m, w, h, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);

/** Morphological close, radius r — patches the holes Jagex's own labels punch. */
function close(mask, w, h, r) {
  const dil = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let on = 0;
      for (let dy = -r; dy <= r && !on; dy++)
        for (let dx = -r; dx <= r && !on; dx++) if (at(mask, w, h, x + dx, y + dy)) on = 1;
      dil[y * w + x] = on;
    }
  const ero = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let all = 1;
      for (let dy = -r; dy <= r && all; dy++)
        for (let dx = -r; dx <= r && all; dx++) if (!at(dil, w, h, x + dx, y + dy)) all = 0;
      ero[y * w + x] = all;
    }
  return ero;
}

function main() {
  return landMask().then(({ w, h, bits }) => {
    const mask = close(Uint8Array.from(bits), w, h, 5);

    // Assign every land pixel to its nearest anchor in uv space.
    const owner = new Int8Array(w * h).fill(-1);
    const area = new Array(ANCHORS.length).fill(0);
    const cent = ANCHORS.map(() => [0, 0]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        const u = x / w, v = y / h;
        let best = 0, bd = Infinity;
        for (let i = 0; i < ANCHORS.length; i++) {
          const dx = u - ANCHORS[i][1], dy = v - ANCHORS[i][2];
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = i; }
        }
        owner[y * w + x] = best;
        area[best]++;
        cent[best][0] += u;
        cent[best][1] += v;
      }

    const land = area.reduce((s, n) => s + n, 0);
    const regions = ANCHORS.map(([id], i) => ({
      id,
      anchorUv: [ANCHORS[i][1], ANCHORS[i][2]],
      centroidUv: area[i] ? [+(cent[i][0] / area[i]).toFixed(4), +(cent[i][1] / area[i]).toFixed(4)] : null,
      landShare: +((100 * area[i]) / land).toFixed(2),
    }));

    fs.writeFileSync(OUT, JSON.stringify({ source: "public/map/league-map.jpg", w, h, landPixels: land, regions }, null, 2));

    console.log(`land ${((100 * land) / (w * h)).toFixed(1)}% of plate, ${land} px\n`);
    console.log("region        share%   anchor uv        centroid uv");
    for (const r of regions)
      console.log(
        r.id.padEnd(13),
        String(r.landShare).padStart(5),
        `  ${r.anchorUv[0].toFixed(3)},${r.anchorUv[1].toFixed(3)}`,
        r.centroidUv ? `   ${r.centroidUv[0].toFixed(3)},${r.centroidUv[1].toFixed(3)}` : "   (no land)",
      );

    if (process.argv.includes("--ascii")) {
      const CW = 108, CH = 42;
      const glyph = "misthalin havenhythe karamja asgarnia kandarin fremennik forinthry desert morytania tirannwn anachronia".split(" ");
      const key = "MHKANFWDYTX";
      console.log(`\nplate (${key} = ${glyph.map((g, i) => key[i] + ":" + g).join(" ")})\n`);
      for (let cy = 0; cy < CH; cy++) {
        let line = "";
        for (let cx = 0; cx < CW; cx++) {
          const x = Math.floor(((cx + 0.5) / CW) * w), y = Math.floor(((cy + 0.5) / CH) * h);
          line += mask[y * w + x] ? key[owner[y * w + x]] : ".";
        }
        console.log(line);
      }
    }
    console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
  });
}

main();
