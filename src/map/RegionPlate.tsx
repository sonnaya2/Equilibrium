"use client";

/**
 * Extruded region geometry generated from coastline rings. Plate clicks change
 * focus only; build picks remain explicit ledger or inspector actions.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { isRegionUnlocked, type RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { MAP_WORLD, REGION_ANCHOR_BY_ID, anchorUvToShader } from "./data/regionAnchors";
import type { PlateRing } from "./data/plates";
import { createTerrainMaterials } from "./materials/TerrainMaterial";
import type { MapFlags } from "./mapQuality";
import { BEVEL, PLATE_DEPTH, plateBaseY } from "./plateHeight";
import { useMapFocus } from "./useMapFocus";
import { pokeMapActivity, pokeMapBloom } from "./mapPerf";

/** Top-edge chamfer in world units. */
const BEVEL_SIZE = 0.0012;
/** Unlock sweep duration. */
const SWEEP_SECONDS = 3.2;
/** Cull sub-pixel coastline rings. */
const MIN_RING_AREA = 2e-6;

function buildPlateGeometry(rings: PlateRing[], depth: number) {
  const shapes: THREE.Shape[] = [];
  for (const ring of rings) {
    if (ring.area < MIN_RING_AREA || ring.points.length < 3) continue;
    const shape = new THREE.Shape();
    // Shape space is (world x, -world z): the +z extrusion then rotates onto
    // world up and every point lands back exactly where the map put it.
    ring.points.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    shapes.push(shape);
  }
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL_SIZE,
    bevelSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function RegionPlate({
  id,
  rings,
  albedo,
  field,
  reducedMotion,
  flags,
}: {
  id: RegionId;
  rings: PlateRing[];
  albedo: THREE.Texture;
  field: THREE.Texture;
  reducedMotion: boolean;
  flags: MapFlags;
}) {
  const { build } = useBuild();
  const { focus, focusRegion } = useMapFocus();
  const invalidate = useThree((s) => s.invalidate);
  // Ref, not useState — hover must not re-render the plate tree (Cascading Update).
  const hovered = useRef(false);

  const depth = PLATE_DEPTH[id];
  const unlocked = isRegionUnlocked(build, id);
  const subject = focus.framed && focus.region === id;
  const sidelined = focus.framed && focus.region !== id;
  const anchor = REGION_ANCHOR_BY_ID.get(id);

  const geometry = useMemo(() => buildPlateGeometry(rings, depth), [rings, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const mats = useMemo(
    () =>
      createTerrainMaterials(albedo, field, depth, {
        relief: flags.relief,
        water: flags.water,
        wireframe: flags.wireframe,
      }),
    [albedo, field, depth, flags.relief, flags.water, flags.wireframe],
  );
  useEffect(() => () => mats.dispose(), [mats]);

  useEffect(() => {
    mats.lock.value = unlocked ? 0 : 1;
    mats.dim.value = sidelined ? 1 : 0;
    mats.focus.value = subject || hovered.current ? 1 : 0;
    const uv = REGION_ANCHOR_BY_ID.get(id)?.uv;
    if (uv) {
      // Shader mapUv flips V (mapUvFrom); anchor UV must match that space
      // or the expand disc lands off-plate and electives look like a no-op.
      const [su, sv] = anchorUvToShader(uv);
      (mats.unlockCenter.value as { set: (u: number, v: number) => void }).set(su, sv);
    }
    invalidate();
  }, [mats, unlocked, sidelined, subject, invalidate, id]);

  // Unlock only: sweep 1→0 expands colour from unlockCenter with a green ring.
  // Starting regions skip this so the board does not flash on every load.
  const sweep = useRef(0);
  const wasUnlocked = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasUnlocked.current !== null && unlocked && !wasUnlocked.current && !reducedMotion) {
      sweep.current = 1;
      mats.sweep.value = 1;
      // Colour restore runs while lock is already 0 — grey peels via sweep.
      mats.lock.value = 0;
      // Bloom MRT only while the green frontier runs (~SWEEP_SECONDS).
      pokeMapBloom(SWEEP_SECONDS * 1000 + 400);
      invalidate();
    }
    wasUnlocked.current = unlocked;
  }, [unlocked, reducedMotion, invalidate, mats]);

  // One damped number, asleep at rest. The group's y belongs to this loop alone:
  // passing `position` as a prop lets R3F reapply the target in the same commit
  // that flips it, so the plate teleports instead of rising.
  //
  // Seed in layout (and again on the first frame if the ref was late) so the
  // first painted pose is already at rest — starting at y=0 buried the plate
  // under the sea and eased it up as a mount pop.
  const group = useRef<THREE.Group>(null);
  const targetY = plateBaseY(id, unlocked, subject);
  const seeded = useRef(false);
  useLayoutEffect(() => {
    const g = group.current;
    if (!g || seeded.current) return;
    g.position.y = targetY;
    seeded.current = true;
  }, [targetY]);

  useFrame((_, delta) => {
    let busy = false;
    if (sweep.current > 0) {
      sweep.current = Math.max(0, sweep.current - delta / SWEEP_SECONDS);
      mats.sweep.value = sweep.current;
      busy = true;
    }
    const g = group.current;
    if (!g) return;
    if (!seeded.current) {
      g.position.y = targetY;
      seeded.current = true;
      return;
    }
    if (g.position.y !== targetY) {
      const next = reducedMotion
        ? targetY
        : g.position.y + (targetY - g.position.y) * (1 - Math.exp(-delta * 6.5));
      g.position.y = Math.abs(next - targetY) < 0.0004 ? targetY : next;
      busy = true;
    }
    if (busy) {
      pokeMapActivity();
      invalidate();
    }
  });

  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    focusRegion(id);
  };
  const over = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (!hovered.current) {
      hovered.current = true;
      mats.focus.value = 1;
      invalidate();
    }
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (hovered.current) {
      hovered.current = false;
      mats.focus.value = subject ? 1 : 0;
      invalidate();
    }
    document.body.style.cursor = "auto";
  };
  // PointerOut can be missed when the canvas unmounts under us.
  useEffect(() => () => void (document.body.style.cursor = "auto"), []);

  const label = anchor
    ? [(anchor.uv[0] - 0.5) * MAP_WORLD.width, (anchor.uv[1] - 0.5) * MAP_WORLD.height]
    : null;

  return (
    <group ref={group}>
      <mesh
        geometry={geometry}
        material={[mats.cap, mats.wall]}
        onClick={click}
        onPointerOver={over}
        onPointerOut={out}
      />

      {label ? (
        // The ledger owns accessible region controls; this label is decorative.
        <Html
          position={[label[0], depth + BEVEL + 0.006, label[1]]}
          center
          zIndexRange={[12, 0]}
          // Screen-space size (no distance shrink) so region crests stay readable.
          style={{ pointerEvents: "none", transform: "translate3d(0,0,0)" }}
        >
          <div
            aria-hidden="true"
            className={`map-region-marker${unlocked ? " is-unlocked" : " is-locked"}${
              subject ? " is-focus" : ""
            }`}
          >
            <img src={`/game/regions/${id}.webp`} alt="" width={64} height={72} />
            <span className="map-region-marker__name">{anchor?.name}</span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}
