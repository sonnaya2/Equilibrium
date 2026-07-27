"use client";

/**
 * The sea, and the only thing on this route that moves at rest.
 *
 * Long swell displaces the mesh, so the plane is subdivided just enough to carry
 * it — the short detail is normal-only and costs no vertices. Everything else
 * about how it looks lives in WaterMaterial; everything about when it is allowed
 * to move lives in MotionDriver, which owns the single 30Hz heartbeat the whole
 * board shares.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { MAP_WORLD } from "./data/regionAnchors";
import { createWaterMaterial } from "./materials/WaterMaterial";

/** Wide enough that the swell never shows an edge inside any legal framing. */
const EXTENT = MAP_WORLD.width * 3;
/** Segments across that extent. The long swell is ~1.2 units; this is ample. */
const SEGMENTS = 112;

export function Ocean({ field, keyDirection }: { field: THREE.Texture; keyDirection: THREE.Vector3 }) {
  const water = useMemo(() => createWaterMaterial(field, keyDirection), [field, keyDirection]);
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(EXTENT, EXTENT, SEGMENTS, SEGMENTS),
    [],
  );
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
