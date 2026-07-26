/**
 * The interior borders — where two land masses actually meet.
 *
 * An edge that appears in exactly one ring is coastline; an edge shared by two
 * rings is a seam, and it is the same two authored nodes in both. That is what
 * lets vines sit *on* the border rather than near it: `smoothEdge` is computed
 * per edge in canonical node order, so both neighbours agree byte for byte.
 *
 * Consecutive shared edges between the same pair of regions are stitched into
 * one polyline, so a vine can run the whole length of a border in one growth
 * rather than restarting at every authored node.
 */

import type { RegionId } from "@/league";
import { smoothEdge } from "./regionCurve";
import { REGION_SHAPES, type BorderNode } from "./regionShapes";

export interface Seam {
  between: readonly [RegionId, RegionId];
  /** Subdivided border curve in map-uv, start to end. */
  points: readonly (readonly [number, number])[];
}

function edgeKey(a: BorderNode, b: BorderNode) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export const SEAMS: readonly Seam[] = (() => {
  // Which regions claim each authored edge.
  const owners = new Map<string, { a: BorderNode; b: BorderNode; regions: RegionId[] }>();
  for (const shape of REGION_SHAPES) {
    const ring = shape.ring;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const key = edgeKey(a, b);
      const hit = owners.get(key);
      if (hit) hit.regions.push(shape.id);
      else owners.set(key, { a: a < b ? a : b, b: a < b ? b : a, regions: [shape.id] });
    }
  }

  const shared = [...owners.values()].filter((e) => e.regions.length === 2);

  // Group by the unordered region pair, then chain edges that touch end to end.
  const byPair = new Map<string, typeof shared>();
  for (const edge of shared) {
    const pair = [...edge.regions].sort().join("|");
    byPair.set(pair, [...(byPair.get(pair) ?? []), edge]);
  }

  const out: Seam[] = [];
  for (const [pair, edges] of byPair) {
    const [left, right] = pair.split("|") as [RegionId, RegionId];
    const remaining = [...edges];
    while (remaining.length > 0) {
      const first = remaining.shift()!;
      const chain: BorderNode[] = [first.a, first.b];
      // Extend from both ends until nothing else connects.
      let grew = true;
      while (grew) {
        grew = false;
        for (let i = 0; i < remaining.length; i++) {
          const e = remaining[i];
          const head = chain[0];
          const tail = chain[chain.length - 1];
          if (e.a === tail) chain.push(e.b);
          else if (e.b === tail) chain.push(e.a);
          else if (e.a === head) chain.unshift(e.b);
          else if (e.b === head) chain.unshift(e.a);
          else continue;
          remaining.splice(i, 1);
          grew = true;
          break;
        }
      }
      const points: [number, number][] = [];
      for (let i = 0; i < chain.length - 1; i++) {
        const span = smoothEdge(chain[i], chain[i + 1]);
        // Drop each span's last sample: it is the next span's first.
        const stop = i === chain.length - 2 ? span.length : span.length - 1;
        for (let s = 0; s < stop; s++) points.push(span[s]);
      }
      if (points.length >= 2) out.push({ between: [left, right], points });
    }
  }
  return out;
})();
