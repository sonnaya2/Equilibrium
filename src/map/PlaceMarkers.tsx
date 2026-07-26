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
 *
 * Picking is deliberate about which mesh is pickable. The ring and the centre
 * dot opt out with `raycast={() => null}`; one invisible disc, wider than the
 * art, is the whole hit target. The disc uses `colorWrite: false` rather than
 * `visible={false}` — three's raycaster skips invisible objects outright, so the
 * obvious spelling produces a marker that still cannot be clicked. That, plus a
 * ring band under 2px once foreshortened, is why these were dead.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { Html } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { isRegionUnlocked } from "@/league";
import { useBuild } from "@/league/useBuild";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import { MAP_WORLD } from "./data/regionAnchors";
import { SHAPE_BY_ID } from "./data/regionShapes";
import { GEM_200, GEM_400 } from "./palette";
import { FOCUS_LIFT, RAISED_Y, SUNKEN_Y } from "./slabHeight";
import { useMapFocus } from "./useMapFocus";

const OUTER = 0.018;
const INNER = 0.012;
/** ~2.5x the visible ring. At the full-viewport canvas that is a ~24px target,
 *  against the ~2px annulus band it replaces. */
const PICK_RADIUS = 0.03;

export function PlaceMarkers() {
  const { build } = useBuild();
  const { focus, selectPlace, hoverPlace } = useMapFocus();
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
    // Draws nothing and occludes nothing; exists purely to be hit.
    const pick = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    return { base, lit, pick, dispose: () => [base, lit, pick].forEach((m) => m.dispose()) };
  }, []);
  useEffect(() => () => materials.dispose(), [materials]);

  // Three shared geometries for the whole region, scaled per marker for the lit
  // and selected states. Inline <ringGeometry> props rebuilt one geometry per
  // marker on every hover — with sites added that is ~25 allocations a frame.
  const geo = useMemo(() => {
    const disc = new THREE.CircleGeometry(PICK_RADIUS, 16);
    const ring = new THREE.RingGeometry(INNER, OUTER, 16);
    const dot = new THREE.CircleGeometry(0.0032, 10);
    return { disc, ring, dot, dispose: () => [disc, ring, dot].forEach((g) => g.dispose()) };
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => invalidate(), [focus, invalidate]);
  // Pointer-out can miss when the canvas unmounts mid-hover.
  useEffect(
    () => () => {
      document.body.style.cursor = "auto";
    },
    [],
  );

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
        const selected = focus.place === place.area;
        const lit = selected || focus.hover === place.area;
        const over = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          hoverPlace(place.area);
          document.body.style.cursor = "pointer";
        };
        const out = () => {
          hoverPlace(null);
          document.body.style.cursor = "auto";
        };
        // stopPropagation is the fix for the second defect: without it the click
        // fell through to the slab under the marker, which used to toggle the
        // region — so poking at a place quietly edited the build.
        const click = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          selectPlace(selected ? null : place.area);
        };
        return (
          <group key={`${place.region}:${place.area}`} position={[x, y, z]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={geo.disc}
              material={materials.pick}
              onClick={click}
              onPointerOver={over}
              onPointerOut={out}
            />
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={geo.ring}
              material={lit ? materials.lit : materials.base}
              scale={lit ? (selected ? 1.4 : 1.25) : 1}
              raycast={() => null}
            />
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={geo.dot}
              material={materials.lit}
              scale={selected ? 1.55 : 1}
              raycast={() => null}
            />
            {lit ? (
              <Html position={[0, 0.03, 0]} center distanceFactor={1} zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
                <div aria-hidden="true" className={`map-chip${selected ? " map-chip-pinned" : ""}`}>
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
