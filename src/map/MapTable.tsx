"use client";

/**
 * The board: water, eleven plates cut from the HD raster, the vines sealing what
 * is still locked, and the pins for whatever is framed.
 *
 * Every texture and every ring is loaded once here and handed down, so eleven
 * plates share one raster, one field and one atlas rather than eleven copies of
 * each. Nothing under this component fetches anything.
 *
 * The light rig is a desk-lamp print setup: strong warm key, weak cool fill,
 * tiny ambient so the wiki sheet keeps chroma. No shadow maps — contact comes
 * from the water darkening against every coast.
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

/**
 * Warm key from the upper left — steep enough to sculpt emboss, not a
 * overhead wash. Water reflects this same direction.
 */
export const KEY_DIRECTION = new THREE.Vector3(-0.55, 0.86, -0.38).normalize();

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
      {/* Ambient lifts the floor without flattening; hemi is a cool bounce only. */}
      <ambientLight intensity={0.16} color={0xfff0dd} />
      <hemisphereLight args={[0x8fa8c4, 0x3a3020, 0.28]} />
      {/* Hard warm sun — high intensity, low fill = contrast not chalk. */}
      <directionalLight position={keyPosition} intensity={1.62} color={0xffe0a8} />
      {/* Soft fill from the opposite quarter so wall strata don't go black. */}
      <directionalLight
        position={keyPosition.clone().multiplyScalar(-0.55).setY(2.2)}
        intensity={0.22}
        color={0xc4d4ee}
      />

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
