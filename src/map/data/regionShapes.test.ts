import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import {
  BORDER_NODES,
  REGION_SHAPES,
  ringEdges,
  ringPoints,
  signedArea,
  type BorderNode,
} from "./regionShapes";

/** Proper segment intersection (endpoint sharing handled by the caller). */
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

function pointInRing(point: readonly [number, number], ring: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

describe("regionShapes partition", () => {
  it("covers all 11 region ids exactly once", () => {
    expect(REGION_SHAPES.map((s) => s.id).sort()).toEqual([...REGION_IDS].sort());
  });

  it("resolves every ring key in BORDER_NODES", () => {
    for (const shape of REGION_SHAPES) {
      for (const key of shape.ring) {
        expect(BORDER_NODES[key], `${shape.id}:${key}`).toBeDefined();
      }
      expect(shape.ring.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps every ring on one consistent winding (clockwise in uv, y south)", () => {
    for (const shape of REGION_SHAPES) {
      expect(signedArea(ringPoints(shape)), shape.id).toBeGreaterThan(0);
    }
  });

  it("has no duplicate nodes within a ring", () => {
    for (const shape of REGION_SHAPES) {
      expect(new Set(shape.ring).size, shape.id).toBe(shape.ring.length);
    }
  });

  it("keeps every ring non-self-intersecting", () => {
    for (const shape of REGION_SHAPES) {
      const pts = ringPoints(shape);
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          // Skip edges that share an endpoint, including the wrap-around pair.
          if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
          const a1 = pts[i];
          const a2 = pts[(i + 1) % n];
          const b1 = pts[j];
          const b2 = pts[(j + 1) % n];
          expect(segmentsCross(a1, a2, b1, b2), `${shape.id} edges ${i}/${j}`).toBe(false);
        }
      }
    }
  });

  it("shares every interior edge between exactly two rings, reversed", () => {
    const directed = new Map<string, { shape: string; dir: string }[]>();
    for (const shape of REGION_SHAPES) {
      for (const [a, b] of ringEdges(shape)) {
        const key = [a, b].sort().join("|");
        const list = directed.get(key) ?? [];
        list.push({ shape: shape.id, dir: `${a}>${b}` });
        directed.set(key, list);
      }
    }
    for (const [key, uses] of directed) {
      expect(uses.length, key).toBeLessThanOrEqual(2);
      if (uses.length === 2) {
        expect(uses[0].shape, key).not.toBe(uses[1].shape);
        const [a, b] = key.split("|") as [BorderNode, BorderNode];
        const dirs = uses.map((u) => u.dir);
        expect(
          dirs.includes(`${a}>${b}`) && dirs.includes(`${b}>${a}`),
          `edge ${key} must run both ways`,
        ).toBe(true);
      }
    }
  });

  it("never shares a node between rings that do not border", () => {
    // Bordering = sharing an edge or meeting at a designated triple point (t_*).
    const edgePartners = new Map<string, Set<string>>();
    for (const shape of REGION_SHAPES) {
      for (const [a, b] of ringEdges(shape)) {
        const key = [a, b].sort().join("|");
        edgePartners.set(key, (edgePartners.get(key) ?? new Set()).add(shape.id));
      }
    }
    const nodeUsers = new Map<BorderNode, Set<string>>();
    for (const shape of REGION_SHAPES) {
      for (const key of shape.ring) {
        nodeUsers.set(key, (nodeUsers.get(key) ?? new Set()).add(shape.id));
      }
    }
    for (const [node, users] of nodeUsers) {
      if (users.size <= 1) continue;
      // Islands must be fully disjoint from every other ring.
      const island = node.startsWith("k_") || node.startsWith("a_") || node.startsWith("h_");
      expect(island, `${node} shared by ${[...users]}`).toBe(false);
      // Mainland nodes are shared by 2-3 rings (edge or triple junction).
      expect(users.size, node).toBeLessThanOrEqual(3);
    }
  });

  it("places every marker inside its own ring", () => {
    for (const shape of REGION_SHAPES) {
      expect(pointInRing(shape.markerUv, ringPoints(shape)), shape.id).toBe(true);
    }
  });
});
