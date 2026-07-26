import { describe, expect, it } from "vitest";
import type { RegionId } from "@/league";
import { getResearchCatalog } from "@/research/catalog";
import { PLACE_ANCHORS, PLACES_BY_REGION, SITE_ANCHORS } from "./placeAnchors";
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

/** Every content + upgrade row name a region carries, lowercased. */
const ROWS_BY_REGION = new Map(
  getResearchCatalog().regions.map((region) => [
    region.id,
    [...region.content.map((c) => c.name), ...region.upgrades.map((u) => u.name)].map((n) =>
      n.toLowerCase(),
    ),
  ]),
);

/** Catalog areas with no PLACE_ANCHORS entry, grouped by region. */
export function unanchoredAreasByRegion(): Map<RegionId, string[]> {
  const out = new Map<RegionId, string[]>();
  for (const [region, areas] of AREAS_BY_REGION) {
    const anchored = new Set((PLACES_BY_REGION.get(region as RegionId) ?? []).map((a) => a.area));
    const missing = areas.filter((area) => !anchored.has(area));
    if (missing.length > 0) out.set(region as RegionId, missing);
  }
  return out;
}

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

  it("names only sites some content or upgrade row actually mentions", () => {
    // The site half of the same rule: a pin has to be a position for a fact we
    // already hold. A site nothing references is a place we invented.
    for (const anchor of SITE_ANCHORS) {
      const rows = ROWS_BY_REGION.get(anchor.region);
      expect(rows, anchor.region).toBeDefined();
      expect(
        rows!.some((row) => row.includes(anchor.area.toLowerCase())),
        `${anchor.region}/${anchor.area} is named by no content or upgrade row`,
      ).toBe(true);
    }
  });

  it("lands every anchor inside its own region ring", () => {
    for (const anchor of [...PLACE_ANCHORS, ...SITE_ANCHORS]) {
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

  it("anchors every catalog area (inventory of gaps)", () => {
    // After the place-anchor expansion pass, every catalog area is a real place
    // with a board position. If a new area is added without an anchor, this
    // fails with the region → missing list rather than silently dropping it.
    const gaps = unanchoredAreasByRegion();
    expect(Object.fromEntries(gaps), "unanchored catalog areas").toEqual({});
  });
});
