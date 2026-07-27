/**
 * Cut the 3D board out of the HD Wiki surface raster.
 *
 * The Wiki draws open water as one flat colour, which makes the real coastline
 * recoverable exactly rather than approximately — so the board's silhouette is
 * the map's own silhouette, tiny islets and all, not a hand-drawn polygon that
 * drifts off it. Everything this writes is committed; the app never does any of
 * this work at runtime.
 *
 *   npm run build:map
 *
 * Outputs
 *   public/map/terrain-field.webp  RGBA data texture (see FIELD CHANNELS below)
 *   public/map/region-plates.json  per-region rings + seam polylines, map coords
 *   scripts/.map-terrain-debug.png overlay for eyeballing the partition (untracked)
 *
 * FIELD CHANNELS (linear data, never sRGB-decoded)
 *   R  land coverage         0 open water .. 255 solid land
 *   G  signed coast distance 128 = waterline, one step per SD_STEP game units
 *   B  inland water          the rivers and lakes the coastline encloses
 *   A  relief                low-passed raster luminance, for micro-emboss
 *
 * Region ownership is a Euclidean partition seeded from real place coordinates
 * (src/map/data/gameCoords.ts, via the region tags in placeAnchors.ts) plus the
 * supplemental seeds in data/map/region-seeds.json. Nothing here invents a
 * coordinate: a border falls where it falls between two towns we have verified
 * positions for.
 *
 * A seam is then a run of shared lattice edges, and both neighbours simplify
 * that run from the same canonical key — so they get byte-identical points,
 * plates cannot crack apart, and the vine that seals a locked border is that
 * very polyline.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public/map/world-surface-wiki.webp");
const SEEDS_JSON = path.join(ROOT, "data/map/region-seeds.json");
const ANCHORS_TS = path.join(ROOT, "src/map/data/placeAnchors.ts");
const OUT_FIELD = path.join(ROOT, "public/map/terrain-field.webp");
const OUT_PLATES = path.join(ROOT, "public/map/region-plates.json");
const OUT_DEBUG = path.join(ROOT, "scripts/.map-terrain-debug.png");

/** Mirrors MAP_BOUNDS in src/map/data/regionAnchors.ts. */
const BOUNDS = { minX: 1792, minY: 2560, maxX: 4864, maxY: 4608 };
const SPAN_X = BOUNDS.maxX - BOUNDS.minX; // 3072
const SPAN_Y = BOUNDS.maxY - BOUNDS.minY; // 2048

/** Mask lattice: exactly one pixel per game tile, so distances are in tiles. */
const W = SPAN_X;
const H = SPAN_Y;
/** The field texture is half that — every channel it carries is smooth. */
const FIELD_W = W / 2;
const FIELD_H = H / 2;

/** The Wiki's open-water fill, and how far a pixel may stray and still be water. */
const WATER_RGB = [119, 137, 165];
const WATER_TOL = 15;

/** Below this, a blob is webp ringing rather than an islet. */
const MIN_ISLET = 12;
/** Enclosed water smaller than this is a grey courtyard, not a pond. */
const MIN_POND = 30;

/** Game units per step of the packed signed-distance channel. */
const SD_STEP = 1.6;
/**
 * Coastline tolerance, game units — the ceiling, for long open coast. Short
 * runs get a proportionally tighter one: an islet twenty tiles around loses a
 * visible share of itself at this epsilon, and the map is full of them. Derived
 * from the run's own length so both sides of a seam still agree exactly.
 */
const SIMPLIFY = 1.2;
const simplifyEpsFor = (length) => Math.min(SIMPLIFY, Math.max(0.45, length / 90));
/** Largest connected disagreement between the shipped rings and their mask. */
const MAX_DIVERGENCE = 400;
/** A plate ring under this is a sliver on a border, not a landmass. */
const MIN_PLATE_AREA = 24;

const sharp = await import("sharp").then((m) => m.default).catch(() => null);
if (!sharp) throw new Error("sharp is required (it ships with next). Run `npm ci` first.");

// ----------------------------------------------------------------- seeds ----

const { placeMapCoord } = await import("../src/map/data/gameCoords.ts");
const seedFile = JSON.parse(fs.readFileSync(SEEDS_JSON, "utf8"));
const REGIONS = Object.keys(seedFile.seeds);

/**
 * placeAnchors.ts is TypeScript with path aliases node cannot resolve, and all
 * this needs from it is which region each place name belongs to — one literal
 * table. Parsed rather than imported, and asserted below so a format change
 * fails loudly instead of quietly shrinking the seed set.
 */
const seeds = REGIONS.map(() => []);
{
  const source = fs.readFileSync(ANCHORS_TS, "utf8");
  const rows = [...source.matchAll(/\{\s*region:\s*"([a-z]+)",\s*area:\s*"((?:[^"\\]|\\.)*)"/g)];
  if (rows.length < 120) {
    throw new Error(`placeAnchors.ts parse found only ${rows.length} anchors — format changed?`);
  }
  let placed = 0;
  for (const [, region, rawArea] of rows) {
    const index = REGIONS.indexOf(region);
    const area = rawArea.replace(/\\(.)/g, "$1");
    const point = index >= 0 ? placeMapCoord(region, area) : undefined;
    if (!point) continue;
    seeds[index].push(point);
    placed++;
  }
  for (const [region, list] of Object.entries(seedFile.seeds)) {
    for (const point of list) seeds[REGIONS.indexOf(region)].push(point);
  }
  console.log(
    `[terrain] seeds: ${placed} place anchors + ${Object.values(seedFile.seeds).flat().length} supplemental`,
  );
  const empty = REGIONS.filter((_, r) => seeds[r].length === 0);
  if (empty.length) throw new Error(`regions with no seeds: ${empty.join(", ")}`);
}

/** Game coordinate -> lattice pixel centre. */
const mapToPx = ([x, y]) => [
  Math.max(0, Math.min(W - 1, Math.round(((x - BOUNDS.minX) / SPAN_X) * W))),
  Math.max(0, Math.min(H - 1, Math.round(((BOUNDS.maxY - y) / SPAN_Y) * H))),
];
const px2map = ([x, y]) => [
  Math.round(BOUNDS.minX + (x / W) * SPAN_X),
  Math.round(BOUNDS.maxY - (y / H) * SPAN_Y),
];

// ----------------------------------------------------------------- masks ----

console.log(`[terrain] reading ${path.relative(ROOT, SRC)} at ${W}x${H}`);
const { data: rgb } = await sharp(SRC)
  .resize(W, H, { kernel: "cubic" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const N = W * H;
const waterish = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  if (
    Math.abs(rgb[i * 3] - WATER_RGB[0]) <= WATER_TOL &&
    Math.abs(rgb[i * 3 + 1] - WATER_RGB[1]) <= WATER_TOL &&
    Math.abs(rgb[i * 3 + 2] - WATER_RGB[2]) <= WATER_TOL
  ) {
    waterish[i] = 1;
  }
}

/**
 * Connected components over a predicate, 4-connected, iterative — the mainland
 * is a single component of over a million pixels and recursion dies on it.
 */
function components(pred, onBlob) {
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  for (let start = 0; start < N; start++) {
    if (seen[start] || !pred(start)) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    const cells = [];
    while (top > 0) {
      const i = stack[--top];
      cells.push(i);
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 0 && !seen[i - 1] && pred(i - 1)) (seen[i - 1] = 1), (stack[top++] = i - 1);
      if (x < W - 1 && !seen[i + 1] && pred(i + 1)) (seen[i + 1] = 1), (stack[top++] = i + 1);
      if (y > 0 && !seen[i - W] && pred(i - W)) (seen[i - W] = 1), (stack[top++] = i - W);
      if (y < H - 1 && !seen[i + W] && pred(i + W)) (seen[i + W] = 1), (stack[top++] = i + W);
    }
    onBlob(cells);
  }
}

/** Open sea: the water reachable from the frame edge. Everything else is inland. */
const ocean = new Uint8Array(N);
{
  const stack = [];
  const push = (i) => {
    if (waterish[i] && !ocean[i]) (ocean[i] = 1), stack.push(i);
  };
  for (let x = 0; x < W; x++) (push(x), push((H - 1) * W + x));
  for (let y = 0; y < H; y++) (push(y * W), push(y * W + W - 1));
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    const y = (i / W) | 0;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }
}

const land = new Uint8Array(N);
for (let i = 0; i < N; i++) land[i] = ocean[i] ? 0 : 1;

/**
 * Enclosed water stays inside the silhouette. A river does not cut a hole
 * through the plate; it is painted on the plate's surface, which is also what
 * keeps it attached when a region rises.
 */
const inland = new Uint8Array(N);
components(
  (i) => waterish[i] === 1 && ocean[i] === 0,
  (cells) => {
    if (cells.length >= MIN_POND) for (const i of cells) inland[i] = 1;
  },
);
let islets = 0;
components(
  (i) => land[i] === 1,
  (cells) => {
    if (cells.length < MIN_ISLET) {
      islets++;
      for (const i of cells) land[i] = 0;
    }
  },
);

let landPx = 0;
let inlandPx = 0;
for (let i = 0; i < N; i++) (landPx += land[i]), (inlandPx += inland[i]);
console.log(
  `[terrain] land ${((100 * landPx) / N).toFixed(1)}% · inland water ${((100 * inlandPx) / N).toFixed(2)}% · dropped ${islets} sub-${MIN_ISLET}px blobs`,
);

// -------------------------------------------------------- distance field ----

/** Felzenszwalb exact squared-EDT, one axis. */
function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  for (let q = 0, j = 0; q < n; q++) {
    while (z[j + 1] < q) j++;
    d[q] = (q - v[j]) * (q - v[j]) + f[v[j]];
  }
}

function distanceTo(isTarget) {
  const INF = 1e12;
  const span = Math.max(W, H) + 2;
  const f = new Float64Array(span);
  const d = new Float64Array(span);
  const v = new Int32Array(span);
  const z = new Float64Array(span + 1);
  const grid = new Float64Array(N);
  for (let i = 0; i < N; i++) grid[i] = isTarget(i) ? 0 : INF;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = grid[y * W + x];
    edt1d(f, W, d, v, z);
    for (let x = 0; x < W; x++) grid[y * W + x] = d[x];
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = grid[y * W + x];
    edt1d(f, H, d, v, z);
    for (let y = 0; y < H; y++) grid[y * W + x] = Math.sqrt(d[y]);
  }
  return grid;
}

console.log("[terrain] distance fields");
const distToWater = distanceTo((i) => land[i] === 0);
const distToLand = distanceTo((i) => land[i] === 1);

// ----------------------------------------------------- region ownership -----

console.log("[terrain] region partition");
/** 0 = water, otherwise region index + 1. */
const owner = new Uint8Array(N);
{
  const flat = [];
  const seedMark = new Uint8Array(N);
  for (let r = 0; r < REGIONS.length; r++) {
    for (const point of seeds[r]) {
      const [sx, sy] = mapToPx(point);
      flat.push(sx, sy, r + 1);
      seedMark[sy * W + sx] = 1;
    }
  }
  const count = flat.length / 3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      let best = 0;
      let bestD = Infinity;
      for (let s = 0; s < count; s++) {
        const dx = flat[s * 3] - x;
        const dy = flat[s * 3 + 1] - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) (bestD = d), (best = flat[s * 3 + 2]);
      }
      owner[i] = best;
    }
  }

  /**
   * Hard frontier corridors. Pure Euclidean seeds cannot hold one-tile
   * geopolitical borders (Salve, Al Kharid wall / Dig Site, Falador–Varrock,
   * White Wolf, Musa channel, Yanille–Brimhaven, Forinthry ditch). Boxes are
   * surface coords from wiki landmarks. League hardRule: Fort Forinthry =
   * misthalin (not forinthry). Desert is never stolen for Mory.
   */
  const mistId = REGIONS.indexOf("misthalin") + 1;
  const moryId = REGIONS.indexOf("morytania") + 1;
  const desertId = REGIONS.indexOf("desert") + 1;
  const asgId = REGIONS.indexOf("asgarnia") + 1;
  const kandId = REGIONS.indexOf("kandarin") + 1;
  const karaId = REGIONS.indexOf("karamja") + 1;
  const foriId = REGIONS.indexOf("forinthry") + 1;
  const tirId = REGIONS.indexOf("tirannwn") + 1;
  const fremId = REGIONS.indexOf("fremennik") + 1;
  if ([mistId, moryId, desertId, asgId, kandId, karaId, foriId, tirId, fremId].some((id) => id < 1)) {
    throw new Error("frontier region ids missing from seeds");
  }
  let forced = 0;
  const force = (i, id) => {
    if (owner[i] !== id) {
      owner[i] = id;
      forced++;
    }
  };
  /** True when the current owner is one of the two sides of a bilateral cut. */
  const either = (i, a, b) => owner[i] === a || owner[i] === b;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      if (!land[i]) continue;
      const [gx, gy] = px2map([px, py]);

      // --- Fort Forinthry campus = Misthalin (league hardRule) ---
      // Keep/campus [3308,3553]. Prior y≤3572 painted the fort plate too far
      // into wildy north — cap at ~3558. Stay joined to ditch S bank (y≤3522)
      // so mist is one body, not a wildy island.
      if (gx >= 3292 && gx <= 3330 && gy >= 3522 && gy <= 3558) {
        force(i, mistId);
        continue;
      }

      // --- Forinthry ditch: S bank = Misthalin; N bank = Forinthry ---
      // Ditch ~y 3521–3525 Edgeville→Silvarea. West of ~3065 stays Asgarnia
      // highland (Ice Mountain / Black Knights). Skip fort (handled above).
      if (gx >= 3075 && gx <= 3405 && gy >= 3485 && gy <= 3522) {
        if (owner[i] === foriId || owner[i] === mistId) force(i, mistId);
        continue;
      }
      // Cap x short of the Salve so Slayer Tower / north Mory stay Morytania.
      if (gx >= 3065 && gx <= 3415 && gy >= 3526 && gy <= 3920) {
        // Do not steal Asgarnia Trollheim / Death Plateau west fringe.
        if (owner[i] === mistId || owner[i] === foriId) force(i, foriId);
        continue;
      }

      // --- Salve: west bank = Misthalin; east bank = Mory ---
      // Temple ~[3405,3488]; bridge ~[3425,3485].
      // Split the old full rectangle (x 3300–3416, y≥3360) — it painted the whole
      // northern Kharidian sand top as Misthalin. River bank stays low-y mist;
      // inland mist starts higher (dig hill / Silvarea), not mid-sand.
      // Mory E bank y≥3325 only — river/sand contact below owns Mine/Burgh.
      // Always force mory (no desert skip): a prior skip+continue preserved Voronoi
      // desert fingers into Mort Myre and blocked the Burgh/contact boxes.
      if (gx >= 3390 && gx <= 3416 && gy >= 3360 && gy <= 3535) {
        force(i, mistId);
        continue;
      }
      if (gx >= 3300 && gx < 3390 && gy >= 3390 && gy <= 3535) {
        force(i, mistId);
        continue;
      }
      if (gx >= 3420 && gx <= 3560 && gy >= 3325 && gy <= 3565) {
        force(i, moryId);
        continue;
      }

      // --- Dig Site hill + Exam Centre = Misthalin (connected, not a sand blanket) ---
      // Dig Site [3360,3420]; Exam Centre ~[3362,3339]. Prior campus y≥3345 across
      // a wide x band stole the desert *top*. Keep a narrow N–S corridor so Exam
      // Centre stays mist without painting the whole northern sand, and so the
      // mist body stays one plate (an island blob breaks ring/mask agreement).
      if (gx >= 3320 && gx <= 3395 && gy >= 3385 && gy <= 3485) {
        force(i, mistId);
        continue;
      }
      if (gx >= 3340 && gx <= 3385 && gy >= 3328 && gy < 3385) {
        force(i, mistId);
        continue;
      }

      // --- Mory–Desert river / sand contact (piecewise diagonal, not sawtooth) ---
      // Band ~x 3405–3525, y 3175–3324. Desert west/south (Het's, Uzer dunes,
      // northern Kharidian sand). Mory east/north (Abandoned Mine [3441,3233],
      // Burgh de Rott, Mort'ton, Mort Myre SW).
      //   y 3260–3324: near-vertical x≈3440
      //   y 3220–3260: slight west drift (Mine mory, SW sand desert)
      //   y 3175–3220: swings east toward Burgh (dunes SW of town = desert)
      if (gx >= 3405 && gx <= 3525 && gy >= 3175 && gy <= 3324) {
        let xCut;
        if (gy >= 3260) {
          xCut = 3440;
        } else if (gy >= 3220) {
          // 3440 @ y3260 → ~3436 @ y3220
          xCut = 3440 - (3260 - gy) * 0.1;
        } else {
          // 3436 @ y3220 → ~3485 @ y3175
          xCut = 3436 + ((3220 - gy) / 45) * 49;
        }
        if (gx + 0.5 < xCut) force(i, desertId);
        else force(i, moryId);
        continue;
      }

      // South-east Mory body past the contact box (Barrows / Meiyerditch fringe).
      if (gx > 3525 && gx <= 3620 && gy >= 3180 && gy <= 3360) {
        force(i, moryId);
        continue;
      }

      // --- Al Kharid west approach = Misthalin (Lumbridge side of the gate) ---
      // Gate desert ~[3290,3225]; Lumbridge-side land west of the wall is mist.
      // North scrub toward Dig Site (x≥3295) stays desert until the dig band.
      if (gx >= 3235 && gx <= 3275 && gy >= 3215 && gy <= 3275) {
        force(i, mistId);
        continue;
      }

      // --- Northern desert sand (top of Kharidian) = Desert ---
      // Al Kharid [3293,3184], Het's Oasis [3360,3120], sand north of the city.
      // Holds up to y 3382 under the dig hill (y≥3385) and around the Exam Centre
      // blob (forced mist above). East of x3405: mory contact box.
      if (gx >= 3260 && gx <= 3405 && gy >= 2900 && gy <= 3382) {
        force(i, desertId);
        continue;
      }
      // Southern dunes under the contact band (Uzer / N dunes latitudes).
      if (gx > 3405 && gx <= 3520 && gy >= 2900 && gy < 3175) {
        force(i, desertId);
        continue;
      }

      // --- Falador–Varrock / Draynor–Sarim: latitude-split vertical cut ---
      // South (Draynor y≤3360): Port Sarim asg, Draynor mist — cut ~3065.
      // Mid (Barb y 3360–3470): Barb Village [3080,3420] asg — cut ~3086.
      // North (Edgeville y≥3470): monastery asg ≤3065, Edgeville mist ≥3070.
      if (gy >= 3180 && gy < 3360) {
        if (gx >= 2920 && gx <= 3062 && either(i, mistId, asgId)) {
          force(i, asgId);
          continue;
        }
        if (gx >= 3068 && gx <= 3185 && either(i, mistId, asgId)) {
          force(i, mistId);
          continue;
        }
      } else if (gy >= 3360 && gy < 3470) {
        if (gx >= 2920 && gx <= 3085 && either(i, mistId, asgId)) {
          force(i, asgId);
          continue;
        }
        if (gx >= 3090 && gx <= 3185 && either(i, mistId, asgId)) {
          force(i, mistId);
          continue;
        }
      } else if (gy >= 3470 && gy <= 3525) {
        if (gx >= 2920 && gx <= 3065 && either(i, mistId, asgId)) {
          force(i, asgId);
          continue;
        }
        if (gx >= 3070 && gx <= 3185 && either(i, mistId, asgId)) {
          force(i, mistId);
          continue;
        }
      }

      // --- White Wolf Mountain: Asgarnia E / Kandarin W ---
      // Summit [2870,3480] asg; Catherby [2809,3434] + NE ridge [2845,3450] kand.
      // Cut between 2846 and 2849.
      if (gx >= 2780 && gx <= 2846 && gy >= 3380 && gy <= 3565 && either(i, asgId, kandId)) {
        force(i, kandId);
        continue;
      }
      if (gx >= 2850 && gx <= 2925 && gy >= 3380 && gy <= 3565 && either(i, asgId, kandId)) {
        force(i, asgId);
        continue;
      }

      // --- Fremennik / Asgarnia mountain + NE snow ---
      // HardRules: Death Plateau, Trollheim, Troll Stronghold, GWD = Asgarnia.
      // Fremennik: Rellekka, Mountain Camp path, Keldagrim, NE snow west of trolls.
      // Bad fre seed [2960,3620] used to stab fre through Ice Mountain; kill that tongue.
      // Keldagrim [2850,3580] fre pocket — keep clear of Death Plateau [2865,3595].
      if (gx >= 2838 && gx <= 2868 && gy >= 3565 && gy <= 3590) {
        force(i, fremId);
        continue;
      }
      // Death Plateau / Burthorpe approach ridge (before troll massif).
      if (gx >= 2840 && gx <= 2950 && gy >= 3560 && gy < 3620) {
        if (owner[i] === fremId || owner[i] === asgId) {
          force(i, asgId);
          continue;
        }
      }
      // Asgarnia troll / GWD massif (do not let fre paint the mounts to fre's right).
      if (gx >= 2815 && gx <= 2965 && gy >= 3620 && gy <= 3800) {
        if (owner[i] === fremId || owner[i] === asgId || owner[i] === foriId) {
          force(i, asgId);
          continue;
        }
      }
      // Ice Mountain / Black Knights body — fre tongue from Lava Flow / bad seed.
      if (gx >= 2885 && gx <= 3065 && gy >= 3480 && gy <= 3680) {
        if (owner[i] === fremId || owner[i] === asgId) {
          force(i, asgId);
          continue;
        }
      }
      // Fremennik NE snow: west of troll ridge, north of Rellekka mountain path.
      // Reclaims the snowy band asgarnia was stealing left of ~2815.
      if (gx >= 2650 && gx <= 2810 && gy >= 3680 && gy <= 3950) {
        if (owner[i] === fremId || owner[i] === asgId || owner[i] === foriId) {
          force(i, fremId);
          continue;
        }
      }

      // --- Crandor (volcanic islet N of Musa / W of Rimmington) = Karamja ---
      // Without a seed, Entrana/Rimmington Asgarnia Voronoi steals the whole island.
      // Crandor center ~[2835,3255]; keep Entrana [2834,3335] (asg) outside this box.
      if (gx >= 2805 && gx <= 2875 && gy >= 3220 && gy <= 3295) {
        force(i, karaId);
        continue;
      }

      // --- Musa channel: Karamja island W / Asgarnia mainland E ---
      // Musa Point [2950,3145] kara; Port Sarim / Mudskipper mainland asg.
      if (gx >= 2860 && gx <= 2975 && gy >= 3100 && gy <= 3188 && either(i, asgId, karaId)) {
        force(i, karaId);
        continue;
      }
      if (gx >= 2988 && gx <= 3065 && gy >= 3100 && gy <= 3225 && either(i, asgId, karaId)) {
        force(i, asgId);
        continue;
      }

      // --- Yanille (Kandarin) / Brimhaven (Karamja) ---
      if (gx >= 2520 && gx <= 2685 && gy >= 3000 && gy <= 3185 && either(i, kandId, karaId)) {
        force(i, kandId);
        continue;
      }
      if (gx >= 2720 && gx <= 2840 && gy >= 3120 && gy <= 3225 && either(i, kandId, karaId)) {
        force(i, karaId);
        continue;
      }

      // --- Arandar pass: Kandarin owns gate + pass; Tirannwn west of pass ---
      // Gate [2345,3283] kand; W of pass [2305,3275] tir.
      if (gx >= 2325 && gx <= 2380 && gy >= 3260 && gy <= 3315 && either(i, kandId, tirId)) {
        force(i, kandId);
        continue;
      }
      if (gx >= 2180 && gx <= 2315 && gy >= 3180 && gy <= 3360 && either(i, kandId, tirId)) {
        force(i, tirId);
      }
    }
  }
  console.log(`[terrain] frontier corridors forced ${forced} tiles`);

  /**
   * A landmass with no seed of its own must not be sliced by a Voronoi chord
   * drawn between two towns on other islands — an islet belongs to one region.
   * Components that do hold a seed (the mainland) keep their internal split.
   */
  let uniform = 0;
  components(
    (i) => land[i] === 1,
    (cells) => {
      const tally = new Int32Array(REGIONS.length + 1);
      let hasSeed = false;
      for (const i of cells) {
        tally[owner[i]]++;
        if (seedMark[i]) hasSeed = true;
      }
      if (hasSeed || cells.length > 20000) return;
      let best = 1;
      for (let r = 1; r <= REGIONS.length; r++) if (tally[r] > tally[best]) best = r;
      for (const i of cells) owner[i] = best;
      uniform++;
    },
  );
  console.log(`[terrain] ${uniform} seedless landmasses made uniform`);
}

// --------------------------------------------------------- ring tracing -----

/**
 * The lattice boundary of one region's land, as closed rings that carry what
 * sits on the far side of every edge. Interior stays on the left, so rings come
 * out clockwise in (x east, y south).
 */
function traceRings(regionIndex) {
  const me = regionIndex + 1;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x);
  const mine = (i) => i >= 0 && owner[i] === me;
  const sideAt = (x, y) => {
    const i = at(x, y);
    return i < 0 ? 0 : owner[i];
  };

  const outgoing = new Map();
  const vkey = (x, y) => y * (W + 1) + x;
  const add = (x0, y0, x1, y1, side) => {
    const k = vkey(x0, y0);
    const entry = [vkey(x1, y1), side, x1, y1];
    const list = outgoing.get(k);
    if (list) list.push(entry);
    else outgoing.set(k, [entry]);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (owner[y * W + x] !== me) continue;
      if (!mine(at(x, y - 1))) add(x, y, x + 1, y, sideAt(x, y - 1));
      if (!mine(at(x + 1, y))) add(x + 1, y, x + 1, y + 1, sideAt(x + 1, y));
      if (!mine(at(x, y + 1))) add(x + 1, y + 1, x, y + 1, sideAt(x, y + 1));
      if (!mine(at(x - 1, y))) add(x, y + 1, x, y, sideAt(x - 1, y));
    }
  }

  const rings = [];
  for (const [startKey, entries] of outgoing) {
    while (entries.length) {
      const ring = [];
      let key = startKey;
      let x = key % (W + 1);
      let y = (key / (W + 1)) | 0;
      for (;;) {
        const list = outgoing.get(key);
        if (!list || list.length === 0) break;
        const [nextKey, side, nx, ny] = list.shift();
        ring.push([x, y, side]);
        key = nextKey;
        x = nx;
        y = ny;
        if (key === startKey) break;
      }
      if (ring.length >= 8) rings.push(ring);
    }
  }
  return rings;
}

/** Shoelace. Clockwise in y-down lattice space comes out positive. */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

/** Douglas-Peucker with both endpoints pinned. */
function simplifyOpen(points, eps) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi <= lo + 1) continue;
    const [ax, ay] = points[lo];
    const [bx, by] = points[hi];
    const dx = bx - ax;
    const dy = by - ay;
    const norm = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let worstAt = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / norm;
      if (d > worst) (worst = d), (worstAt = i);
    }
    if (worst > eps) {
      keep[worstAt] = 1;
      stack.push([lo, worstAt], [worstAt, hi]);
    }
  }
  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/**
 * A run that returns to where it started (a whole island coast) degenerates
 * Douglas-Peucker: with the two pinned endpoints on the same point every
 * perpendicular distance is zero, and the entire island collapses to a dot.
 * Split it at the point furthest from the start and simplify the two halves.
 */
function simplifyRing(points, eps) {
  const a = points[0];
  let far = 1;
  let farD = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const d = (points[i][0] - a[0]) ** 2 + (points[i][1] - a[1]) ** 2;
    if (d > farD) (farD = d), (far = i);
  }
  const head = simplifyOpen(points.slice(0, far + 1), eps);
  const tail = simplifyOpen(points.slice(far), eps);
  return head.concat(tail.slice(1));
}

/** A ring, cut into maximal stretches that all face the same thing. */
function splitRuns(ring) {
  const n = ring.length;
  let start = 0;
  while (start < n && ring[start][2] === ring[(start - 1 + n) % n][2]) start++;
  if (start >= n) start = 0; // one island facing nothing but sea

  const runs = [];
  let runStart = start;
  do {
    const side = ring[runStart % n][2];
    let end = runStart + 1;
    while (end - runStart < n && ring[end % n][2] === side) end++;
    const points = [];
    for (let i = runStart; i <= end; i++) points.push([ring[i % n][0], ring[i % n][1]]);
    runs.push({ side, points });
    runStart = end;
  } while (runStart - start < n);
  return runs;
}

/**
 * The identity of a stretch of border, independent of who is walking it.
 *
 * Endpoints alone are not enough. Along a ragged frontier the two neighbours can
 * cut their rings into runs differently — a single pixel of sea poking into the
 * seam splits A's run in two while B still sees one — and two runs that merely
 * share endpoints then simplify to different points, which is a crack. Keying on
 * the whole lattice path means a key collides only when both sides really did
 * walk the same edges.
 */
function runKey(points, a, b) {
  const pair = [a, b].sort((p, q) => p - q);
  const head = `${points[0][0]},${points[0][1]}`;
  const tail = `${points[points.length - 1][0]},${points[points.length - 1][1]}`;
  const ordered = head <= tail ? points : [...points].reverse();
  return `${pair[0]}|${pair[1]}|` + ordered.map((p) => `${p[0]},${p[1]}`).join(";");
}

console.log("[terrain] tracing region plates");

// Pass one: trace everything, so a border can be recognised from both sides
// before either side has committed to a simplification of it.
const traced = [];
for (let r = 0; r < REGIONS.length; r++) {
  const rings = [];
  let area = 0;
  for (const ring of traceRings(r)) {
    const signed = ringArea(ring);
    // Negative rings are holes a neighbouring plate punches. The cap is solid —
    // enclosed water is painted on it — so only outer boundaries become geometry.
    if (signed < MIN_PLATE_AREA) continue;
    area += signed;
    rings.push(splitRuns(ring));
  }
  traced.push({ rings, area });
}

/** How many sides claimed each stretch of border. Two means it is genuinely shared. */
const runSeen = new Map();
for (let r = 0; r < REGIONS.length; r++) {
  for (const ring of traced[r].rings) {
    for (const run of ring) {
      if (run.side <= 0 || run.side === r + 1) continue;
      const key = runKey(run.points, r + 1, run.side);
      runSeen.set(key, (runSeen.get(key) ?? 0) + 1);
    }
  }
}

/** Simplified once per canonical key; the neighbour gets these points reversed. */
const RUN_CACHE = new Map();
let unreconciled = 0;

const plates = {};
const seams = new Map();

for (let r = 0; r < REGIONS.length; r++) {
  const outRings = [];

  for (const ring of traced[r].rings) {
    const pts = [];
    for (const run of ring) {
      const points = run.points;
      const first = points[0];
      const last = points[points.length - 1];
      const closed = first[0] === last[0] && first[1] === last[1];
      const shared = run.side > 0 && run.side !== r + 1;
      const key = shared ? runKey(points, r + 1, run.side) : null;

      // Sharing is checked before anything else. Sending a shared run down the
      // closed-ring path was quietly costing three borders their parity: a run
      // that happens to return to its own start took a simplification neither
      // neighbour could agree on, and the two plates stopped meeting.
      let simple;
      let bothSidesDrewIt = false;
      if (shared) {
        // Count 1 means the neighbour's land here was a sliver small enough to be
        // filtered out, so it has no plate to meet — that is a coast facing a
        // ghost, not a border, and it must not grow a vine.
        const canonicalisable = !closed && runSeen.get(key) === 2;
        bothSidesDrewIt = canonicalisable;
        if (canonicalisable) {
          const flipped = `${first[0]},${first[1]}` > `${last[0]},${last[1]}`;
          let canonical = RUN_CACHE.get(key);
          if (!canonical) {
            canonical = simplifyOpen(
              flipped ? [...points].reverse() : points,
              simplifyEpsFor(points.length),
            );
            RUN_CACHE.set(key, canonical);
          }
          simple = flipped ? [...canonical].reverse() : canonical;
        } else {
          // Either the two sides cut this border differently, or it closes on
          // itself and has no canonical direction. Ship the lattice path: denser,
          // but both plates then walk exactly the same staircase and cannot crack.
          unreconciled++;
          simple = points;
        }
      } else if (closed) {
        simple = simplifyRing(points, simplifyEpsFor(points.length));
      } else {
        simple = simplifyOpen(points, simplifyEpsFor(points.length));
      }

      for (let i = 0; i < simple.length - 1; i++) pts.push(simple[i]);

      // A run whose far side is another region, and which that region also drew,
      // is a border — entire, and identical on both plates.
      if (bothSidesDrewIt && simple.length >= 3) {
        const pair = [r, run.side - 1].sort((a, b) => a - b);
        if (r === pair[0]) {
          const name = `${REGIONS[pair[0]]}|${REGIONS[pair[1]]}`;
          seams.set(name, [...(seams.get(name) ?? []), simple.map(px2map)]);
        }
      }
    }
    if (pts.length >= 4) outRings.push(pts.map(px2map));
  }

  outRings.sort((a, b) => b.length - a.length);
  plates[REGIONS[r]] = {
    rings: outRings.map((ring) => ring.flat()),
    area: Math.round(traced[r].area),
  };
  console.log(
    `  ${REGIONS[r].padEnd(11)} ${String(outRings.length).padStart(4)} rings · ${String(
      outRings.reduce((s, ring) => s + ring.length, 0),
    ).padStart(6)} pts · ${Math.round(traced[r].area / 1000)}k tiles`,
  );
}
if (unreconciled) {
  console.log(`[terrain] ${unreconciled} border runs shipped unsimplified to keep both sides identical`);
}

/**
 * The gate. Scan-convert what we are about to ship and compare it to the mask
 * it came from: a ring chained through a pinch point, or a hole the tracer
 * dropped, shows up here as missing area and nowhere else. Even-odd fill,
 * because that is what earcut will do with the same ring in the browser.
 */
{
  const painted = new Uint8Array(N);
  const xs = [];
  for (let r = 0; r < REGIONS.length; r++) {
    for (const flat of plates[REGIONS[r]].rings) {
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push(mapToPx([flat[i], flat[i + 1]]));
      let lo = H;
      let hi = 0;
      for (const p of pts) (lo = Math.min(lo, p[1])), (hi = Math.max(hi, p[1]));
      for (let y = Math.max(0, lo); y <= Math.min(H - 1, hi); y++) {
        xs.length = 0;
        const sy = y + 0.5;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > sy !== yj > sy) xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const from = Math.max(0, Math.ceil(xs[k]));
          const to = Math.min(W - 1, Math.floor(xs[k + 1]));
          for (let x = from; x <= to; x++) painted[y * W + x] = r + 1;
        }
      }
    }
  }
  let both = 0;
  let either = 0;
  for (let i = 0; i < N; i++) {
    if (owner[i] === painted[i] && owner[i]) both++;
    if (owner[i] || painted[i]) either++;
  }
  // A thin halo along every coast is simplification and is fine. One big blob is
  // a ring chained through a pinch point, and that is a hole in the board.
  let biggest = 0;
  let at = -1;
  components(
    (i) => owner[i] !== painted[i],
    (cells) => {
      if (cells.length > biggest) (biggest = cells.length), (at = cells[0]);
    },
  );
  console.log(
    `[terrain] plate/mask agreement ${((100 * both) / either).toFixed(2)}% · largest divergence ${biggest}px`,
  );
  if (biggest > MAX_DIVERGENCE) {
    throw new Error(
      `plate geometry diverges from its mask over ${biggest}px near map ${px2map([at % W, (at / W) | 0])}`,
    );
  }
}

const seamOut = [];
for (const [key, list] of seams) {
  const [a, b] = key.split("|");
  for (const points of list) {
    if (points.length >= 4) seamOut.push({ between: [a, b], points: points.flat() });
  }
}

fs.writeFileSync(
  OUT_PLATES,
  JSON.stringify({
    version: 1,
    generatedFrom: "public/map/world-surface-wiki.webp",
    bounds: BOUNDS,
    simplifyTolerance: SIMPLIFY,
    // The field is described here rather than left to be discovered, so the
    // renderer's texel constant and the texture that was actually written can be
    // checked against each other instead of drifting apart in silence.
    field: { url: "/map/terrain-field.webp", width: FIELD_W, height: FIELD_H },
    regions: plates,
    seams: seamOut,
  }),
);
const totalPts = Object.values(plates).reduce(
  (s, p) => s + p.rings.reduce((t, ring) => t + ring.length / 2, 0),
  0,
);
console.log(
  `[terrain] ${path.relative(ROOT, OUT_PLATES)} · ${totalPts} points · ${seamOut.length} seam runs · ${(
    fs.statSync(OUT_PLATES).size / 1024
  ).toFixed(0)} KB`,
);

// --------------------------------------------------------- field texture ----

console.log("[terrain] field texture");
const { data: luma } = await sharp(SRC)
  .resize(FIELD_W, FIELD_H, { kernel: "cubic" })
  .greyscale()
  .blur(1.6)
  .raw()
  .toBuffer({ resolveWithObject: true });

const field = Buffer.alloc(FIELD_W * FIELD_H * 4);
for (let fy = 0; fy < FIELD_H; fy++) {
  for (let fx = 0; fx < FIELD_W; fx++) {
    let sumLand = 0;
    let sumInland = 0;
    let sumSd = 0;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const i = (fy * 2 + dy) * W + fx * 2 + dx;
        sumLand += land[i];
        sumInland += inland[i];
        sumSd += land[i] ? distToWater[i] : -distToLand[i];
      }
    }
    const o = (fy * FIELD_W + fx) * 4;
    field[o] = Math.round((sumLand / 4) * 255);
    field[o + 1] = Math.max(0, Math.min(255, Math.round(128 + sumSd / 4 / SD_STEP)));
    field[o + 2] = Math.round((sumInland / 4) * 255);
    field[o + 3] = luma[fy * FIELD_W + fx];
  }
}
await sharp(field, { raw: { width: FIELD_W, height: FIELD_H, channels: 4 } })
  // Lossless: every channel is a mask or a distance, and webp's lossy ringing
  // would smear the waterline several tiles inland.
  .webp({ lossless: true, effort: 6 })
  .toFile(OUT_FIELD);
console.log(
  `[terrain] ${path.relative(ROOT, OUT_FIELD)} · ${FIELD_W}x${FIELD_H} · ${(
    fs.statSync(OUT_FIELD).size / 1024
  ).toFixed(0)} KB`,
);

// ----------------------------------------------------------- debug plate ----

const DBG_W = 1536;
const DBG_H = 1024;
const { data: base } = await sharp(SRC)
  .resize(DBG_W, DBG_H, { kernel: "cubic" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const dbg = Buffer.from(base);
const HUES = [
  [255, 96, 96], [96, 255, 160], [255, 208, 80], [120, 176, 255], [255, 128, 220],
  [128, 255, 255], [255, 160, 64], [176, 255, 96], [224, 128, 255], [96, 208, 128],
  [255, 96, 176],
];
// Ownership wash, so a region that swallowed its neighbour is obvious.
for (let y = 0; y < DBG_H; y++) {
  for (let x = 0; x < DBG_W; x++) {
    const o = owner[((y * H / DBG_H) | 0) * W + ((x * W / DBG_W) | 0)];
    if (!o) continue;
    const c = HUES[(o - 1) % HUES.length];
    const i = (y * DBG_W + x) * 3;
    for (let k = 0; k < 3; k++) dbg[i + k] = Math.round(dbg[i + k] * 0.72 + c[k] * 0.28);
  }
}
const dot = (x, y, c, w = 0) => {
  for (let dy = -w; dy <= w; dy++) {
    for (let dx = -w; dx <= w; dx++) {
      const px = Math.round(x) + dx;
      const py = Math.round(y) + dy;
      if (px < 0 || py < 0 || px >= DBG_W || py >= DBG_H) continue;
      const i = (py * DBG_W + px) * 3;
      (dbg[i] = c[0]), (dbg[i + 1] = c[1]), (dbg[i + 2] = c[2]);
    }
  }
};
// Simplified plate outlines: if these do not sit on the coast, the geometry is wrong.
for (const id of REGIONS) {
  for (const flat of plates[id].rings) {
    for (let i = 0; i < flat.length; i += 2) {
      dot(
        ((flat[i] - BOUNDS.minX) / SPAN_X) * DBG_W,
        ((BOUNDS.maxY - flat[i + 1]) / SPAN_Y) * DBG_H,
        [12, 12, 12],
      );
    }
  }
}
for (let r = 0; r < REGIONS.length; r++) {
  for (const point of seeds[r]) {
    const [sx, sy] = mapToPx(point);
    dot((sx / W) * DBG_W, (sy / H) * DBG_H, [255, 255, 255], 2);
  }
}
await sharp(dbg, { raw: { width: DBG_W, height: DBG_H, channels: 3 } })
  .png()
  .toFile(OUT_DEBUG);
console.log(`[terrain] ${path.relative(ROOT, OUT_DEBUG)}`);
