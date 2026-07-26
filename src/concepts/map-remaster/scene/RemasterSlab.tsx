"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import type { RegionId } from "@/league";
import { smoothRing } from "@/map/data/regionCurve";
import { MAP_WORLD } from "@/map/data/regionAnchors";
import type { RegionShape } from "@/map/data/regionShapes";
import { BEVEL } from "@/map/slabHeight";
import { createDaylitCapMaterial } from "./materials/daylitCap";
import { createRemasterCapMaterial } from "./materials/remasterCap";
import { useRemaster } from "./remasterState";

const INSET = 0.004;
const BASE_RAISED = 0.02;
const BASE_SUNKEN = -0.024;

function buildGeometry(shape: RegionShape) {
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
    if (i === 0) outline.moveTo(ix, -iz);
    else outline.lineTo(ix, -iz);
  });
  const slab = new THREE.ExtrudeGeometry(outline, {
    depth: shape.depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: 0.002,
    bevelSegments: 4,
  });
  slab.rotateX(-Math.PI / 2);
  return slab;
}

export function RemasterSlab({
  shape,
  terrain,
  crest,
  reducedMotion,
}: {
  shape: RegionShape;
  terrain: THREE.Texture;
  crest: THREE.Texture;
  reducedMotion: boolean;
}) {
  const { skin, focus, setRegion, unlocked } = useRemaster();
  const invalidate = useThree((s) => s.invalidate);
  const id = shape.id;
  const isUnlocked = unlocked.has(id);
  const subject = focus.region === id;
  const sidelined = focus.region !== null && focus.region !== id;

  const geometry = useMemo(() => buildGeometry(shape), [shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const mats = useMemo(
    () =>
      skin.id === "daylit"
        ? createDaylitCapMaterial(terrain, shape.depth, isUnlocked)
        : createRemasterCapMaterial(terrain, skin, shape.depth, isUnlocked),
    [terrain, shape.depth, skin, isUnlocked],
  );

  useEffect(() => () => mats.dispose(), [mats]);

  useEffect(() => {
    mats.lock.value = isUnlocked ? 0 : 1;
    mats.dim.value = sidelined ? 1 : 0;
    mats.focusU.value = subject ? 1 : 0;
    invalidate();
  }, [mats, isUnlocked, subject, sidelined, invalidate]);

  const groupRef = useRef<THREE.Group>(null);
  const targetY =
    (isUnlocked ? BASE_RAISED : BASE_SUNKEN) +
    (subject ? skin.focusLift : sidelined ? -skin.unfocusedDrop : 0);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const cur = g.position.y;
    if (cur === targetY) return;
    const next = reducedMotion ? targetY : cur + (targetY - cur) * (1 - Math.exp(-delta * 7));
    g.position.y = Math.abs(next - targetY) < 0.0004 ? targetY : next;
    invalidate();
  });

  useEffect(() => {
    if (groupRef.current) groupRef.current.position.y = targetY;
  }, []); // seed once

  const [mx, mz] = useMemo(
    () => [
      (shape.markerUv[0] - 0.5) * MAP_WORLD.width,
      (shape.markerUv[1] - 0.5) * MAP_WORLD.height,
    ],
    [shape],
  );

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setRegion(id as RegionId);
  };

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        material={[mats.cap, mats.wall]}
        onClick={click}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
        castShadow
        receiveShadow
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[mx, shape.depth + BEVEL + 0.005, mz]}
        raycast={() => null}
      >
        <planeGeometry args={[0.09, 0.1]} />
        <meshBasicMaterial
          map={crest}
          transparent
          alphaTest={0.05}
          opacity={isUnlocked ? 1 : 0.42}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
