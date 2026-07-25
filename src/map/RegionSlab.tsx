"use client";

/**
 * One region slab: an extruded low-poly landmass piece that lifts when
 * unlocked and sinks into the table when locked. Lock state is a property of
 * the geometry — height and colour, never a badge. Flat palette materials for
 * now; the TSL cap/wall graphs land in the materials phase (wartable plan P4).
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
import { ringPoints, type RegionShape } from "./data/regionShapes";
import { MAP_WORLD, REGION_ANCHOR_BY_ID, type RegionAnchor } from "./data/regionAnchors";
import { EDGE_LINE, SURFACE_DEEP, SURFACE_PANEL, SURFACE_RAISED } from "./palette";

/** Per-slab inset so shared seams never z-fight (bevelSize stays under half of it). */
const INSET = 0.004;
const RAISED_Y = 0.02;
const SUNKEN_Y = -0.024;

/** uv ring -> world -> extruded slab standing up in +y, caps on material group 0. */
function buildSlabGeometry(shape: RegionShape): THREE.ExtrudeGeometry {
  const world = ringPoints(shape).map(
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
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: shape.depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.0015,
    bevelSegments: 2,
  });
  // (x, y, z) shape -> (x, z, -y) world: extrusion up, shape-y back to world z.
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function statusLabel(id: RegionId, elective: boolean, unlocked: boolean, selectable: boolean): string {
  if (!elective) return id === MILESTONE_REGION ? "First milestone" : "Fixed start";
  if (unlocked) return "Selected · click to remove";
  return selectable ? "Click to unlock" : "Locked";
}

export function RegionSlab({
  shape,
  crest,
  onFocus,
  reducedMotion,
}: {
  shape: RegionShape;
  crest: THREE.Texture;
  onFocus: (anchor: RegionAnchor) => void;
  reducedMotion: boolean;
}) {
  const { build, toggleRegion } = useBuild();
  const invalidate = useThree((s) => s.invalidate);
  const [hovered, setHovered] = useState(false);

  const id = shape.id;
  const unlocked = isRegionUnlocked(build, id);
  const elective = (ELECTIVE_REGIONS as readonly RegionId[]).includes(id);
  const selectable = elective && canSelectElective(build, id);
  const quests = REGION_METRICS_BY_ID.get(id)?.quests ?? 0;
  const anchor = REGION_ANCHOR_BY_ID.get(id);

  const geometry = useMemo(() => buildSlabGeometry(shape), [shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Raise/sink spring: one damped number, keyed off lock state, asleep at rest.
  const groupRef = useRef<THREE.Group>(null);
  const targetY = unlocked ? RAISED_Y : SUNKEN_Y;
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const cur = g.position.y;
    if (cur === targetY) return;
    const next = reducedMotion ? targetY : cur + (targetY - cur) * (1 - Math.exp(-delta * 6.5));
    g.position.y = Math.abs(next - targetY) < 0.0005 ? targetY : next;
    invalidate();
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (anchor) onFocus(anchor);
    if (elective) toggleRegion(id);
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = selectable || !elective ? "pointer" : "not-allowed";
  };
  const out = () => {
    setHovered(false);
    document.body.style.cursor = "auto";
  };

  const [mx, mz] = [
    (shape.markerUv[0] - 0.5) * MAP_WORLD.width,
    (shape.markerUv[1] - 0.5) * MAP_WORLD.height,
  ];

  return (
    <group ref={groupRef} position={[0, targetY, 0]}>
      <mesh geometry={geometry} onClick={click} onPointerOver={over} onPointerOut={out}>
        <meshStandardMaterial
          attach="material-0"
          color={unlocked ? SURFACE_RAISED : SURFACE_DEEP}
          roughness={0.9}
        />
        <meshStandardMaterial
          attach="material-1"
          color={unlocked ? EDGE_LINE : SURFACE_PANEL}
          roughness={0.95}
        />
      </mesh>

      {/* Crest decal on the cap — real game art, unlit, alpha-tested. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[mx, shape.depth + 0.004, mz]}>
        <planeGeometry args={[0.079, 0.09]} />
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
        position={[mx, shape.depth + 0.03, mz]}
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
          position={[mx, shape.depth + 0.075, mz]}
          center
          distanceFactor={1}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div aria-hidden="true" className="map-chip">
            <span className="map-chip-name">{anchor.name}</span>
            <span className="map-chip-state">{statusLabel(id, elective, unlocked, selectable)}</span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}
