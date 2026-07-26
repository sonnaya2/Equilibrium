"use client";

/**
 * One region slab: an extruded low-poly landmass piece that lifts when
 * unlocked and sinks into the table when locked. Lock state is a property of
 * the geometry — height and colour, never a badge.
 *
 * The cap samples its region's terrain tile; the wall is banded into strata so
 * the cut earth shows, which is the whole reason these are extruded rather than
 * drawn flat. Both use TERRAIN_* albedo, never the SURFACE_* chrome tokens —
 * see the note in palette.ts for why that distinction is load-bearing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { Html } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  canSelectElective,
  ELECTIVE_REGIONS,
  isRegionUnlocked,
  MILESTONE_REGION,
  type RegionId,
} from "@/league";
import { useBuild } from "@/league/useBuild";
import { REGION_METRICS_BY_ID } from "./data/regionMetrics";
import { smoothRing } from "./data/regionCurve";
import { type RegionShape } from "./data/regionShapes";
import { MAP_WORLD, REGION_ANCHOR_BY_ID } from "./data/regionAnchors";
import { createSlabMaterials } from "./materials/slabMaterials";
import { createBarrierMaterial } from "./materials/hexBarrier";
import { BEVEL, FOCUS_LIFT, RAISED_Y, slabBaseY, SUNKEN_Y } from "./slabHeight";
import { useMapFocus } from "./useMapFocus";

/** Per-slab inset so shared seams never z-fight (bevelSize stays under half of it). */
const INSET = 0.004;
/** Ember-to-gem unlock sweep, in seconds. */
const SWEEP_SECONDS = 0.6;

/** uv ring -> world -> extruded slab standing up in +y, caps on material group 0.
 *  The flat cap outline comes back with it, for the locked barrier lattice. */
function buildSlabGeometry(shape: RegionShape) {
  const world = smoothRing(shape).map(
    ([u, v]) =>
      [(u - 0.5) * MAP_WORLD.width, (v - 0.5) * MAP_WORLD.height] as [number, number],
  );
  const cx = world.reduce((s, p) => s + p[0], 0) / world.length;
  const cz = world.reduce((s, p) => s + p[1], 0) / world.length;
  const outline = new THREE.Shape();
  world.forEach(([x, z], i) => {
    const dx = cx - x;
    const dz = cz - z;
    const len = Math.hypot(dx, dz) || 1;
    const ix = x + (dx / len) * INSET;
    const iz = z + (dz / len) * INSET;
    // Shape space: x = world x, y = -world z, so the +z extrusion maps to world +y.
    if (i === 0) outline.moveTo(ix, -iz);
    else outline.lineTo(ix, -iz);
  });
  const slab = new THREE.ExtrudeGeometry(outline, {
    depth: shape.depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: 0.0015,
    bevelSegments: 2,
  });
  // (x, y, z) shape -> (x, z, -y) world: extrusion up, shape-y back to world z.
  slab.rotateX(-Math.PI / 2);

  const barrier = new THREE.ShapeGeometry(outline);
  barrier.rotateX(-Math.PI / 2);
  barrier.translate(0, shape.depth + BEVEL + 0.002, 0);

  return { slab, barrier };
}

function statusLabel(id: RegionId, elective: boolean, unlocked: boolean, selectable: boolean): string {
  if (!elective) return id === MILESTONE_REGION ? "First milestone" : "Fixed start";
  if (unlocked) return "Picked";
  return selectable ? "Available pick" : "Locked · 3 of 3 spent";
}

export function RegionSlab({
  shape,
  crest,
  terrain,
  reducedMotion,
}: {
  shape: RegionShape;
  crest: THREE.Texture;
  terrain: THREE.Texture;
  reducedMotion: boolean;
}) {
  const { build } = useBuild();
  const { focus, focusRegion } = useMapFocus();
  const invalidate = useThree((s) => s.invalidate);
  const [hovered, setHovered] = useState(false);

  const id = shape.id;
  const unlocked = isRegionUnlocked(build, id);
  const elective = (ELECTIVE_REGIONS as readonly RegionId[]).includes(id);
  const selectable = elective && canSelectElective(build, id);
  const quests = REGION_METRICS_BY_ID.get(id)?.quests ?? 0;
  const anchor = REGION_ANCHOR_BY_ID.get(id);
  const subject = focus.framed && focus.region === id;
  const sidelined = focus.framed && focus.region !== id;

  const geometry = useMemo(() => buildSlabGeometry(shape), [shape]);
  useEffect(
    () => () => {
      geometry.slab.dispose();
      geometry.barrier.dispose();
    },
    [geometry],
  );

  // One graph per slab; state rides uniforms so nothing rebuilds on a toggle.
  const mats = useMemo(
    () => createSlabMaterials(terrain, shape.depth),
    [terrain, shape.depth],
  );
  const barrier = useMemo(() => createBarrierMaterial(), []);
  useEffect(() => () => mats.dispose(), [mats]);
  useEffect(() => () => barrier.dispose(), [barrier]);
  useEffect(() => {
    mats.lock.value = unlocked ? 0 : 1;
    barrier.lock.value = unlocked ? 0 : 1;
    invalidate();
  }, [mats, barrier, unlocked, invalidate]);
  useEffect(() => {
    mats.dim.value = sidelined ? 1 : 0;
    mats.focus.value = subject || hovered ? 1 : 0;
    invalidate();
  }, [mats, subject, sidelined, hovered, invalidate]);

  // The unlock sweep: one ramp, ember resolving to gem, then gone. Fires on the
  // transition into unlocked only — never on mount, or the board lights up on
  // every page load with the starting regions already open.
  const sweep = useRef(0);
  const wasUnlocked = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasUnlocked.current !== null && unlocked && !wasUnlocked.current && !reducedMotion) {
      sweep.current = 1;
      invalidate();
    }
    wasUnlocked.current = unlocked;
  }, [unlocked, reducedMotion, invalidate]);

  // Raise/sink spring: one damped number, keyed off lock and focus state, asleep
  // at rest. The group's y is owned by this frame loop alone — passing `position`
  // as a JSX prop would let R3F reapply the target in the same commit that flips
  // it, so `cur === targetY` before the lerp ever runs and the slab teleports.
  const groupRef = useRef<THREE.Group>(null);
  const targetY = slabBaseY(unlocked, subject, sidelined);
  const settled = useRef(false);
  useEffect(() => {
    // Seed the first mount at its resting height so the board does not animate in.
    if (!settled.current && groupRef.current) {
      groupRef.current.position.y = targetY;
      settled.current = true;
    }
  }, [targetY]);
  useFrame((_, delta) => {
    let busy = false;
    if (sweep.current > 0) {
      sweep.current = Math.max(0, sweep.current - delta / SWEEP_SECONDS);
      mats.sweep.value = sweep.current;
      busy = true;
    }
    const g = groupRef.current;
    if (g && g.position.y !== targetY) {
      const cur = g.position.y;
      const next = reducedMotion ? targetY : cur + (targetY - cur) * (1 - Math.exp(-delta * 6.5));
      g.position.y = Math.abs(next - targetY) < 0.0005 ? targetY : next;
      busy = true;
    }
    if (busy) invalidate();
  });

  // Focus only. This used to focus *and* toggle in one gesture, which made every
  // board click an edit to persisted state — including the clicks that were
  // really aimed at a place marker on top of the slab. Picking is an explicit
  // button now, in the ledger and in the inspector header, so the board is safe
  // to explore. Nothing was lost: the ledger already owned toggling.
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    focusRegion(id);
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    setHovered(false);
    document.body.style.cursor = "auto";
  };
  // PointerOut can miss when the canvas unmounts (WebGPU fallback, route leave).
  useEffect(
    () => () => {
      document.body.style.cursor = "auto";
    },
    [],
  );

  const [mx, mz] = [
    (shape.markerUv[0] - 0.5) * MAP_WORLD.width,
    (shape.markerUv[1] - 0.5) * MAP_WORLD.height,
  ];
  // Crest sits north of the marker, count south of it. Stacked on one point they
  // overlap on screen, because the crest lies flat and foreshortens while the
  // count is a screen-space chip centred on the same projected pixel.
  //
  // Scaled to the slab, not fixed: regions differ by 3x in area, and a constant
  // offset walks the crest off the cap of a small one, where the overhang gets
  // occluded by whatever is behind it and reads as a clipped shield.
  const inradius = useMemo(() => {
    const pts = smoothRing(shape).map(
      ([u, v]) =>
        [(u - 0.5) * MAP_WORLD.width, (v - 0.5) * MAP_WORLD.height] as [number, number],
    );
    const m: [number, number] = [
      (shape.markerUv[0] - 0.5) * MAP_WORLD.width,
      (shape.markerUv[1] - 0.5) * MAP_WORLD.height,
    ];
    let best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [ax, az] = pts[j];
      const [bx, bz] = pts[i];
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((m[0] - ax) * dx + (m[1] - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(m[0] - (ax + t * dx), m[1] - (az + t * dz)));
    }
    return best;
  }, [shape]);
  const CREST_OFFSET = Math.min(0.055, inradius * 0.5);
  const COUNT_OFFSET = Math.min(0.052, inradius * 0.48);
  const crestSize = Math.min(0.116, inradius * 1.05);

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry.slab}
        material={[mats.cap, mats.wall]}
        onClick={click}
        onPointerOver={over}
        onPointerOut={out}
      />

      {/* The locked-region barrier. Its lattice is read from world XZ, so
          neighbouring locked slabs share one continuous grid. Mounted always;
          the lock uniform fades it, which is what keeps the unlock a single
          animating number rather than a mount/unmount. */}
      <mesh geometry={geometry.barrier} material={barrier.material} raycast={() => null} />

      {/* Crest decal on the cap — real game art, unlit, alpha-tested. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[mx, shape.depth + BEVEL + 0.005, mz - CREST_OFFSET]}
      >
        <planeGeometry args={[crestSize, crestSize * 1.14]} />
        <meshBasicMaterial
          map={crest}
          transparent
          alphaTest={0.05}
          opacity={unlocked ? 1 : 0.45}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Quest count on the cap. aria-hidden always: the DOM ledger owns names. */}
      <Html
        position={[mx, shape.depth + BEVEL + 0.012, mz + COUNT_OFFSET]}
        center
        distanceFactor={1}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div aria-hidden="true" className="slab-chip">
          {quests}
        </div>
      </Html>

      {hovered && anchor ? (
        <Html
          position={[mx, shape.depth + BEVEL + 0.075, mz]}
          center
          distanceFactor={1}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div aria-hidden="true" className="map-chip">
            <span className="map-chip-name">{anchor.name}</span>
            <span className="map-chip-state">
              {statusLabel(id, elective, unlocked, selectable)} · {quests} quests touching
            </span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}
