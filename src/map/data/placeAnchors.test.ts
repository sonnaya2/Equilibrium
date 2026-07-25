import { describe, expect, it } from "vitest";
import { getResearchCatalog } from "@/research/catalog";
import { PLACE_ANCHORS, PLACES_BY_REGION } from "./placeAnchors";
import { smoothRing } from "./regionCurve";
import { SHAPE_BY_ID } from "./regionShapes";

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

const AREAS_BY_REGION = new Map(
  getResearchCatalog().regions.map((region) => [region.id, region.areas]),
);

describe("placeAnchors", () => {
  it("names only areas the catalog already carries", () => {
    // Anchors are positions for facts we hold. A name that does not resolve is
    // an invented place, which is the one thing this repo never ships.
    for (const anchor of PLACE_ANCHORS) {
      const areas = AREAS_BY_REGION.get(anchor.region);
      expect(areas, anchor.region).toBeDefined();
      expect(areas, `${anchor.region}/${anchor.area}`).toContain(anchor.area);
    }
  });

  it("lands every anchor inside its own region ring", () => {
    for (const anchor of PLACE_ANCHORS) {
      const shape = SHAPE_BY_ID.get(anchor.region);
      expect(shape, anchor.region).toBeDefined();
      expect(
        pointInRing(anchor.uv, smoothRing(shape!)),
        `${anchor.region}/${anchor.area} at ${anchor.uv}`,
      ).toBe(true);
    }
  });

  it("has no duplicate area per region", () => {
    for (const [region, anchors] of PLACES_BY_REGION) {
      const names = anchors.map((a) => a.area);
      expect(new Set(names).size, region).toBe(names.length);
    }
  });
});
