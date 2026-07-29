"use client";

/**
 * Long swell uses mesh displacement; short-wave detail stays in WaterMaterial.
 * MotionDriver owns the frame cadence.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { MAP_WORLD } from "./data/regionAnchors";
import { createWaterMaterial } from "./materials/WaterMaterial";

/** Covers every legal camera framing. */
const EXTENT = MAP_WORLD.width * 3;
/** Resolves the 1.2-unit swell at table distance. */
const SEGMENTS = 80;

export function Ocean({
  field,
  keyDirection,
}: {
  field: THREE.Texture;
  keyDirection: THREE.Vector3;
}) {
  const water = useMemo(() => createWaterMaterial(field, keyDirection), [field, keyDirection]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(EXTENT, EXTENT, SEGMENTS, SEGMENTS), []);
  useEffect(() => () => water.dispose(), [water]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      material={water.material}
      rotation={[-Math.PI / 2, 0, 0]}
      // Clicking open water pulls back out, so this one does take a raycast.
      renderOrder={-1}
    />
  );
}
