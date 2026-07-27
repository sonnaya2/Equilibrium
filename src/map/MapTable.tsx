"use client";

import { useEffect, useMemo } from "react";
import { Html } from "@react-three/drei";
import { useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { isRegionUnlocked } from "@/league";
import { useBuild } from "@/league/useBuild";
import {
  MAP_IMAGE,
  MAP_WORLD,
  REGION_ANCHORS,
  anchorWorld,
} from "./data/regionAnchors";
import { REGION_METRICS_BY_ID } from "./data/regionMetrics";
import { PlaceMarkers } from "./PlaceMarkers";
import { useMapFocus } from "./useMapFocus";

export function MapTable() {
  const mapTexture = useLoader(THREE.TextureLoader, MAP_IMAGE.src);
  const invalidate = useThree((state) => state.invalidate);
  const { build } = useBuild();
  const { focus, focusRegion } = useMapFocus();

  const material = useMemo(() => {
    mapTexture.colorSpace = THREE.SRGBColorSpace;
    mapTexture.anisotropy = 16;
    mapTexture.generateMipmaps = true;
    mapTexture.minFilter = THREE.LinearMipmapLinearFilter;
    mapTexture.magFilter = THREE.LinearFilter;
    mapTexture.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
      map: mapTexture,
      transparent: false,
      toneMapped: false,
    });
  }, [mapTexture]);

  useEffect(() => {
    invalidate();
    const frame = requestAnimationFrame(invalidate);
    return () => {
      cancelAnimationFrame(frame);
      material.dispose();
    };
  }, [invalidate, material]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <planeGeometry args={[MAP_WORLD.width, MAP_WORLD.height]} />
      </mesh>

      {REGION_ANCHORS.map((region) => {
        const [x, z] = anchorWorld(region.uv);
        const unlocked = isRegionUnlocked(build, region.id);
        const framed = focus.framed && focus.region === region.id;
        const metrics = REGION_METRICS_BY_ID.get(region.id);
        return (
          <Html
            key={region.id}
            position={[x, 0.025, z]}
            center
            zIndexRange={[12, 0]}
            style={{ pointerEvents: "auto" }}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={`map-region-marker${unlocked ? " is-unlocked" : " is-locked"}${framed ? " is-focus" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                focusRegion(region.id);
              }}
            >
              <img src={`/game/regions/${region.id}.png`} alt="" />
              <span className="map-region-marker__name">{region.name}</span>
              <span className="map-region-marker__count">{metrics?.quests ?? 0} quests</span>
            </button>
          </Html>
        );
      })}

      <PlaceMarkers />
    </group>
  );
}
