"use client";

/**
 * Crest stakes for the framed region.
 *
 * Planted on the plate (world-stable size and pose) — not constant-screen-size
 * billboards. Soft medallions, contact shadows and per-pin Html labels were the
 * flicker source: every demand-loop tick rewrote quaternion/scale and blended
 * transparent cards over the HD raster.
 *
 * Named areas show while framed; sites arrive once a place is selected.
 * Names live on the ledger chips (accessible), not as canvas DOM overlays.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { PLACES_BY_REGION, rasterPlaceUv, type PlaceAnchor } from "./data/placeAnchors";
import { MAP_WORLD } from "./data/regionAnchors";
import {
  createMarkerFootMaterial,
  createMarkerHitMaterial,
  createMarkerMaterial,
  createMarkerStemMaterial,
} from "./materials/MarkerMaterial";
import { plateTopY } from "./plateHeight";
import { useMapFocus } from "./useMapFocus";

/** Same spring as RegionPlate / BorderVines so stakes ride the rising plate. */
const Y_SPEED = 6.5;

/**
 * World-unit face widths. Physical on the board — no CSS-pixel billboard.
 * Sized so the icon disc is readable under the framed table elevation.
 */
const FACE_AREA = 0.056;
const FACE_SITE = 0.05;
const SHAFT_AREA = 0.016;
const SHAFT_SITE = 0.014;
const FOOT_AREA = 0.015;
const FOOT_SITE = 0.013;
/**
 * Easel cant toward the designed table shot (~FOCUS_ELEVATION 0.88).
 * Near-upright (−0.2) was edge-on under that camera and collapsed every icon.
 */
const FACE_TILT = -0.72;
const HIT_OVERSIZE = 1.4;

export const POI_ATLAS_URL = "/map/poi-atlas.json";
export const POI_ATLAS_IMAGE = "/map/poi-atlas.webp";

export interface AtlasIndex {
  cell: number;
  cols: number;
  rows: number;
  index: Record<string, number>;
}

function slotFor(atlas: AtlasIndex, place: PlaceAnchor): number {
  const exact = atlas.index[`${place.region}/${place.area}`];
  if (exact !== undefined) return exact;
  return atlas.index[`crest/${place.region}`] ?? 0;
}

/** Face quad with atlas cell UVs and site flag in aState.x. */
function markerGeometry(atlas: AtlasIndex, place: PlaceAnchor): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const slot = slotFor(atlas, place);
  const col = slot % atlas.cols;
  const row = Math.floor(slot / atlas.cols);
  const du = 1 / atlas.cols;
  const dv = 1 / atlas.rows;
  const u0 = col * du;
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
  hitGeometry: THREE.PlaneGeometry;
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
        hitGeometry: new THREE.PlaneGeometry(1, 1),
      };
    });
  }, [region, atlas]);
  useEffect(
    () => () => {
      for (const pin of pins) {
        pin.geometry.dispose();
        pin.hitGeometry.dispose();
      }
    },
    [pins],
  );

  const faceMat = useMemo(() => createMarkerMaterial(atlasTexture), [atlasTexture]);
  const stemMat = useMemo(() => createMarkerStemMaterial(), []);
  const footMat = useMemo(() => createMarkerFootMaterial(), []);
  const hitMat = useMemo(() => createMarkerHitMaterial(), []);
  useEffect(
    () => () => {
      faceMat.dispose();
      stemMat.dispose();
      footMat.dispose();
      hitMat.dispose();
    },
    [faceMat, stemMat, footMat, hitMat],
  );

  const footGeometry = useMemo(() => new THREE.CircleGeometry(0.5, 12), []);
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(0.0007, 0.0012, 1, 5, 1), []);
  useEffect(
    () => () => {
      footGeometry.dispose();
      stemGeometry.dispose();
    },
    [footGeometry, stemGeometry],
  );

  const faces = useRef<THREE.Group>(null);
  const hits = useRef<THREE.Group>(null);
  const feet = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const shown = useRef<number[]>([]);
  const litFlags = useRef<number[]>([]);
  /** One-shot: pin set / frame gate / surface target changed — rewrite poses. */
  const forcePose = useRef(true);
  if (shown.current.length !== pins.length) {
    shown.current = pins.map(() => 0);
    litFlags.current = pins.map(() => -1);
    forcePose.current = true;
  }

  // Seed hidden. Scale/visibility belong to the frame loop only.
  useEffect(() => {
    for (const child of faces.current?.children ?? []) {
      child.visible = false;
      child.scale.setScalar(0.0001);
    }
    for (const child of hits.current?.children ?? []) {
      child.visible = false;
      child.scale.setScalar(0.0001);
    }
    for (let i = 0; i < litFlags.current.length; i++) litFlags.current[i] = -1;
    forcePose.current = true;
  }, [pins]);

  const targetSurfaceY = plateTopY(build, focus, region);
  const liveSurfaceY = useRef(targetSurfaceY);
  const ySeeded = useRef(false);
  useLayoutEffect(() => {
    liveSurfaceY.current = targetSurfaceY;
    ySeeded.current = true;
  }, [region]);
  useLayoutEffect(() => {
    if (!ySeeded.current) {
      liveSurfaceY.current = targetSurfaceY;
      ySeeded.current = true;
    }
  }, [targetSurfaceY]);

  const active = focus.framed && pins.length > 0;

  useEffect(() => {
    forcePose.current = true;
    invalidate();
  }, [active, region, focus.place, focus.hover, targetSurfaceY, invalidate]);

  useFrame((_, delta) => {
    const faceRoot = faces.current;
    const hitRoot = hits.current;
    if (!faceRoot || !hitRoot) return;
    let busy = false;
    let wrotePose = false;
    const rewriteAll = forcePose.current;

    if (!ySeeded.current) {
      liveSurfaceY.current = targetSurfaceY;
      ySeeded.current = true;
    } else if (liveSurfaceY.current !== targetSurfaceY) {
      const y0 = liveSurfaceY.current;
      const y1 = reducedMotion
        ? targetSurfaceY
        : y0 + (targetSurfaceY - y0) * (1 - Math.exp(-delta * Y_SPEED));
      liveSurfaceY.current = Math.abs(y1 - targetSurfaceY) < 0.0004 ? targetSurfaceY : y1;
      if (liveSurfaceY.current !== targetSurfaceY) busy = true;
    }
    const surfaceY = liveSurfaceY.current;
    // Plate still rising → every stake must ride it.
    const yBusy = liveSurfaceY.current !== targetSurfaceY;

    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      const face = faceRoot.children[i] as THREE.Mesh | undefined;
      const hit = hitRoot.children[i] as THREE.Mesh | undefined;
      if (!face || !hit) continue;

      const selected = focus.place === pin.place.area;
      const lit = selected || focus.hover === pin.place.area;
      const wantLit = lit ? 1 : 0;
      const wanted = active && (!pin.place.site || focus.place !== null || lit) ? 1 : 0;
      const from = shown.current[i] ?? 0;
      const next = reducedMotion
        ? wanted
        : from + (wanted - from) * (1 - Math.exp(-delta * 9));
      const reveal = Math.abs(next - wanted) < 0.004 ? wanted : next;
      const revealBusy = reveal !== wanted;
      shown.current[i] = reveal;
      if (revealBusy) busy = true;

      let litChanged = false;
      if (litFlags.current[i] !== wantLit) {
        litFlags.current[i] = wantLit;
        litChanged = true;
        const state = face.geometry.getAttribute("aState") as THREE.BufferAttribute;
        for (let v = 0; v < state.count; v++) state.setY(v, wantLit);
        state.needsUpdate = true;
      }

      // Water ticks must not rewrite settled stakes.
      if (!rewriteAll && !yBusy && !revealBusy && !litChanged) continue;

      wrotePose = true;
      const show = reveal > 0.01;
      face.visible = show;
      hit.visible = show;

      if (!show) {
        dummy.scale.setScalar(0.0001);
        dummy.position.set(pin.x, -1, pin.z);
        dummy.updateMatrix();
        feet.current?.setMatrixAt(i, dummy.matrix);
        stems.current?.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const site = pin.place.site;
      const faceW = (site ? FACE_SITE : FACE_AREA) * (0.88 + reveal * 0.12) * (lit ? 1.06 : 1);
      const shaftH = (site ? SHAFT_SITE : SHAFT_AREA) * reveal;
      const footW = (site ? FOOT_SITE : FOOT_AREA) * reveal;

      // Planted easel: short pin, face tilts toward the table view — never camera.quaternion.
      face.position.set(pin.x, surfaceY + shaftH + faceW * 0.12, pin.z);
      face.scale.setScalar(faceW);
      face.rotation.set(FACE_TILT, 0, 0);

      hit.position.copy(face.position);
      hit.scale.setScalar(faceW * HIT_OVERSIZE);
      hit.rotation.copy(face.rotation);

      dummy.position.set(pin.x, surfaceY + 0.0004, pin.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(footW);
      dummy.updateMatrix();
      feet.current?.setMatrixAt(i, dummy.matrix);

      dummy.position.set(pin.x, surfaceY + shaftH / 2, pin.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, Math.max(shaftH, 0.0002), 1);
      dummy.updateMatrix();
      stems.current?.setMatrixAt(i, dummy.matrix);
    }

    if (wrotePose) {
      if (feet.current) feet.current.instanceMatrix.needsUpdate = true;
      if (stems.current) stems.current.instanceMatrix.needsUpdate = true;
    }
    if (!busy && !yBusy) forcePose.current = false;
    if (busy) invalidate();
  });

  if (pins.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={feet}
        args={[footGeometry, footMat.material, pins.length]}
        frustumCulled={false}
        raycast={() => null}
        renderOrder={2}
      />
      <instancedMesh
        ref={stems}
        args={[stemGeometry, stemMat.material, pins.length]}
        frustumCulled={false}
        raycast={() => null}
        renderOrder={2}
      />
      <group ref={faces} renderOrder={3}>
        {pins.map((pin) => (
          <mesh
            key={`face:${pin.place.region}:${pin.place.area}`}
            geometry={pin.geometry}
            material={faceMat.material}
            raycast={() => null}
          />
        ))}
      </group>
      <group ref={hits} renderOrder={3}>
        {pins.map((pin) => {
          const selected = focus.place === pin.place.area;
          return (
            <mesh
              key={`hit:${pin.place.region}:${pin.place.area}`}
              geometry={pin.hitGeometry}
              material={hitMat.material}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                selectPlace(selected ? null : pin.place.area);
              }}
              onPointerOver={(event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                hoverPlace(pin.place.area);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                hoverPlace(null);
                document.body.style.cursor = "auto";
              }}
            />
          );
        })}
      </group>
    </group>
  );
}
