"use client";

/**
 * The war table: eleven carved slabs on a dark umber board, one per region.
 * The flat league-map.jpg plate is gone — the board is original geometry now,
 * cut along shared seams so it visibly comes apart (wartable plan §1-2).
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { useLoader } from "@react-three/fiber";
import { REGION_SHAPES } from "./data/regionShapes";
import { MAP_WORLD, type RegionAnchor } from "./data/regionAnchors";
import { SURFACE_DEEP } from "./palette";
import { RegionSlab } from "./RegionSlab";

/** Sunken slabs sit this far down; the table top hides everything below it. */
const TABLE_TOP_Y = 0.035;

export function MapTable({
  onFocus,
  reducedMotion,
}: {
  onFocus: (anchor: RegionAnchor) => void;
  reducedMotion: boolean;
}) {
  const loaded = useLoader(
    THREE.TextureLoader,
    REGION_SHAPES.map((s) => `/game/regions/${s.id}.png`),
  );
  // The loader cache hands the same Texture back on every mount and its upload
  // state belongs to the renderer that uploaded it. clone() is not enough here:
  // it shares the Source, and the Source keeps that state across a renderer
  // swap, so a remount re-uploads an already-initialized source and three
  // throws. Wrap the decoded image in a fresh Texture so each mount owns one.
  const crests = useMemo(
    () =>
      loaded.map((t) => {
        const tex = new THREE.Texture(t.image);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        return tex;
      }),
    [loaded],
  );
  useEffect(() => () => crests.forEach((c) => c.dispose()), [crests]);

  return (
    <group>
      {/* The table itself: locked slabs sink into their sockets until only
          the rock bands show above this surface. */}
      <mesh position={[0, TABLE_TOP_Y - 0.05, 0]}>
        <boxGeometry args={[MAP_WORLD.width + 0.12, 0.1, MAP_WORLD.height + 0.12]} />
        <meshStandardMaterial color={SURFACE_DEEP} roughness={1} />
      </mesh>
      {REGION_SHAPES.map((shape, i) => (
        <RegionSlab
          key={shape.id}
          shape={shape}
          crest={crests[i]}
          onFocus={onFocus}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
