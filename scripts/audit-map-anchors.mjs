/**
 * Audit where the board's pins actually land.
 *
 *   node scripts/audit-map-anchors.mjs
 *
 * Every check here is objective — it reads the same generated artifacts the
 * board renders from, so it reports what a player sees rather than what the
 * coordinate table claims:
 *
 *   SEA        the pin sits on open water (land coverage below LAND_MIN)
 *   SHORE      on land, but within a few tiles of the waterline
 *   OFF-PLATE  outside every ring of its own region — it will draw over a
 *              neighbour, or over nothing
 *   FOREIGN    inside a *different* region's plate, which names the culprit
 *   STACKED    two pins on one point, so one of them is unclickable
 *   OUTLIER    far from every other pin in its region, the usual signature of a
 *              coordinate that was guessed rather than looked up
 *
 * It changes nothing. Fixes belong in src/map/data/gameCoords.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIELD = path.join(ROOT, "public/map/terrain-field.webp");
const PLATES = path.join(ROOT, "public/map/region-plates.json");
const RASTER_FOR_HOLES = path.join(ROOT, "public/map/world-surface-wiki.webp");
const ANCHORS_TS = path.join(ROOT, "src/map/data/placeAnchors.ts");

/** Land coverage below this is water. The channel is antialiased 0..255. */
const LAND_MIN = 110;
/** Signed-distance channel: 128 is the waterline, one step per 1.6 tiles. */
const SHORE_STEPS = 4;
/** A pin further than this from its region's median pin is worth a look. */
const OUTLIER_TILES = 620;

const sharp = await import("sharp").then((m) => m.default).catch(() => null);
if (!sharp) throw new Error("sharp is required (it ships with next). Run `npm ci` first.");

const plates = JSON.parse(fs.readFileSync(PLATES, "utf8"));
const B = plates.bounds;
const SPAN_X = B.maxX - B.minX;
const SPAN_Y = B.maxY - B.minY;

const { placeMapCoord } = await import("../src/map/data/gameCoords.ts");
const source = fs.readFileSync(ANCHORS_TS, "utf8");
const rows = [
  ...source.matchAll(/\{\s*region:\s*"([a-z]+)",\s*area:\s*"((?:[^"\\]|\\.)*)"(,\s*site:\s*true)?/g),
].map((m) => ({ region: m[1], area: m[2].replace(/\\(.)/g, "$1"), site: Boolean(m[3]) }));
if (rows.length < 120) throw new Error(`placeAnchors.ts parse found only ${rows.length} anchors`);

const { data: field, info } = await sharp(FIELD).raw().toBuffer({ resolveWithObject: true });
const FW = info.width;
const FH = info.height;
const CH = info.channels;

function sampleField([x, y]) {
  const fx = Math.max(0, Math.min(FW - 1, Math.round(((x - B.minX) / SPAN_X) * FW)));
  const fy = Math.max(0, Math.min(FH - 1, Math.round(((B.maxY - y) / SPAN_Y) * FH)));
  const o = (fy * FW + fx) * CH;
  return { land: field[o], coast: field[o + 1], inland: field[o + 2] };
}

function inRing(px, py, flat) {
  let inside = false;
  const n = flat.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[i * 2];
    const yi = flat[i * 2 + 1];
    const xj = flat[j * 2];
    const yj = flat[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inRegion = (region, [x, y]) =>
  (plates.regions[region]?.rings ?? []).some((ring) => inRing(x, y, ring));

const REGIONS = Object.keys(plates.regions);
const findRegion = ([x, y]) => REGIONS.find((r) => inRegion(r, [x, y]));

// --------------------------------------------------------------- gather ----

const pins = [];
const missing = [];
for (const row of rows) {
  const point = placeMapCoord(row.region, row.area);
  if (!point) {
    missing.push(row);
    continue;
  }
  pins.push({ ...row, point });
}

/** Median centre per region, which an outlier is measured against. */
const centres = new Map();
for (const region of REGIONS) {
  const own = pins.filter((p) => p.region === region);
  if (!own.length) continue;
  const xs = own.map((p) => p.point[0]).sort((a, b) => a - b);
  const ys = own.map((p) => p.point[1]).sort((a, b) => a - b);
  centres.set(region, [xs[xs.length >> 1], ys[ys.length >> 1]]);
}

const stacked = new Map();
for (const pin of pins) {
  const key = `${pin.point[0]},${pin.point[1]}`;
  stacked.set(key, [...(stacked.get(key) ?? []), pin]);
}

/**
 * The raster has a few solid black discs — areas the Wiki map simply does not
 * draw. A pin on one is wrong whatever its coordinate says, because there is no
 * art under it to be right about; the Araxyte Hive sits on the Morytania one.
 * Cheap to detect and impossible to see in the field texture, which only knows
 * land from water.
 */
/** Nearest, not cubic — resampling blends a disc edge back up into terrain. */
const artwork = await sharp(RASTER_FOR_HOLES)
  .resize(SPAN_X, SPAN_Y, { kernel: "nearest" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
/** The discs read exactly rgb(24,24,24); allow a little webp drift around it. */
const UNMAPPED_MAX = 30;
const unmapped = ([x, y]) => {
  const px = Math.max(0, Math.min(SPAN_X - 1, Math.round(x - B.minX)));
  const py = Math.max(0, Math.min(SPAN_Y - 1, Math.round(B.maxY - y)));
  const o = (py * SPAN_X + px) * 3;
  return (
    artwork.data[o] <= UNMAPPED_MAX &&
    artwork.data[o + 1] <= UNMAPPED_MAX &&
    artwork.data[o + 2] <= UNMAPPED_MAX
  );
};

const findings = [];
for (const pin of pins) {
  const flags = [];
  const f = sampleField(pin.point);
  if (unmapped(pin.point)) flags.push("UNMAPPED");
  if (f.land < LAND_MIN) flags.push("SEA");
  else if (f.coast < 128 + SHORE_STEPS) flags.push("SHORE");

  if (!inRegion(pin.region, pin.point)) {
    const actual = findRegion(pin.point);
    flags.push(actual ? `FOREIGN:${actual}` : "OFF-PLATE");
  }

  const centre = centres.get(pin.region);
  if (centre) {
    const d = Math.hypot(pin.point[0] - centre[0], pin.point[1] - centre[1]);
    if (d > OUTLIER_TILES) flags.push(`OUTLIER:${Math.round(d)}`);
  }

  const group = stacked.get(`${pin.point[0]},${pin.point[1]}`);
  if (group.length > 1) {
    flags.push(`STACKED:${group.filter((g) => g !== pin).map((g) => g.area).join("+")}`);
  }

  if (flags.length) findings.push({ ...pin, flags, field: f });
}

// --------------------------------------------------------------- report ----

const order = ["UNMAPPED", "SEA", "OFF-PLATE", "FOREIGN", "OUTLIER", "STACKED", "SHORE"];
const rank = (f) => Math.min(...f.flags.map((x) => order.findIndex((o) => x.startsWith(o))));
findings.sort((a, b) => rank(a) - rank(b) || a.region.localeCompare(b.region));

console.log(`\n[anchors] ${pins.length} pins · ${findings.length} flagged\n`);
if (missing.length) {
  console.log(`No coordinate at all (${missing.length}):`);
  for (const m of missing) console.log(`  ${m.region}/${m.area}`);
  console.log("");
}

let current = "";
for (const f of findings) {
  const head = order[rank(f)];
  if (head !== current) {
    current = head;
    console.log(`--- ${head} ---`);
  }
  console.log(
    `  ${(f.region + "/" + f.area).padEnd(42)} ${String(f.point[0]).padStart(4)},${String(
      f.point[1],
    ).padStart(4)}  land=${String(f.field.land).padStart(3)}  ${f.flags.join(" ")}`,
  );
}

const counts = {};
for (const f of findings) for (const flag of f.flags) {
  const k = flag.split(":")[0];
  counts[k] = (counts[k] ?? 0) + 1;
}
console.log("\n[anchors] " + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));

// ---------------------------------------------------------------- render ----

/**
 * `--render [region...]` writes one annotated crop per region to
 * scripts/.map-anchor-audit/ (untracked).
 *
 * The automated checks above only catch a pin that is in the sea, off its
 * plate, or stacked. They cannot catch the common case — a pin on land, in the
 * right region, in the wrong place — because there is no machine-readable
 * ground truth for that. The raster has one: it draws its own town names. So
 * this puts every pin next to them and lets a human read the disagreement.
 */
if (process.argv.includes("--render")) {
  const OUT_DIR = path.join(ROOT, "scripts/.map-anchor-audit");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const RASTER = path.join(ROOT, "public/map/world-surface-wiki.webp");
  const meta = await sharp(RASTER).metadata();
  /** Raster pixels per game unit. */
  const S = meta.width / SPAN_X;

  const asked = process.argv.slice(process.argv.indexOf("--render") + 1).filter((a) => !a.startsWith("-"));
  const wanted = asked.length ? asked : REGIONS;

  for (const region of wanted) {
    const own = pins.filter((p) => p.region === region);
    if (!own.length) continue;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ring of plates.regions[region].rings) {
      for (let i = 0; i < ring.length; i += 2) {
        minX = Math.min(minX, ring[i]);
        maxX = Math.max(maxX, ring[i]);
        minY = Math.min(minY, ring[i + 1]);
        maxY = Math.max(maxY, ring[i + 1]);
      }
    }
    for (const p of own) {
      minX = Math.min(minX, p.point[0]);
      maxX = Math.max(maxX, p.point[0]);
      minY = Math.min(minY, p.point[1]);
      maxY = Math.max(maxY, p.point[1]);
    }
    const pad = 80;
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;

    const left = Math.max(0, Math.round((minX - B.minX) * S));
    const top = Math.max(0, Math.round((B.maxY - maxY) * S));
    const width = Math.min(meta.width - left, Math.round((maxX - minX) * S));
    const height = Math.min(meta.height - top, Math.round((maxY - minY) * S));
    const outW = Math.min(1900, width);
    const scale = outW / width;
    const outH = Math.round(height * scale);

    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&apos;");
    const marks = own
      .map((pin, i) => {
        const px = ((pin.point[0] - B.minX) * S - left) * scale;
        const py = ((B.maxY - pin.point[1]) * S - top) * scale;
        // Stagger, or a dense cluster writes every name on one line.
        const dy = (i % 3) * 15 - 15;
        const col = pin.site ? "#ffc03a" : "#25ffe0";
        return `<circle cx="${px}" cy="${py}" r="6" fill="none" stroke="${col}" stroke-width="2.5"/><circle cx="${px}" cy="${py}" r="1.6" fill="${col}"/><text x="${px + 9}" y="${py + 4 + dy}" font-family="monospace" font-size="15" font-weight="700" fill="${col}" stroke="#000" stroke-width="3.5" paint-order="stroke">${esc(pin.area)}</text>`;
      })
      .join("");

    await sharp(RASTER)
      .extract({ left, top, width, height })
      .resize(outW, outH)
      .composite([
        { input: Buffer.from(`<svg width="${outW}" height="${outH}">${marks}</svg>`), top: 0, left: 0 },
      ])
      .png()
      .toFile(path.join(OUT_DIR, `${region}.png`));
    console.log(`  rendered ${region}: ${own.length} pins`);
  }
}
