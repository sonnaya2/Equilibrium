import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGION_IDS, type RegionId } from "@/league";
import { PLACE_ANCHORS, SITE_ANCHORS, rasterPlaceUv } from "./placeAnchors";
import { placeMapCoord } from "./gameCoords";
import { parsePlates, ringsFor, seamsFor, mapToWorld, type PlateFile } from "./plates";
import { MAP_BOUNDS, MAP_IMAGE, REGION_ANCHORS, uvToMap } from "./regionAnchors";
import { FIELD_TEXEL } from "../materials/shared";


const PUBLIC = path.join(process.cwd(), "public");
const file: PlateFile = parsePlates(
  fs.readFileSync(path.join(PUBLIC, "map/region-plates.json"), "utf8"),
);

function inRing(px: number, py: number, flat: number[]): boolean {
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

const inRegion = (region: string, [x, y]: readonly [number, number]) =>
  (file.regions[region]?.rings ?? []).some((ring) => inRing(x, y, ring));

describe("region plates", () => {
  it("was cut against the current MAP_BOUNDS", () => {
    expect(file.bounds).toEqual({
      minX: MAP_BOUNDS.minX,
      minY: MAP_BOUNDS.minY,
      maxX: MAP_BOUNDS.maxX,
      maxY: MAP_BOUNDS.maxY,
    });
  });

  it("covers all eleven regions with real geometry", () => {
    expect(Object.keys(file.regions).sort()).toEqual([...REGION_IDS].sort());
    for (const id of REGION_IDS) {
      const rings = file.regions[id].rings;
      expect(rings.length, id).toBeGreaterThan(0);
      for (const ring of rings) {
        expect(ring.length % 2, `${id} ring is not a flat xy list`).toBe(0);
        expect(ring.length / 2, `${id} ring is degenerate`).toBeGreaterThanOrEqual(3);
      }
      expect(file.regions[id].area, id).toBeGreaterThan(1000);
    }
  });

  it("keeps every ring inside the map", () => {
    for (const id of REGION_IDS) {
      for (const ring of file.regions[id].rings) {
        for (let i = 0; i < ring.length; i += 2) {
          expect(ring[i]).toBeGreaterThanOrEqual(MAP_BOUNDS.minX);
          expect(ring[i]).toBeLessThanOrEqual(MAP_BOUNDS.maxX);
          expect(ring[i + 1]).toBeGreaterThanOrEqual(MAP_BOUNDS.minY);
          expect(ring[i + 1]).toBeLessThanOrEqual(MAP_BOUNDS.maxY);
        }
      }
    }
  });

  it("contains every region's own anchor", () => {
    for (const anchor of REGION_ANCHORS) {
      expect(inRegion(anchor.id, anchor.map), `${anchor.id} anchor is off its plate`).toBe(true);
    }
  });

  it("contains every place pin, bar the known offshore ones", () => {
    const OFFSHORE = new Set(["kandarin/Fishing Trawler"]);
    const stray: string[] = [];
    for (const place of [...PLACE_ANCHORS, ...SITE_ANCHORS]) {
      const point = placeMapCoord(place.region, place.area);
      expect(point, `${place.region}/${place.area} has no coordinate`).toBeDefined();
      const key = `${place.region}/${place.area}`;
      if (!inRegion(place.region, point!) && !OFFSHORE.has(key)) stray.push(key);
    }
    expect(stray).toEqual([]);
  });

  it("never lands two named areas on one point", () => {
    const seen = new Map<string, string>();
    for (const place of PLACE_ANCHORS) {
      const point = placeMapCoord(place.region, place.area)!;
      const key = `${place.region}:${point[0]},${point[1]}`;
      expect(seen.get(key), `${place.area} sits exactly on ${seen.get(key)}`).toBeUndefined();
      seen.set(key, place.area);
    }
  });
});

describe("region membership against the wiki", () => {
  const ALIASES: Record<string, string[]> = {
    forinthry: ["wilderness", "forinthry"],
    desert: ["desert", "kharidiandesert"],
    fremennik: ["fremennik", "fremennikprovince", "fremenniks"],
  };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

  const sourced = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "public/data/v2/documents/map/wiki-league-regions.json"),
      "utf8",
    ),
  ) as { places: Record<string, string> };

  it("puts every place the wiki names inside that region's plate", () => {
    const wrong: string[] = [];
    for (const [key, stated] of Object.entries(sourced.places)) {
      const [region, area] = [key.slice(0, key.indexOf("/")), key.slice(key.indexOf("/") + 1)];
      if (!(ALIASES[region] ?? [region]).includes(norm(stated))) continue;
      const point = placeMapCoord(region as RegionId, area);
      if (!point) continue;
      if (!inRegion(region, point) && Object.keys(file.regions).some((r) => inRegion(r, point))) {
        const actual = Object.keys(file.regions).find((r) => inRegion(r, point));
        wrong.push(`${key} is on ${actual}'s plate`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe("shared borders", () => {
  const pointSets = new Map<string, Set<string>>(
    REGION_IDS.map((id) => [
      id,
      new Set(
        file.regions[id].rings.flatMap((ring) => {
          const out: string[] = [];
          for (let i = 0; i < ring.length; i += 2) out.push(`${ring[i]},${ring[i + 1]}`);
          return out;
        }),
      ),
    ]),
  );

  it("names two distinct real regions per seam", () => {
    expect(file.seams.length).toBeGreaterThan(6);
    for (const seam of file.seams) {
      const [a, b] = seam.between;
      expect(REGION_IDS).toContain(a);
      expect(REGION_IDS).toContain(b);
      expect(a).not.toBe(b);
      expect(seam.points.length / 2).toBeGreaterThanOrEqual(3);
    }
  });

  it("puts every seam point in both neighbours' plates", () => {
    for (const seam of file.seams) {
      const [a, b] = seam.between;
      const missing: string[] = [];
      for (let i = 0; i < seam.points.length; i += 2) {
        const key = `${seam.points[i]},${seam.points[i + 1]}`;
        if (!pointSets.get(a)!.has(key) || !pointSets.get(b)!.has(key)) missing.push(key);
      }
      expect(missing, `${a}|${b} border is not shared at ${missing.length} points`).toEqual([]);
    }
  });
});

describe("generated field texture", () => {
  it("was written, and at the size the shaders sample it at", () => {
    expect(fs.existsSync(path.join(PUBLIC, file.field.url.replace(/^\//, "")))).toBe(true);
    expect(file.field.width).toBe(MAP_IMAGE.width / 2);
    expect(file.field.height).toBe(MAP_IMAGE.height / 2);
    expect(FIELD_TEXEL).toBeCloseTo(1 / file.field.width, 10);
  });

  it("ships the raster the board is textured from", () => {
    expect(fs.existsSync(path.join(PUBLIC, MAP_IMAGE.src.replace(/^\//, "")))).toBe(true);
  });
});

describe("world transform", () => {
  it("agrees with the uv path both anchors use", () => {
    for (const place of PLACE_ANCHORS) {
      const uv = rasterPlaceUv(place);
      const viaUv: [number, number] = [(uv[0] - 0.5) * 2, (uv[1] - 0.5) * ((2 * 2048) / 3072)];
      const viaMap = mapToWorld(uvToMap(uv));
      expect(viaMap[0]).toBeCloseTo(viaUv[0], 9);
      expect(viaMap[1]).toBeCloseTo(viaUv[1], 9);
    }
  });

  it("puts the map corners on the board corners", () => {
    expect(mapToWorld([MAP_BOUNDS.minX, MAP_BOUNDS.maxY])[0]).toBeCloseTo(-1, 9);
    expect(mapToWorld([MAP_BOUNDS.maxX, MAP_BOUNDS.minY])[0]).toBeCloseTo(1, 9);
  });

  it("loads rings and seams into world space without loss", () => {
    const rings = ringsFor(file, "misthalin" as RegionId);
    expect(rings.length).toBeGreaterThan(0);
    expect(rings[0].points.length).toBeGreaterThan(3);
    expect(seamsFor(file).length).toBe(file.seams.length);
  });
});
