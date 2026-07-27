/**
 * Pack the board's POI icons into one sheet.
 *
 * Every marker on the map wants a real game icon rather than a generic pin, and
 * the repo already holds them — `public/game/activities` alone covers about
 * seven in ten place anchors by name. What it cannot cover falls back to the
 * region's own crest, which is also real art.
 *
 * They ship as one atlas because the alternative is forty texture requests the
 * moment a region is framed, and forty materials to draw them with. One sheet is
 * one request, one material, and markers that can share a geometry.
 *
 *   npm run build:map
 *
 * Outputs
 *   public/map/poi-atlas.webp
 *   public/map/poi-atlas.json   { cell, cols, rows, index: { "<region>/<area>": slot } }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANCHORS_TS = path.join(ROOT, "src/map/data/placeAnchors.ts");
const GAME = path.join(ROOT, "public/game");
const OUT_IMAGE = path.join(ROOT, "public/map/poi-atlas.webp");
const OUT_INDEX = path.join(ROOT, "public/map/poi-atlas.json");

/** Marker icons render at roughly 30 screen pixels; 96 leaves room to zoom in. */
const CELL = 96;
/** Searched in order, so a boss portrait loses to the place it happens at. */
const SOURCES = ["activities", "bosses", "leagues", "upgrades", "terrain"];

const sharp = await import("sharp").then((m) => m.default).catch(() => null);
if (!sharp) throw new Error("sharp is required (it ships with next). Run `npm ci` first.");

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’.,()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const byName = new Map();
for (const dir of SOURCES) {
  const full = path.join(GAME, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of fs.readdirSync(full)) {
    const key = file.replace(/\.(png|gif|jpe?g|webp)$/i, "");
    if (!byName.has(key)) byName.set(key, path.join(full, file));
  }
}

const source = fs.readFileSync(ANCHORS_TS, "utf8");
const rows = [...source.matchAll(/\{\s*region:\s*"([a-z]+)",\s*area:\s*"((?:[^"\\]|\\.)*)"/g)].map(
  (m) => [m[1], m[2].replace(/\\(.)/g, "$1")],
);
if (rows.length < 120) throw new Error(`placeAnchors.ts parse found only ${rows.length} anchors`);

const regions = [...new Set(rows.map(([region]) => region))].sort();
/** Region crests take the first slots so a miss always has somewhere to land. */
const entries = regions.map((region) => ({
  key: `crest/${region}`,
  file: path.join(GAME, "regions", `${region}.png`),
}));
let matched = 0;
for (const [region, area] of rows) {
  const file = byName.get(slug(area));
  if (!file) continue;
  const key = `${region}/${area}`;
  if (entries.some((e) => e.key === key)) continue;
  entries.push({ key, file });
  matched++;
}

const cols = Math.ceil(Math.sqrt(entries.length));
const rowsCount = Math.ceil(entries.length / cols);
const width = cols * CELL;
const height = rowsCount * CELL;

const composites = [];
for (let i = 0; i < entries.length; i++) {
  const buffer = await sharp(entries[i].file)
    .resize(CELL, CELL, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();
  composites.push({ input: buffer, left: (i % cols) * CELL, top: Math.floor(i / cols) * CELL });
}

await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(OUT_IMAGE);

const index = {};
entries.forEach((entry, slot) => {
  index[entry.key] = slot;
});
fs.writeFileSync(OUT_INDEX, JSON.stringify({ cell: CELL, cols, rows: rowsCount, index }));

console.log(
  `[atlas] ${entries.length} icons (${matched} of ${rows.length} anchors matched, rest fall back to a crest) · ${cols}x${rowsCount} · ${(
    fs.statSync(OUT_IMAGE).size / 1024
  ).toFixed(0)} KB`,
);
