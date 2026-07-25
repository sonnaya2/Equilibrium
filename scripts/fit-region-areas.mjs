/**
 * Fit the board's region areas to measured Gielinor proportions, in place.
 *
 * Why this is a solver and not a per-region scale: mainland regions share
 * border nodes, and that sharing is the thing that stops slabs cracking apart
 * along a seam. Scaling Misthalin about its own centroid would tear its seams
 * with Asgarnia and Morytania. So instead every region proposes where each of
 * its nodes should move, and each node takes the average of the proposals from
 * the regions that own it. Shared seams stay shared by construction; only
 * coordinates change, never topology, so regionShapes.test.ts keeps passing.
 *
 * Targets blend two sources, which is the hybrid:
 *   - true area, measured from the colour-coded map (scripts/measure-region-areas.mjs)
 *   - the Leagues plate, which sizes regions for clickability (bake-region-draft.mjs)
 * Anachronia and Havenhythe post-date the colour map, so their share comes from
 * the plate alone, rescaled onto the measured basis rather than invented.
 *
 *   node scripts/fit-region-areas.mjs [--blend 0.85] [--dry]
 *
 * Rewrites BORDER_NODES and markerUv in src/map/data/regionShapes.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHAPES = path.join(ROOT, "src/map/data/regionShapes.ts");
const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const BLEND = arg("--blend", 0.85); // 1 = fully measured, 0 = fully Leagues plate
const DRY = process.argv.includes("--dry");
const ITERATIONS = 600;
/** The uv envelope the camera framings are authored against; measured from the board before the fit. */
const TARGET_BOX = [0.078, 0.018, 0.928, 0.976];

// ---- parse -----------------------------------------------------------------
const src = fs.readFileSync(SHAPES, "utf8");
const nodes = {};
const nodeBlock = src.slice(src.indexOf("export const BORDER_NODES"), src.indexOf("} as const satisfies"));
for (const m of nodeBlock.matchAll(/^\s{2}([a-z0-9_]+):\s*\[([-\d.]+),\s*([-\d.]+)\]/gm)) {
  nodes[m[1]] = [Number(m[2]), Number(m[3])];
}
const regions = [];
for (const m of src.matchAll(
  /id:\s*"([a-z]+)",\s*ring:\s*(\[[\s\S]*?\]),\s*markerUv:\s*\[([-\d.]+),\s*([-\d.]+)\]/g,
)) {
  regions.push({
    id: m[1],
    ring: [...m[2].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]),
    marker: [Number(m[3]), Number(m[4])],
  });
}
if (regions.length !== 11) throw new Error(`parsed ${regions.length} regions, expected 11`);

// Islands own every one of their nodes; mainland regions share seams.
const owners = {};
for (const r of regions) for (const k of r.ring) (owners[k] ??= []).push(r.id);

// ---- targets ---------------------------------------------------------------
const measured = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/.region-areas.json"), "utf8")).shares;
const plate = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/.region-draft.json"), "utf8")).regions.map((r) => [
    r.id,
    r.landShare,
  ]),
);

// Put the two unmeasured regions on the measured basis: their size relative to
// the other nine on the plate, applied to a measured set that sums to 100.
const missing = regions.map((r) => r.id).filter((id) => !(id in measured));
const plateRest = Object.entries(plate).reduce((s, [id, v]) => (missing.includes(id) ? s : s + v), 0);
const trueShare = { ...measured };
for (const id of missing) trueShare[id] = (100 * plate[id]) / plateRest;

const norm = (o) => {
  const t = Object.values(o).reduce((s, v) => s + v, 0);
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / t]));
};
const T = norm(trueShare);
const P = norm(plate);
const target = Object.fromEntries(regions.map((r) => [r.id, BLEND * T[r.id] + (1 - BLEND) * P[r.id]]));

// ---- geometry helpers ------------------------------------------------------
const ringPts = (r) => r.ring.map((k) => nodes[k]);
const signedArea = (p) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};
const areaOf = (r) => Math.abs(signedArea(ringPts(r)));
const centroid = (p) => {
  let x = 0, y = 0, a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i], w = p[(i + 1) % p.length];
    const f = q[0] * w[1] - w[0] * q[1];
    a += f;
    x += (q[0] + w[0]) * f;
    y += (q[1] + w[1]) * f;
  }
  a *= 0.5;
  return Math.abs(a) < 1e-12 ? p[0] : [x / (6 * a), y / (6 * a)];
};
const selfIntersects = (p) => {
  const hit = (a, b, c, d) => {
    const s = (u, v, w) => Math.sign((v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0]));
    return s(a, b, c) !== s(a, b, d) && s(c, d, a) !== s(c, d, b);
  };
  for (let i = 0; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      if (hit(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) return true;
    }
  return false;
};

const before = Object.fromEntries(regions.map((r) => [r.id, areaOf(r)]));
const beforeTotal = Object.values(before).reduce((s, v) => s + v, 0);

// ---- relax -----------------------------------------------------------------
// Each region proposes a radial scale about its own centroid; every node takes
// the mean proposal of its owners, so a shared seam moves once, consistently.
for (let it = 0; it < ITERATIONS; it++) {
  const total = regions.reduce((s, r) => s + areaOf(r), 0);
  const proposals = {};
  for (const r of regions) {
    const pts = ringPts(r);
    const c = centroid(pts);
    const want = target[r.id] * total;
    const have = Math.abs(signedArea(pts));
    // sqrt because area scales with the square of a radial move; damped hard so
    // neighbours negotiate instead of one region shoving the board around.
    const s = 1 + (Math.sqrt(want / have) - 1) * 0.08;
    r.ring.forEach((k, i) => {
      const p = pts[i];
      (proposals[k] ??= []).push([c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s]);
    });
  }
  const snapshot = Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, [...v]]));
  for (const [k, list] of Object.entries(proposals)) {
    nodes[k] = [
      list.reduce((s, p) => s + p[0], 0) / list.length,
      list.reduce((s, p) => s + p[1], 0) / list.length,
    ];
  }
  // Never let a ring fold over itself; revert the step if any did.
  if (regions.some((r) => selfIntersects(ringPts(r)))) {
    for (const [k, v] of Object.entries(snapshot)) nodes[k] = v;
    console.log(`stopped at iteration ${it}: further movement would fold a ring`);
    break;
  }
}

// ---- refit the board to its original envelope ------------------------------
// Relaxation conserves relative area but lets the whole board drift and grow,
// which would push regions past the uv frame the camera is authored against.
// One uniform transform puts it back: proportions are untouched, framing is.
{
  const all = Object.values(nodes);
  const box = (sel) => [Math.min(...all.map(sel)), Math.max(...all.map(sel))];
  const [x0, x1] = box((p) => p[0]);
  const [y0, y1] = box((p) => p[1]);
  const s = Math.min((TARGET_BOX[2] - TARGET_BOX[0]) / (x1 - x0), (TARGET_BOX[3] - TARGET_BOX[1]) / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const tx = (TARGET_BOX[0] + TARGET_BOX[2]) / 2, ty = (TARGET_BOX[1] + TARGET_BOX[3]) / 2;
  for (const k of Object.keys(nodes)) {
    nodes[k] = [tx + (nodes[k][0] - cx) * s, ty + (nodes[k][1] - cy) * s];
  }
}

// ---- markers ---------------------------------------------------------------
/** Shortest distance from a point to any edge of a ring. */
function distToRing(p, pts) {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j], b = pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  }
  return best;
}

// Pole of inaccessibility, roughly: the inside point furthest from any edge.
// Keeps every crest on its own slab and off the seams after the shapes move.
function poleOf(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const inside = (p) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const edgeDist = (p) => distToRing(p, pts);
  let best = null, bestD = -1;
  const N = 48;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const p = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
      if (!inside(p)) continue;
      const d = edgeDist(p);
      if (d > bestD) { bestD = d; best = p; }
    }
  return best;
}
for (const r of regions) {
  const p = poleOf(ringPts(r));
  if (p) r.marker = p;
}

// The widest inscribed point is right for one region and wrong for the board:
// Kandarin's lands on its south coast, directly on top of Karamja's. Push any
// pair that would collide apart, but never outside its own ring — a crest off
// its slab is worse than two crests a little close.
{
  const MIN_SEP = 0.085;
  const insideRing = (r, p) => {
    const pts = ringPts(r);
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < regions.length; i++)
      for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i], b = regions[j];
        const dx = b.marker[0] - a.marker[0], dy = b.marker[1] - a.marker[1];
        const d = Math.hypot(dx, dy);
        if (d >= MIN_SEP || d < 1e-9) continue;
        const push = ((MIN_SEP - d) / 2) * 0.5;
        const ux = dx / d, uy = dy / d;
        // Inside is not enough: a crest is a quad on the cap, so a marker near
        // the rim hangs over the edge and gets clipped by the drop or a
        // neighbouring slab. Keep clear of the coastline as well.
        const MIN_EDGE = 0.045;
        const tryMove = (r, sx, sy) => {
          const p = [r.marker[0] + sx, r.marker[1] + sy];
          const pts = ringPts(r);
          if (!insideRing(r, p)) return false;
          if (distToRing(p, pts) < Math.min(MIN_EDGE, distToRing(r.marker, pts))) return false;
          r.marker = p;
          return true;
        };
        moved = tryMove(a, -ux * push, -uy * push) || moved;
        moved = tryMove(b, ux * push, uy * push) || moved;
      }
    if (!moved) break;
  }
}

// ---- report ----------------------------------------------------------------
const afterTotal = regions.reduce((s, r) => s + areaOf(r), 0);
const r3 = (v) => Number(v.toFixed(3));
console.log(`blend ${BLEND} (1 = measured Gielinor, 0 = Leagues plate)\n`);
console.log("region        before   target    after");
for (const r of [...regions].sort((a, b) => areaOf(b) - areaOf(a))) {
  const b = (100 * before[r.id]) / beforeTotal;
  const a = (100 * areaOf(r)) / afterTotal;
  console.log(
    r.id.padEnd(13),
    b.toFixed(1).padStart(5),
    (100 * target[r.id]).toFixed(1).padStart(8),
    a.toFixed(1).padStart(8),
    Math.abs(a - 100 * target[r.id]) > 1.5 ? "  <- still off" : "",
  );
}
if (DRY) {
  console.log("\n--dry: nothing written");
  process.exit(0);
}

// ---- write back ------------------------------------------------------------
let out = src;
for (const [k, [x, y]] of Object.entries(nodes)) {
  out = out.replace(
    new RegExp(`(^\\s{2}${k}:\\s*)\\[[-\\d.]+,\\s*[-\\d.]+\\]`, "m"),
    `$1[${r3(x)}, ${r3(y)}]`,
  );
}
for (const r of regions) {
  out = out.replace(
    new RegExp(`(id:\\s*"${r.id}",[\\s\\S]*?markerUv:\\s*)\\[[-\\d.]+,\\s*[-\\d.]+\\]`),
    `$1[${r3(r.marker[0])}, ${r3(r.marker[1])}]`,
  );
  // frame() derives its camera target from a marker literal, so it has to move
  // with the marker or every region's shot points at where the slab used to be.
  out = out.replace(
    new RegExp(`(id:\\s*"${r.id}",[\\s\\S]*?framing:\\s*frame\\()\\[[-\\d.]+,\\s*[-\\d.]+\\]`),
    `$1[${r3(r.marker[0])}, ${r3(r.marker[1])}]`,
  );
}
fs.writeFileSync(SHAPES, out);
console.log(`\nwrote ${path.relative(ROOT, SHAPES)} — run the invariant test`);
