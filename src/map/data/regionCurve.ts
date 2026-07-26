/**
 * Coastline generation for the region rings.
 *
 * The authored rings are 9-15 nodes each, which is the right density to hand-edit
 * and the wrong density to look at: rendered as straight chords, Wilderness reads
 * as a rectangle and Karamja as a hexagon. This turns each ring into a coastline.
 *
 * Two passes, and both are needed. Interpolation alone is not enough — a smooth
 * curve through a near-regular ten-gon is a circle, so the islands came out as
 * pebbles, which is a different kind of wrong from blocky. So:
 *
 * 1. a cubic through the authored nodes, which removes the facets, and
 * 2. a seeded perpendicular displacement along each span, which puts inlets and
 *    headlands back. Deterministic from the edge's own name, so it is stable
 *    across reloads and reviewable in a diff, not random per render.
 *
 * The whole thing is computed **per edge in canonical node order**, never per
 * ring. An interior seam is the same two nodes in both neighbours (see
 * regionShapes.ts); evaluating in sorted-key order and reversing the result for
 * the region that walks it backwards means both sides get byte-identical points,
 * so the slabs still cannot drift apart or z-fight along a shared edge. Smoothing
 * or displacing a ring in isolation would break that on every seam.
 *
 * Node degree decides the corner treatment: degree 2 (a coast or seam interior)
 * gets a Catmull-Rom tangent and passes through smoothly; degree 3+ (a triple
 * point where three regions meet) keeps its chord tangent and stays a corner.
 * They should — three coastlines meeting at a rounded blob is not a thing.
 */

import { BORDER_NODES, REGION_SHAPES, type BorderNode, type RegionShape } from "./regionShapes";

type Point = [number, number];

/** Samples per authored edge. Enough to carry the displacement's detail. */
const SEGMENTS = 10;
/** Peak coastline displacement, as a fraction of the span it sits on. */
const RELIEF = 0.1;

/** Undirected adjacency over every ring, so a node's neighbours are graph-wide. */
const NEIGHBOURS: ReadonlyMap<BorderNode, BorderNode[]> = (() => {
  const adjacency = new Map<BorderNode, Set<BorderNode>>();
  const link = (a: BorderNode, b: BorderNode) => {
    const set = adjacency.get(a) ?? new Set<BorderNode>();
    set.add(b);
    adjacency.set(a, set);
  };
  for (const shape of REGION_SHAPES) {
    const ring = shape.ring;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      link(a, b);
      link(b, a);
    }
  }
  return new Map([...adjacency].map(([key, set]) => [key, [...set].sort()]));
})();

/**
 * Outgoing tangent at `at` along the edge toward `to`, as a pure function of the
 * node pair. Reversing the edge negates it, which is exactly what a reversed
 * Hermite needs.
 */
function tangent(at: BorderNode, to: BorderNode): Point {
  const p = BORDER_NODES[at];
  const q = BORDER_NODES[to];
  const chord: Point = [q[0] - p[0], q[1] - p[1]];

  const neighbours = NEIGHBOURS.get(at);
  if (!neighbours || neighbours.length !== 2) return chord;

  const [before, after] = neighbours.map((key) => BORDER_NODES[key]);
  let t: Point = [(after[0] - before[0]) * 0.5, (after[1] - before[1]) * 0.5];
  // The sorted-neighbour order is arbitrary; point the tangent the way we travel.
  if (t[0] * chord[0] + t[1] * chord[1] < 0) t = [-t[0], -t[1]];

  // A node whose other arm is far longer than this edge would overshoot into a
  // visible loop. Clamp to the chord: the curve bulges, it never doubles back.
  const len = Math.hypot(t[0], t[1]);
  const chordLen = Math.hypot(chord[0], chord[1]);
  if (len > chordLen && len > 0) {
    t = [(t[0] * chordLen) / len, (t[1] * chordLen) / len];
  }
  return t;
}

/** FNV-1a over the canonical edge name: same coast every reload, every machine. */
function seedFor(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Two octaves of smooth value noise along the span, in -1..1. */
function relief(seed: number, t: number): number {
  let sum = 0;
  let amplitude = 1;
  let weight = 0;
  let frequency = 3;
  for (let octave = 0; octave < 2; octave++) {
    const x = t * frequency;
    const cell = Math.floor(x);
    const f = x - cell;
    const smooth = f * f * (3 - 2 * f);
    const a = rand(seed + cell * 131 + octave * 977) * 2 - 1;
    const b = rand(seed + (cell + 1) * 131 + octave * 977) * 2 - 1;
    sum += (a + (b - a) * smooth) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.4;
  }
  return sum / weight;
}

/**
 * One authored edge, subdivided, in canonical node order. Everything derived
 * from the edge itself, so the two regions that share it agree exactly.
 */
function canonicalEdge(lo: BorderNode, hi: BorderNode): Point[] {
  const p0 = BORDER_NODES[lo];
  const p1 = BORDER_NODES[hi];
  const m0 = tangent(lo, hi);
  const back = tangent(hi, lo);
  const m1: Point = [-back[0], -back[1]];
  const chordLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const seed = seedFor(`${lo}|${hi}`);

  const out: Point[] = [];
  for (let s = 0; s <= SEGMENTS; s++) {
    const t = s / SEGMENTS;
    const t2 = t * t;
    const t3 = t2 * t;
    let x =
      (2 * t3 - 3 * t2 + 1) * p0[0] +
      (t3 - 2 * t2 + t) * m0[0] +
      (-2 * t3 + 3 * t2) * p1[0] +
      (t3 - t2) * m1[0];
    let y =
      (2 * t3 - 3 * t2 + 1) * p0[1] +
      (t3 - 2 * t2 + t) * m0[1] +
      (-2 * t3 + 3 * t2) * p1[1] +
      (t3 - t2) * m1[1];

    // Tapered to zero at both ends, so the authored nodes stay exactly where
    // they were placed and the junctions stay sharp.
    const taper = Math.sin(Math.PI * t);
    if (taper > 0) {
      const dx =
        (6 * t2 - 6 * t) * p0[0] +
        (3 * t2 - 4 * t + 1) * m0[0] +
        (-6 * t2 + 6 * t) * p1[0] +
        (3 * t2 - 2 * t) * m1[0];
      const dy =
        (6 * t2 - 6 * t) * p0[1] +
        (3 * t2 - 4 * t + 1) * m0[1] +
        (-6 * t2 + 6 * t) * p1[1] +
        (3 * t2 - 2 * t) * m1[1];
      const len = Math.hypot(dx, dy) || 1;
      const push = relief(seed, t) * chordLen * RELIEF * taper;
      x += (dy / len) * push;
      y += (-dx / len) * push;
    }
    out.push([x, y]);
  }
  return out;
}

const EDGE_CACHE = new Map<string, Point[]>();

/** The subdivided polyline for one authored edge, travelled a -> b. */
export function smoothEdge(a: BorderNode, b: BorderNode): Point[] {
  const flipped = a > b;
  const key = flipped ? `${b}|${a}` : `${a}|${b}`;
  let canonical = EDGE_CACHE.get(key);
  if (!canonical) {
    canonical = flipped ? canonicalEdge(b, a) : canonicalEdge(a, b);
    EDGE_CACHE.set(key, canonical);
  }
  return flipped ? [...canonical].reverse() : canonical;
}

const RING_CACHE = new Map<string, Point[]>();

/** The ring as a closed coastline polyline in map-uv. Cached per region id. */
export function smoothRing(shape: RegionShape): Point[] {
  const hit = RING_CACHE.get(shape.id);
  if (hit) return hit;

  const ring = shape.ring;
  const out: Point[] = [];
  for (let i = 0; i < ring.length; i++) {
    // Drop each span's last sample: it is the next span's first.
    const span = smoothEdge(ring[i], ring[(i + 1) % ring.length]);
    for (let s = 0; s < span.length - 1; s++) out.push(span[s]);
  }

  RING_CACHE.set(shape.id, out);
  return out;
}

/** Graph degree of a node, exposed for the tests. */
export function nodeDegree(node: BorderNode): number {
  return NEIGHBOURS.get(node)?.length ?? 0;
}
