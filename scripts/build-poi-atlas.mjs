/**
 * Pack map POI icons into one atlas sheet.
 *
 * Uses downloaded wiki art under assets/rs3 and public/game whenever a place
 * name resolves to a file. Crests only when nothing matches — never strip a
 * real icon for being a landscape.
 *
 *   node scripts/build-poi-atlas.mjs
 *   npm run build:map
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANCHORS_TS = path.join(ROOT, "src/map/data/placeAnchors.ts");
const ROOTS = [path.join(ROOT, "assets", "rs3"), path.join(ROOT, "public", "game")].filter((p) =>
  fs.existsSync(p),
);
const GAME = path.join(ROOT, "public", "game");
const OUT_IMAGE = path.join(ROOT, "public/map/poi-atlas.webp");
const OUT_INDEX = path.join(ROOT, "public/map/poi-atlas.json");

const CELL = 192;
/** Search order: place scenes first (wiki downloads), then bosses/upgrades. */
const SOURCES = ["activities", "bosses", "upgrades", "terrain", "leagues"];

/** Explicit place-name → file slug when filename differs. */
const ALIASES = {
  "tzhaar-area": "tzhaar-city",
  "tzhaar-city": "tzhaar-city",
  "deep-sea-fishing-hub": "deep-sea-fishing",
  "howls-floating-workshop": "howls-workshop",
  "howl-s-floating-workshop": "howls-workshop",
  // Brimhaven *town* has its own plate; do not steal the agility-arena shot.
  // Musa Point / Hardwood Grove resolve by slug to their own activity files.
  "trollheim": "trollheim",
  "troll-stronghold": "trollheim",
  "death-plateau": "trollheim",
  "god-wars-dungeon": "god-wars-dungeon",
  "dwarven-mine": "mining-guild",
  "living-rock-caverns": "living-rock-caverns",
  "crafting-guild": "crafting-guild",
  "rogues-den": "rogues-den",
  "armadyls-tower": "god-wars-dungeon",
  "armady-ls-tower": "god-wars-dungeon",
  "ourania-runecrafting-altar": "ourania-runecrafting-altar",
  "ourania-altar": "ourania-altar",
  // Wilderness Chaos Temple surface fort — not the old underground altar plate.
  "chaos-temple-wilderness": "chaos-temple-wilderness",
  "chaos-temple": "chaos-temple-wilderness",
  // Lava Maze / Wilderness Crater have their own activity plates — do not alias
  // to runite/slayer art (those made crater "gone" and maze wrong).
  "bandit-camp": "bandit-camp",
  "demonic-ruins": "demonic-ruins",
  "rogues-castle": "rogues-castle",
  "araxyte-hive": "araxxor",
  // ED2 pin keeps the BSD plate; ED3 uses the underwater landscape (not tall Ambassador).
  "dragonkin-laboratory": "dragonkin-laboratory",
  "the-shadow-reef": "the-shadow-reef",
  "shadow-reef": "the-shadow-reef",
  "slayer-lodge": "hunter-lodge",
  "temple-of-ikov": "temple-of-ikov",
  "underground-pass": "underground-pass",
  "entrana": "entrana",
  "ice-mountain": "ice-mountain",
  "rellekka": "rellekka",
  "lletya": "lletya",
  "isafdar": "isafdar",
  "port-tyras": "port-tyras",
};

const sharp = await import("sharp").then((m) => m.default).catch(() => null);
if (!sharp) throw new Error("sharp is required (it ships with next). Run `npm ci` first.");

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/['’.,()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function pixelArea(file) {
  try {
    const m = await sharp(file).metadata();
    return (m.width ?? 0) * (m.height ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Walked, not listed.
 *
 * `public/game/upgrades` has twenty entries at the top and over a thousand files
 * below it — the art lives in `permanent-unlocks/`, `progression/`,
 * `skilling-tools/` and a dozen more. A flat readdir found twenty of them, which
 * is why Musa Point drew its region's crest while its own icon sat published one
 * directory down.
 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(png|gif|jpe?g|webp)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

/** slug → { file, rank } */
const byName = new Map();
for (const root of ROOTS) {
  for (let si = 0; si < SOURCES.length; si++) {
    const dir = SOURCES[si];
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const abs of walk(full)) {
      const key = path.basename(abs).replace(/\.(png|gif|jpe?g|webp)$/i, "");
      const prev = byName.get(key);
      if (!prev) {
        byName.set(key, { file: abs, rank: si });
        continue;
      }
      // Prefer earlier source rank; same rank → larger pixels.
      if (si < prev.rank) {
        byName.set(key, { file: abs, rank: si });
      } else if (si === prev.rank) {
        const a = await pixelArea(abs);
        const b = await pixelArea(prev.file);
        if (a > b) byName.set(key, { file: abs, rank: si });
      }
    }
  }
}

function resolveIcon(areaName) {
  const s = slug(areaName);
  const candidates = [s, ALIASES[s], ALIASES[areaName.toLowerCase()]].filter(Boolean);
  // Strip trailing parenthetical / "area" suffix soft matches.
  candidates.push(s.replace(/-area$/, ""));
  candidates.push(s.replace(/-hub$/, ""));
  for (const c of candidates) {
    const hit = byName.get(c);
    if (hit) return hit.file;
  }
  // Containment: longest library slug contained in place slug (or reverse).
  let best = null;
  let bestLen = 0;
  for (const [key, hit] of byName) {
    if (key.length < 5) continue;
    if (s.includes(key) || key.includes(s)) {
      if (key.length > bestLen) {
        best = hit.file;
        bestLen = key.length;
      }
    }
  }
  return best;
}

const source = fs.readFileSync(ANCHORS_TS, "utf8");
const rows = [...source.matchAll(/\{\s*region:\s*"([a-z]+)",\s*area:\s*"((?:[^"\\]|\\.)*)"/g)].map(
  (m) => [m[1], m[2].replace(/\\(.)/g, "$1")],
);
if (rows.length < 120) throw new Error(`placeAnchors.ts parse found only ${rows.length} anchors`);

const regions = [...new Set(rows.map(([region]) => region))].sort();
const entries = regions.map((region) => ({
  key: `crest/${region}`,
  file: path.join(GAME, "regions", `${region}.png`),
}));

let matched = 0;
let crestFallback = 0;
const misses = [];
for (const [region, area] of rows) {
  const key = `${region}/${area}`;
  if (entries.some((e) => e.key === key)) continue;
  const crest = path.join(GAME, "regions", `${region}.png`);
  const icon = resolveIcon(area);
  if (icon) {
    entries.push({ key, file: icon });
    matched++;
  } else if (fs.existsSync(crest)) {
    entries.push({ key, file: crest });
    crestFallback++;
    misses.push(area);
  }
}

const cols = Math.ceil(Math.sqrt(entries.length));
const rowsCount = Math.ceil(entries.length / cols);
const width = cols * CELL;
const height = rowsCount * CELL;

/** Opaque dark underlay so WebGL alphaTest never eats opaque wiki art. */
const UNDER = { r: 18, g: 16, b: 12, alpha: 1 };

const composites = [];
for (let i = 0; i < entries.length; i++) {
  const file = entries[i].file;
  if (!fs.existsSync(file)) {
    console.warn(`[atlas] missing file for ${entries[i].key}: ${file}`);
    continue;
  }
  // cover fills the disc; flatten kills transparent holes that looked "missing".
  const buffer = await sharp(file)
    .resize(CELL, CELL, { fit: "cover", position: "attention" })
    .ensureAlpha()
    .flatten({ background: UNDER })
    .png()
    .toBuffer();
  composites.push({
    input: buffer,
    left: (i % cols) * CELL,
    top: Math.floor(i / cols) * CELL,
  });
}

await sharp({
  create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .webp({ quality: 95, alphaQuality: 100, effort: 5 })
  .toFile(OUT_IMAGE);

const index = {};
entries.forEach((entry, slot) => {
  index[entry.key] = slot;
});
fs.writeFileSync(OUT_INDEX, JSON.stringify({ cell: CELL, cols, rows: rowsCount, index }));

console.log(
  `[atlas] ${entries.length} icons · matched ${matched} · crest-only ${crestFallback} · ${cols}x${rowsCount} @${CELL} · ${(
    fs.statSync(OUT_IMAGE).size / 1024
  ).toFixed(0)} KB`,
);
if (misses.length) {
  console.log(`[atlas] no dedicated art (${misses.length}): ${misses.slice(0, 20).join(", ")}${misses.length > 20 ? "…" : ""}`);
}
