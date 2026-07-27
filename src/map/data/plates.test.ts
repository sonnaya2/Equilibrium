import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGION_IDS, type RegionId } from "@/league";
import { PLACE_ANCHORS, SITE_ANCHORS, rasterPlaceUv } from "./placeAnchors";
import { placeMapCoord } from "./gameCoords";
import { parsePlates, ringsFor, seamsFor, mapToWorld, type PlateFile } from "./plates";
import { MAP_BOUNDS, MAP_IMAGE, REGION_ANCHORS, uvToMap } from "./regionAnchors";
import { FIELD_TEXEL } from "../materials/shared";

/**
 * The board's geometry is generated (`npm run build:map`) and committed, so the
 * thing worth testing is not the algorithm but the artifact: does what we ship
 * still agree with the map it was cut from, and with the anchors drawn on it.
 *
 * These catch the failures that are invisible in a screenshot — an anchor that
 * has drifted off its own region, a border the two neighbours no longer agree
 * on, a field texture that was regenerated at a different size than the shader
 * samples it at.
 */

const PUBLIC = path.join(process.cwd(), "public");
const file: PlateFile = parsePlates(
  fs.readFileSync(path.join(PUBLIC, "map/region-plates.json"), "utf8"),
);

/** Even-odd, on flat [x, y, ...] map coordinates. */
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
    // parsePlates throws on a mismatch; assert the values too so a silently
    // widened crop cannot pass by also being edited here.
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
    // The crest and the camera both aim here. An anchor outside its plate means
    // the label floats over open water.
    for (const anchor of REGION_ANCHORS) {
      expect(inRegion(anchor.id, anchor.map), `${anchor.id} anchor is off its plate`).toBe(true);
    }
  });

  it("contains every place pin, bar the known offshore ones", () => {
    // Fishing Trawler sits on water Kandarin does not own — real coord, named not moved.
    // Lost Grove lives on the Tirannwn-owned island west of Isafdar (near Solak).
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
    // Site pins deliberately share a parent area's coordinate (the GWD generals,
    // the Menaphos rows). Two *areas* on one point would be a data error.
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
  /**
   * The border gate.
   *
   * Every other check here is about the geometry agreeing with itself. This one
   * is about it agreeing with the world: runescape.wiki states a `leagueRegion`
   * on most location infoboxes, and `npm run sync:map:coords` commits what it
   * said. If the partition drops a place inside the wrong plate, the frontier
   * between those two regions is drawn in the wrong place — which is invisible
   * in a screenshot and exactly the failure this route keeps having.
   *
   * Naming differs between the two sources; the aliases are a bridge, not a
   * judgement. Anything they do not cover is a real disagreement.
   */
  const ALIASES: Record<string, string[]> = {
    forinthry: ["wilderness", "forinthry"],
    desert: ["desert", "kharidiandesert"],
    fremennik: ["fremennik", "fremennikprovince", "fremenniks"],
  };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

  const sourced = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data/map/wiki-league-regions.json"), "utf8"),
  ) as { places: Record<string, string> };

  it("puts every place the wiki names inside that region's plate", () => {
    const wrong: string[] = [];
    for (const [key, stated] of Object.entries(sourced.places)) {
      const [region, area] = [key.slice(0, key.indexOf("/")), key.slice(key.indexOf("/") + 1)];
      // The tag itself is checked by the sync script; this is about geometry.
      if (!(ALIASES[region] ?? [region]).includes(norm(stated))) continue;
      const point = placeMapCoord(region as RegionId, area);
      if (!point) continue;
      // Sea pins and the known offshore pair are covered by their own test.
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
    // This is the no-cracks invariant, and the only direct test of it. Both
    // plates are cut along one canonical polyline, so a border point that is
    // missing from either side means the two have started to drift and a gap
    // will open the moment one of them rises.
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
    // TerrainMaterial steps by texels to read the coast gradient and the relief
    // slope; regenerating the field at another size silently changes both.
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
