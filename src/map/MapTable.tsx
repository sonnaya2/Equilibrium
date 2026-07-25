"use client";

/**
 * The war table: eleven carved slabs on a dark umber board, one per region.
 * The flat league-map.jpg plate is gone — the board is original geometry now,
 * cut along shared seams so it visibly comes apart (wartable plan §1-2).
 */

import { useMemo } from "react";
import * as THREE from "three/webgpu";
import { useLoader } from "@react-three/fiber";
import { REGION_SHAPES } from "./data/regionShapes";
import { MAP_WORLD, type RegionAnchor } from "./data/regionAnchors";

import { RegionSlab } from "./RegionSlab";


export function MapTable({
  onFocus,
  reducedMotion,
}: {
  onFocus: (anchor: RegionAnchor) => void;
  reducedMotion: boolean;
}) {
  const loaded = useLoader(THREE.TextureLoader, [
    ...REGION_SHAPES.map((s) => `/game/regions/${s.id}.png`),
    ...REGION_SHAPES.map((s) => `/game/terrain/${s.id}.png`),
  ]);
  // Configured in place: the loader cache is shared, but the renderer is no
  // longer torn down mid-replay (see the dispose deferral in MapScene), so the
  // cached Source is never handed to a half-disposed renderer. Wrapping each
  // image in a per-mount Texture also fixed the crash, but that treated the
  // symptom — probe-map-texture.mjs is clean across load, reload, route
  // away/back and click without it.
  const [crests, terrain] = useMemo(() => {
    const n = REGION_SHAPES.length;
    loaded.forEach((t, i) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      // Terrain tiles are seamless; let them repeat across the larger slabs.
      if (i >= n) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(3, 3);
      }
    });
    return [loaded.slice(0, n), loaded.slice(n)];
  }, [loaded]);

  return (
    <group>
      {/* No table plate: the sea is the ground, so it runs up to every
          coastline and the shapes read as land rather than tiles on a board.
          Locked regions sink toward it until the water is at their strata. */}
      {REGION_SHAPES.map((shape, i) => (
        <RegionSlab
          key={shape.id}
          shape={shape}
          crest={crests[i]}
          terrain={terrain[i]}
          onFocus={onFocus}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
