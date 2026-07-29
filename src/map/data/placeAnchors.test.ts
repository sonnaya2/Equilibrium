import { describe, expect, it } from "vitest";
import type { RegionId } from "@/league";
import { getResearchCatalog } from "@/research/catalog";
import {
  MAP_OMITTED_AREAS,
  PLACE_ANCHORS,
  PLACES_BY_REGION,
  SITE_ANCHORS,
  rasterPlaceUv,
} from "./placeAnchors";
import { placeMapCoord } from "./gameCoords";

const AREAS_BY_REGION = new Map(
  getResearchCatalog().regions.map((region) => [region.id, region.areas]),
);

const ROWS_BY_REGION = new Map(
  getResearchCatalog().regions.map((region) => [
    region.id,
    [...region.content.map((c) => c.name), ...region.upgrades.map((u) => u.name)].map((n) =>
      n.toLowerCase(),
    ),
  ]),
);

export function unanchoredAreasByRegion(): Map<RegionId, string[]> {
  const out = new Map<RegionId, string[]>();
  for (const [region, areas] of AREAS_BY_REGION) {
    const anchored = new Set((PLACES_BY_REGION.get(region as RegionId) ?? []).map((a) => a.area));
    const missing = areas.filter((area) => !anchored.has(area) && !MAP_OMITTED_AREAS.has(area));
    if (missing.length > 0) out.set(region as RegionId, missing);
  }
  return out;
}

describe("placeAnchors", () => {
  it("names only areas the catalog already carries", () => {
    for (const anchor of PLACE_ANCHORS) {
      const areas = AREAS_BY_REGION.get(anchor.region);
      expect(areas, anchor.region).toBeDefined();
      expect(areas, `${anchor.region}/${anchor.area}`).toContain(anchor.area);
    }
  });

  it("names only sites some content or upgrade row actually mentions", () => {
    for (const anchor of SITE_ANCHORS) {
      const rows = ROWS_BY_REGION.get(anchor.region);
      expect(rows, anchor.region).toBeDefined();
      expect(
        rows!.some((row) => row.includes(anchor.area.toLowerCase())),
        `${anchor.region}/${anchor.area} is named by no content or upgrade row`,
      ).toBe(true);
    }
  });

  it("projects every anchor into the raster coordinate space", () => {
    for (const anchor of [...PLACE_ANCHORS, ...SITE_ANCHORS]) {
      const [u, v] = rasterPlaceUv(anchor);
      expect(u, `${anchor.region}/${anchor.area} x`).toBeGreaterThanOrEqual(0);
      expect(u, `${anchor.region}/${anchor.area} x`).toBeLessThanOrEqual(1);
      expect(v, `${anchor.region}/${anchor.area} y`).toBeGreaterThanOrEqual(0);
      expect(v, `${anchor.region}/${anchor.area} y`).toBeLessThanOrEqual(1);
    }
  });

  it("gives every rendered POI a map coordinate", () => {
    for (const anchor of [...PLACE_ANCHORS, ...SITE_ANCHORS]) {
      expect(
        placeMapCoord(anchor.region, anchor.area),
        `${anchor.region}/${anchor.area}`,
      ).toBeDefined();
    }
  });

  it("has no duplicate area per region", () => {
    for (const [region, anchors] of PLACES_BY_REGION) {
      const names = anchors.map((a) => a.area);
      expect(new Set(names).size, region).toBe(names.length);
    }
  });

  it("anchors every catalog area (inventory of gaps)", () => {
    const gaps = unanchoredAreasByRegion();
    expect(Object.fromEntries(gaps), "unanchored catalog areas").toEqual({});
  });
});
