"use client";

/**
 * Proof that the geometry agrees with the map — `/map?debugGeometry=1`.
 *
 * Everything the board is built from, drawn flat over the raster it was cut
 * from: the plate outlines, the shared seams, the region anchors and every place
 * pin. If an outline does not sit on a coast here, the fix is the geometry, and
 * no amount of lighting will hide it. Pair with `?topDown=1` to compare against
 * the raster without perspective in the way.
 *
 * Dev aid, not a feature: no styling, no controls, and it only exists when the
 * query flag asks for it.
 */

import { useEffect, useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three/webgpu";
import { REGION_IDS, type RegionId } from "@/league";
import { PLACE_ANCHORS, SITE_ANCHORS, rasterPlaceUv } from "./data/placeAnchors";
import type { PlateFile, SeamPath } from "./data/plates";
import { ringsFor } from "./data/plates";
import { MAP_IMAGE, MAP_WORLD, REGION_ANCHORS, anchorWorld } from "./data/regionAnchors";

const HUES = [
  0xff6060, 0x60ffa0, 0xffd050, 0x78b0ff, 0xff80dc, 0x80ffff, 0xffa040, 0xb0ff60, 0xe080ff,
  0x60d080, 0xff60b0,
];
const Y_RASTER = -0.002;
const Y_RING = 0.001;
const Y_SEAM = 0.0025;

function lineGeometry(points: [number, number][], y: number, closed: boolean) {
  const positions: number[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    positions.push(a[0], y, a[1], b[0], y, b[1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function MapDebug({
  plates,
  seams,
  albedo,
}: {
  plates: PlateFile;
  seams: SeamPath[];
  albedo: THREE.Texture;
}) {
  const built = useMemo(() => {
    const rings = REGION_IDS.map((id, index) => ({
      id,
      colour: HUES[index % HUES.length],
      geometries: ringsFor(plates, id as RegionId).map((ring) =>
        lineGeometry(ring.points, Y_RING, true),
      ),
    }));
    const seamGeometries = seams.map((seam) => lineGeometry(seam.points, Y_SEAM, false));
    return { rings, seamGeometries };
  }, [plates, seams]);

  useEffect(
    () => () => {
      for (const region of built.rings) for (const g of region.geometries) g.dispose();
      for (const g of built.seamGeometries) g.dispose();
    },
    [built],
  );

  const places = useMemo(
    () =>
      [...PLACE_ANCHORS, ...SITE_ANCHORS].map((place) => {
        const uv = rasterPlaceUv(place);
        return {
          key: `${place.region}:${place.area}`,
          x: (uv[0] - 0.5) * MAP_WORLD.width,
          z: (uv[1] - 0.5) * MAP_WORLD.height,
          site: place.site === true,
        };
      }),
    [],
  );
  const dot = useMemo(() => new THREE.SphereGeometry(0.0035, 6, 4), []);
  useEffect(() => () => dot.dispose(), [dot]);

  return (
    <group>
      {/* The source of truth, laid flat under everything it produced. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, Y_RASTER, 0]} raycast={() => null}>
        <planeGeometry args={[MAP_WORLD.width, MAP_WORLD.height]} />
        <meshBasicMaterial map={albedo} toneMapped={false} />
      </mesh>

      {built.rings.map((region) =>
        region.geometries.map((geometry, i) => (
          <lineSegments key={`${region.id}:${i}`} geometry={geometry} raycast={() => null}>
            <lineBasicMaterial color={region.colour} toneMapped={false} depthTest={false} />
          </lineSegments>
        )),
      )}

      {built.seamGeometries.map((geometry, i) => (
        <lineSegments key={`seam:${i}`} geometry={geometry} raycast={() => null}>
          <lineBasicMaterial color={0xffffff} toneMapped={false} depthTest={false} />
        </lineSegments>
      ))}

      {places.map((place) => (
        <mesh key={place.key} geometry={dot} position={[place.x, Y_SEAM, place.z]} raycast={() => null}>
          <meshBasicMaterial color={place.site ? 0xffb020 : 0x20ffe0} toneMapped={false} />
        </mesh>
      ))}

      {REGION_ANCHORS.map((region) => {
        const [x, z] = anchorWorld(region.uv);
        return (
          <Html key={region.id} position={[x, 0.02, z]} center style={{ pointerEvents: "none" }}>
            <div
              aria-hidden="true"
              style={{
                font: "600 11px/1 ui-monospace, monospace",
                color: "#0b0b0b",
                background: "#f5e7c8",
                padding: "2px 4px",
                whiteSpace: "nowrap",
              }}
            >
              {region.id}
            </div>
          </Html>
        );
      })}

      <Html position={[0, 0.06, -MAP_WORLD.height * 0.52]} center style={{ pointerEvents: "none" }}>
        <div
          aria-hidden="true"
          style={{
            font: "600 11px/1.5 ui-monospace, monospace",
            color: "#f5e7c8",
            background: "#0b0b0bcc",
            padding: "6px 8px",
            whiteSpace: "pre",
          }}
        >
          {`debugGeometry · ${MAP_IMAGE.width}x${MAP_IMAGE.height} map units\n` +
            `${built.rings.reduce((n, r) => n + r.geometries.length, 0)} rings · ${seams.length} seams · ${places.length} pins`}
        </div>
      </Html>
    </group>
  );
}
