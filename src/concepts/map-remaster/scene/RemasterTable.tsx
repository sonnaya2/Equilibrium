"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { useLoader, useThree } from "@react-three/fiber";
import { REGION_SHAPES } from "@/map/data/regionShapes";
import { RemasterMarkers } from "./RemasterMarkers";
import { RemasterSlab } from "./RemasterSlab";
import { RemasterVines } from "./RemasterVines";

export function RemasterTable({ reducedMotion }: { reducedMotion: boolean }) {
  const loaded = useLoader(THREE.TextureLoader, [
    ...REGION_SHAPES.map((s) => `/game/regions/${s.id}.png`),
    ...REGION_SHAPES.map((s) => `/game/terrain/${s.id}.png`),
  ]);

  const [crests, terrain] = useMemo(() => {
    const n = REGION_SHAPES.length;
    loaded.forEach((t, i) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 16;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      if (i >= n) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(3.2, 3.2);
      }
    });
    return [loaded.slice(0, n), loaded.slice(n)];
  }, [loaded]);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
  }, [crests, terrain, invalidate]);

  return (
    <group>
      {REGION_SHAPES.map((shape, i) => (
        <RemasterSlab
          key={shape.id}
          shape={shape}
          crest={crests[i]}
          terrain={terrain[i]}
          reducedMotion={reducedMotion}
        />
      ))}
      <RemasterVines reducedMotion={reducedMotion} />
      <RemasterMarkers />
    </group>
  );
}
