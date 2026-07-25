import { describe, expect, it } from "vitest";
import { nodeDegree, smoothEdge, smoothRing } from "./regionCurve";
import { BORDER_NODES, REGION_SHAPES, ringEdges, signedArea, type BorderNode } from "./regionShapes";

/** Proper segment intersection; endpoint sharing is the caller's problem. */
function segmentsCross(
  a1: readonly [number, number],
  a2: readonly [number, number],
  b1: readonly [number, number],
  b2: readonly [number, number],
): boolean {
  const d = (o: readonly [number, number], p: readonly [number, number], q: readonly [number, number]) =>
    (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

describe("regionCurve", () => {
  it("subdivides every ring without moving its authored nodes", () => {
    for (const shape of REGION_SHAPES) {
      const smooth = smoothRing(shape);
      expect(smooth.length, shape.id).toBe(shape.ring.length * 10);
      // Every authored node survives untouched, at a stride of one edge: the
      // curve interpolates the hand-placed coastline rather than approximating it.
      shape.ring.forEach((key, i) => {
        const [x, y] = BORDER_NODES[key];
        expect(smooth[i * 10][0], `${shape.id}:${key} x`).toBeCloseTo(x, 12);
        expect(smooth[i * 10][1], `${shape.id}:${key} y`).toBeCloseTo(y, 12);
      });
    }
  });

  it("gives both neighbours of a shared seam the identical polyline, reversed", () => {
    // This is the whole reason smoothing runs on the graph and not on the ring.
    const seen = new Map<string, [BorderNode, BorderNode][]>();
    for (const shape of REGION_SHAPES) {
      for (const [a, b] of ringEdges(shape)) {
        const key = [a, b].sort().join("|");
        seen.set(key, [...(seen.get(key) ?? []), [a, b]]);
      }
    }
    let shared = 0;
    for (const [key, uses] of seen) {
      if (uses.length !== 2) continue;
      shared++;
      const forward = smoothEdge(uses[0][0], uses[0][1]);
      const backward = smoothEdge(uses[1][0], uses[1][1]).reverse();
      expect(forward.length, key).toBe(backward.length);
      forward.forEach((p, i) => {
        expect(p[0], `${key} x@${i}`).toBeCloseTo(backward[i][0], 12);
        expect(p[1], `${key} y@${i}`).toBeCloseTo(backward[i][1], 12);
      });
    }
    expect(shared, "the mainland has interior seams to check").toBeGreaterThan(10);
  });

  it("keeps junctions where three regions meet as corners", () => {
    // Degree 3+ means the tangent falls back to the chord, so the node stays a
    // corner. Three coastlines meeting at a rounded blob is not a thing.
    const users = new Map<BorderNode, Set<string>>();
    for (const shape of REGION_SHAPES) {
      for (const node of shape.ring) {
        users.set(node, (users.get(node) ?? new Set()).add(shape.id));
      }
    }
    let junctions = 0;
    for (const [node, owners] of users) {
      expect(nodeDegree(node), node).toBeGreaterThanOrEqual(2);
      if (owners.size < 3) continue;
      junctions++;
      expect(nodeDegree(node), `${node} is a ${owners.size}-region junction`).toBeGreaterThanOrEqual(3);
    }
    expect(junctions, "the mainland has triple points").toBeGreaterThan(0);
  });

  it("never lets a ring cross a region it shares no border with", () => {
    // Adjacent mainland regions are a partition and share their edges exactly,
    // so they are excluded — they touch by construction. Everything else must
    // be disjoint, which is really a test about the islands: Karamja's ring
    // used to run under Kandarin's southern coast, invisible on the 3D board
    // because the slabs sit at different heights, and plainly wrong on the flat
    // one where Kandarin's polygon painted over Karamja's crest and count.
    const rings = REGION_SHAPES.map((s) => ({ id: s.id, nodes: new Set<string>(s.ring), pts: smoothRing(s) }));
    for (let i = 0; i < rings.length; i++) {
      for (let j = i + 1; j < rings.length; j++) {
        const a = rings[i];
        const b = rings[j];
        if ([...a.nodes].some((n) => b.nodes.has(n))) continue;
        for (let x = 0; x < a.pts.length; x++) {
          for (let y = 0; y < b.pts.length; y++) {
            expect(
              segmentsCross(
                a.pts[x],
                a.pts[(x + 1) % a.pts.length],
                b.pts[y],
                b.pts[(y + 1) % b.pts.length],
              ),
              `${a.id} crosses ${b.id}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("keeps the smoothed rings wound and non-self-intersecting", () => {
    for (const shape of REGION_SHAPES) {
      const pts = smoothRing(shape);
      expect(signedArea(pts), shape.id).toBeGreaterThan(0);
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if ((j + 1) % n === i || (i + 1) % n === j) continue;
          expect(
            segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]),
            `${shape.id} edges ${i}/${j}`,
          ).toBe(false);
        }
      }
    }
  });
});
