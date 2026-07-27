"use client";

/**
 * The pins.
 *
 * Only for the region currently framed — eleven regions' worth at once is noise
 * on a two-unit board, and the region crests already carry the overview. Named
 * areas are the important tier and always show while their region is framed;
 * the site pins (bosses, dungeons, guilds) fade in once you have pushed in on a
 * place, which is where they stop being clutter and start being the answer.
 *
 * A medallion is one quad. Its geometry carries the atlas cell in `uv` and its
 * hover/site state in `aState`, so every pin on the board shares one material
 * and there is nothing per-marker to build or dispose but four vertices. Stems
 * and contact shadows are instanced.
 *
 * Markers hold a constant screen size, which is the only way a pin stays legible
 * across a camera that moves from the whole world to one town. The quad is
 * deliberately wider than the disc it paints: the extra is the click target.
 */

import { useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { PLACES_BY_REGION, rasterPlaceUv, type PlaceAnchor } from "./data/placeAnchors";
import { MAP_WORLD } from "./data/regionAnchors";
import {
  createMarkerMaterial,
  createMarkerShadowMaterial,
  createMarkerStemMaterial,
} from "./materials/MarkerMaterial";
import { plateTopY } from "./plateHeight";
import { useMapFocus } from "./useMapFocus";

export const POI_ATLAS_URL = "/map/poi-atlas.json";
export const POI_ATLAS_IMAGE = "/map/poi-atlas.webp";

export interface AtlasIndex {
  cell: number;
  cols: number;
  rows: number;
  index: Record<string, number>;
}

/** On-screen diameter of a medallion, in CSS pixels. */
const SIZE_AREA = 28;
const SIZE_SITE = 21;
/** How much of the quad is medallion; the rest is a forgiving click target. */
const QUAD_OVERSIZE = 1.42;
const STEM_HEIGHT = 0.016;

function slotFor(atlas: AtlasIndex, place: PlaceAnchor): number {
  const exact = atlas.index[`${place.region}/${place.area}`];
  if (exact !== undefined) return exact;
  return atlas.index[`crest/${place.region}`] ?? 0;
}

/** A quad carrying one atlas cell and one marker's state. */
function markerGeometry(atlas: AtlasIndex, place: PlaceAnchor): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const slot = slotFor(atlas, place);
  const col = slot % atlas.cols;
  const row = Math.floor(slot / atlas.cols);
  const du = 1 / atlas.cols;
  const dv = 1 / atlas.rows;
  const u0 = col * du;
  // Atlas rows run down from the top of the image; texture v runs up from the
  // bottom. Flipping here once is what keeps every icon the right way up.
  const v0 = 1 - (row + 1) * dv;
  const uvAttr = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setXY(i, u0 + uvAttr.getX(i) * du, v0 + uvAttr.getY(i) * dv);
  }
  uvAttr.needsUpdate = true;
  const state = new Float32Array(uvAttr.count * 3);
  for (let i = 0; i < uvAttr.count; i++) state[i * 3] = place.site ? 1 : 0;
  geometry.setAttribute("aState", new THREE.BufferAttribute(state, 3));
  return geometry;
}

interface Pin {
  place: PlaceAnchor;
  x: number;
  z: number;
  geometry: THREE.PlaneGeometry;
}

export function PlaceMarkers({
  atlasTexture,
  reducedMotion,
}: {
  atlasTexture: THREE.Texture;
  reducedMotion: boolean;
}) {
  const raw = useLoader(THREE.FileLoader, POI_ATLAS_URL) as unknown as string;
  const atlas = useMemo(() => JSON.parse(raw) as AtlasIndex, [raw]);
  const { build } = useBuild();
  const { focus, selectPlace, hoverPlace } = useMapFocus();
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const region: RegionId = focus.region;
  const pins = useMemo<Pin[]>(() => {
    const list = PLACES_BY_REGION.get(region) ?? [];
    return list.map((place) => {
      const uv = rasterPlaceUv(place);
      return {
        place,
        x: (uv[0] - 0.5) * MAP_WORLD.width,
        z: (uv[1] - 0.5) * MAP_WORLD.height,
        geometry: markerGeometry(atlas, place),
      };
    });
  }, [region, atlas]);
  useEffect(() => () => pins.forEach((pin) => pin.geometry.dispose()), [pins]);

  const marker = useMemo(() => createMarkerMaterial(atlasTexture), [atlasTexture]);
  const shadow = useMemo(() => createMarkerShadowMaterial(), []);
  const stem = useMemo(() => createMarkerStemMaterial(), []);
  useEffect(
    () => () => {
      marker.dispose();
      shadow.dispose();
      stem.dispose();
    },
    [marker, shadow, stem],
  );

  const shadowGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(0.0009, 0.0016, 1, 5, 1), []);
  useEffect(
    () => () => {
      shadowGeometry.dispose();
      stemGeometry.dispose();
    },
    [shadowGeometry, stemGeometry],
  );

  const group = useRef<THREE.Group>(null);
  const shadows = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const shown = useRef<number[]>([]);
  if (shown.current.length !== pins.length) shown.current = pins.map(() => 0);

  // Seed hidden. `visible` and `scale` belong to the frame loop from here on —
  // as JSX props R3F would reapply them in the same commit that changes them,
  // and the reveal would snap instead of easing.
  useEffect(() => {
    for (const child of group.current?.children ?? []) {
      child.visible = false;
      child.scale.setScalar(0.0001);
    }
  }, [pins]);

  const surfaceY = plateTopY(build, focus, region);
  const active = focus.framed && pins.length > 0;

  useEffect(() => {
    invalidate();
  }, [active, region, focus.place, focus.hover, surfaceY, invalidate]);

  useFrame((_, delta) => {
    const root = group.current;
    if (!root) return;
    let busy = false;

    // World units per screen pixel at the marker's distance. Recomputed each
    // frame because the camera is always the thing that moved.
    const perPixel =
      (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, size.height);

    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      const child = root.children[i] as THREE.Mesh | undefined;
      if (!child) continue;

      const selected = focus.place === pin.place.area;
      const lit = selected || focus.hover === pin.place.area;
      // Sites are the second tier: they arrive once you have pushed in on a
      // place, and stay out of the way until then.
      const wanted = active && (!pin.place.site || focus.place !== null || lit) ? 1 : 0;
      const from = shown.current[i] ?? 0;
      const next = reducedMotion
        ? wanted
        : from + (wanted - from) * (1 - Math.exp(-delta * 9));
      shown.current[i] = Math.abs(next - wanted) < 0.004 ? wanted : next;
      if (shown.current[i] !== wanted) busy = true;

      const reveal = shown.current[i];
      child.visible = reveal > 0.01;
      if (!child.visible) {
        dummy.scale.setScalar(0.0001);
        dummy.position.set(pin.x, -1, pin.z);
        dummy.updateMatrix();
        shadows.current?.setMatrixAt(i, dummy.matrix);
        stems.current?.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const base = pin.place.site ? SIZE_SITE : SIZE_AREA;
      const distance = camera.position.distanceTo(scratch.set(pin.x, surfaceY, pin.z));
      const world = base * perPixel * distance * QUAD_OVERSIZE;
      const hoverLift = lit ? 0.006 : 0;
      child.position.set(pin.x, surfaceY + STEM_HEIGHT + hoverLift + world * 0.34, pin.z);
      child.scale.setScalar(world * (0.82 + reveal * 0.18) * (lit ? 1.12 : 1));
      // No tumble on this camera, so copying its orientation is a true billboard
      // and never shows a marker edge-on.
      child.quaternion.copy(camera.quaternion);

      const state = child.geometry.getAttribute("aState") as THREE.BufferAttribute;
      const want = lit ? 1 : 0;
      if (state.getY(0) !== want) {
        for (let v = 0; v < state.count; v++) state.setY(v, want);
        state.needsUpdate = true;
      }

      dummy.position.set(pin.x, surfaceY + 0.0009, pin.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(world * 0.62 * reveal);
      dummy.updateMatrix();
      shadows.current?.setMatrixAt(i, dummy.matrix);

      const stemLength = (STEM_HEIGHT + hoverLift) * reveal;
      dummy.position.set(pin.x, surfaceY + stemLength / 2, pin.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, stemLength, 1);
      dummy.updateMatrix();
      stems.current?.setMatrixAt(i, dummy.matrix);
    }

    if (shadows.current) shadows.current.instanceMatrix.needsUpdate = true;
    if (stems.current) stems.current.instanceMatrix.needsUpdate = true;
    if (busy) invalidate();
  });

  if (pins.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={shadows}
        args={[shadowGeometry, shadow.material, pins.length]}
        frustumCulled={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={stems}
        args={[stemGeometry, stem.material, pins.length]}
        frustumCulled={false}
        raycast={() => null}
      />
      <group ref={group}>
        {pins.map((pin) => {
          const selected = focus.place === pin.place.area;
          const lit = selected || focus.hover === pin.place.area;
          return (
            <mesh
              key={`${pin.place.region}:${pin.place.area}`}
              geometry={pin.geometry}
              material={marker.material}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                // Never let a marker click fall through to the plate under it.
                event.stopPropagation();
                selectPlace(selected ? null : pin.place.area);
              }}
              onPointerOver={(event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                hoverPlace(pin.place.area);
              }}
              onPointerOut={() => hoverPlace(null)}
            >
              {lit ? (
                <Html
                  position={[0, 0.62, 0]}
                  center
                  zIndexRange={[16, 0]}
                  style={{ pointerEvents: "none" }}
                >
                  <div
                    aria-hidden="true"
                    className={`map-poi-label${selected ? " is-selected" : ""}`}
                  >
                    {pin.place.area}
                  </div>
                </Html>
              ) : null}
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
