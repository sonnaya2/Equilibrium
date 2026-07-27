"use client";

/**
 * The board: water, eleven plates cut from the HD raster, the vines sealing what
 * is still locked, and the pins for whatever is framed.
 *
 * Every texture and every ring is loaded once here and handed down, so eleven
 * plates share one raster, one field and one atlas rather than eleven copies of
 * each. Nothing under this component fetches anything.
 *
 * The light rig is small and fixed: a warm key from the upper left, a cool sky
 * fill, and no shadow maps. Contact comes from the water darkening against every
 * coast, which is exact — it reads the same distance field the coastline was cut
 * from — and costs nothing.
 */

import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { REGION_IDS, type RegionId } from "@/league";
import { BorderVines } from "./BorderVines";
import { MapDebug } from "./MapDebug";
import { MotionDriver } from "./MotionDriver";
import { Ocean } from "./Ocean";
import { PlaceMarkers, POI_ATLAS_IMAGE } from "./PlaceMarkers";
import { RegionPlate } from "./RegionPlate";
import { PLATES_URL, TERRAIN_FIELD_URL, parsePlates, ringsFor, seamsFor } from "./data/plates";
import { MAP_IMAGE } from "./data/regionAnchors";
import { asAlbedoTexture, asDataTexture } from "./materials/shared";
import { mapFlags } from "./mapQuality";

/** Warm key from the upper left; the water reflects this same direction. */
export const KEY_DIRECTION = new THREE.Vector3(-0.62, 0.78, -0.44).normalize();

export function MapTable({ reducedMotion }: { reducedMotion: boolean }) {
  const flags = mapFlags();

  const [albedoRaw, fieldRaw, atlasRaw] = useLoader(THREE.TextureLoader, [
    MAP_IMAGE.src,
    TERRAIN_FIELD_URL,
    POI_ATLAS_IMAGE,
  ]);
  const platesRaw = useLoader(THREE.FileLoader, PLATES_URL) as unknown as string;

  const albedo = useMemo(() => asAlbedoTexture(albedoRaw), [albedoRaw]);
  const field = useMemo(() => asDataTexture(fieldRaw), [fieldRaw]);
  const atlas = useMemo(() => asAlbedoTexture(atlasRaw, 8), [atlasRaw]);
  const plates = useMemo(() => parsePlates(platesRaw), [platesRaw]);
  const rings = useMemo(
    () => new Map(REGION_IDS.map((id) => [id as RegionId, ringsFor(plates, id as RegionId)])),
    [plates],
  );
  const seams = useMemo(() => seamsFor(plates), [plates]);

  const keyPosition = useMemo(() => KEY_DIRECTION.clone().multiplyScalar(4), []);

  // The loaders cache by url across mounts, so the textures outlive this
  // component and must not be disposed with it — only what we built goes.
  useEffect(() => undefined, []);

  if (flags.debugGeometry) {
    return (
      <group>
        <MapDebug plates={plates} seams={seams} albedo={albedo} />
        <MotionDriver reducedMotion />
      </group>
    );
  }

  return (
    <group>
      <hemisphereLight args={[0xbcd6f0, 0x5a4a30, 0.62]} />
      <directionalLight position={keyPosition} intensity={0.92} color={0xffe9c8} />

      {flags.water ? <Ocean field={field} keyDirection={KEY_DIRECTION} /> : null}

      {REGION_IDS.map((id) => (
        <RegionPlate
          key={id}
          id={id as RegionId}
          rings={rings.get(id as RegionId) ?? []}
          albedo={albedo}
          field={field}
          reducedMotion={reducedMotion}
          flags={flags}
        />
      ))}

      {flags.vines ? <BorderVines seams={seams} reducedMotion={reducedMotion} /> : null}
      {flags.markers ? (
        <PlaceMarkers atlasTexture={atlas} reducedMotion={reducedMotion} />
      ) : null}

      <MotionDriver reducedMotion={reducedMotion} />
    </group>
  );
}
