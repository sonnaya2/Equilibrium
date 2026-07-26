"use client";

/**
 * The war table: eleven carved slabs on a dark umber board, one per region.
 * The flat league-map.jpg plate is gone — the board is original geometry now,
 * cut along shared seams so it visibly comes apart (wartable plan §1-2).
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { useLoader, useThree } from "@react-three/fiber";
import { REGION_SHAPES } from "./data/regionShapes";

import { RegionSlab } from "./RegionSlab";
import { PlaceMarkers } from "./PlaceMarkers";
import { SeamVines } from "./SeamVines";

export function MapTable({ reducedMotion }: { reducedMotion: boolean }) {
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
      t.anisotropy = 16;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      // Wiki terrain crops: mild repeat so plates do not kaleidoscope on large slabs.
      if (i >= n) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1.4, 1.4);
      }
    });
    return [loaded.slice(0, n), loaded.slice(n)];
  }, [loaded]);

  // Under frameloop="demand" the last frame can land before a texture finishes
  // uploading, and nothing wakes the loop afterwards — which showed up as one
  // or two crests missing per load, a different pair each time. Ask for one
  // more frame once the textures are configured.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
  }, [crests, terrain, invalidate]);

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
          reducedMotion={reducedMotion}
        />
      ))}
      {/* Drawn after the slabs so the ribbons composite over both caps. */}
      <SeamVines />
      <PlaceMarkers />
    </group>
  );
}
