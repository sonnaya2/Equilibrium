"use client";

/**
 * Where the named places are, on the board.
 *
 * Only ever for the region currently framed. Eleven regions' worth of markers at
 * once is 39 dots on a board two units wide, which is noise, not information —
 * and the reason to put them on the map at all is that you are looking at one
 * region and asking where its things sit relative to each other.
 *
 * Nothing here is focusable and nothing carries a region's accessible name: the
 * DOM inspector owns both, and a second match breaks Playwright strict mode.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { isRegionUnlocked } from "@/league";
import { useBuild } from "@/league/useBuild";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import { MAP_WORLD } from "./data/regionAnchors";
import { SHAPE_BY_ID } from "./data/regionShapes";
import { GEM_200, GEM_400 } from "./palette";
import { useMapFocus } from "./useMapFocus";

/** Matches the resting heights in RegionSlab. */
const RAISED_Y = 0.02;
const SUNKEN_Y = -0.024;
const FOCUS_LIFT = 0.028;

const OUTER = 0.018;
const INNER = 0.012;

export function PlaceMarkers() {
  const { build } = useBuild();
  const { focus, focusPlace } = useMapFocus();
  const invalidate = useThree((s) => s.invalidate);

  const shape = SHAPE_BY_ID.get(focus.region);
  const places = PLACES_BY_REGION.get(focus.region) ?? [];

  const materials = useMemo(() => {
    const base = new THREE.MeshBasicMaterial({
      color: GEM_400,
      transparent: true,
      opacity: 0.78,
      toneMapped: false,
      depthWrite: false,
    });
    const lit = new THREE.MeshBasicMaterial({
      color: GEM_200,
      toneMapped: false,
      depthWrite: false,
    });
    return { base, lit, dispose: () => [base, lit].forEach((m) => m.dispose()) };
  }, []);
  useEffect(() => () => materials.dispose(), [materials]);
  useEffect(() => invalidate(), [focus, invalidate]);

  if (!shape || !focus.framed || places.length === 0) return null;

  const y =
    (isRegionUnlocked(build, focus.region) ? RAISED_Y : SUNKEN_Y) +
    FOCUS_LIFT +
    shape.depth +
    // Clear of the extrude bevel, which sits outside the requested depth.
    0.011;

  return (
    <group>
      {places.map((place) => {
        const x = (place.uv[0] - 0.5) * MAP_WORLD.width;
        const z = (place.uv[1] - 0.5) * MAP_WORLD.height;
        const lit = focus.place === place.area;
        return (
          <group key={place.area} position={[x, y, z]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              material={lit ? materials.lit : materials.base}
              onPointerOver={(e) => {
                e.stopPropagation();
                focusPlace(place.area);
              }}
              onPointerOut={() => focusPlace(null)}
            >
              <ringGeometry args={[INNER, lit ? OUTER * 1.25 : OUTER, 16]} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={materials.lit} raycast={() => null}>
              <circleGeometry args={[0.0032, 10]} />
            </mesh>
            {lit ? (
              <Html position={[0, 0.03, 0]} center distanceFactor={1} zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
                <div aria-hidden="true" className="map-chip">
                  <span className="map-chip-name">{place.area}</span>
                </div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
