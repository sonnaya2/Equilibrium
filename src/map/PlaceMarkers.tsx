"use client";

/**
 * Crest discs for the framed region with a soft light beam from the plate.
 *
 * Planted (world-stable) — no camera billboards. Beams pulse via mapClock in the
 * shader so they ride MotionDriver without extra invalidates.
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { PLACES_BY_REGION, rasterPlaceUv, type PlaceAnchor } from "./data/placeAnchors";
import { MAP_WORLD } from "./data/regionAnchors";
import {
  createMarkerBeamMaterial,
  createMarkerFootMaterial,
  createMarkerHitMaterial,
  createMarkerMaterial,
} from "./materials/MarkerMaterial";
import { plateTopY } from "./plateHeight";
import { useMapFocus } from "./useMapFocus";

const Y_SPEED = 6.5;

/**
 * POI stake sizes (world units). Keep small under framed/table shots —
 * oversized discs ate the desert (clipboard). Areas still beat sites.
 * Elite Dungeon 2 (Dragonkin Laboratory) is deliberately larger so the ED2 pin
 * reads among the dense Wilderness cluster.
 */
const FACE_AREA = 0.03;
const FACE_SITE = 0.018;
/** ED2 — between area and site so the pin is readable without drowning neighbours. */
const FACE_ED2 = 0.028;
/** Solak / big outdoor bosses — larger than a generic site so the disc clears the plate. */
const FACE_SOLAK = 0.026;
const BEAM_H_AREA = 0.014;
const BEAM_H_SITE = 0.014;
const BEAM_H_ED2 = 0.013;
const BEAM_H_SOLAK = 0.018;
const BEAM_R_BASE_AREA = 0.007;
const BEAM_R_BASE_SITE = 0.0055;
const BEAM_R_BASE_ED2 = 0.0065;
const BEAM_R_BASE_SOLAK = 0.0065;
const FOOT_AREA = 0.011;
const FOOT_SITE = 0.008;
const FOOT_ED2 = 0.01;
const FOOT_SOLAK = 0.01;
const FACE_TILT = -0.72;
const HIT_OVERSIZE = 1.55;
/** Extra lift so tilted face discs do not clip into the plate top (Solak "under ground"). */
const FACE_CLEARANCE = 0.004;

function pinScale(place: PlaceAnchor) {
  if (place.area === "Dragonkin Laboratory") {
    return { face: FACE_ED2, beamH: BEAM_H_ED2, beamR: BEAM_R_BASE_ED2, foot: FOOT_ED2 };
  }
  if (place.area === "Solak") {
    return { face: FACE_SOLAK, beamH: BEAM_H_SOLAK, beamR: BEAM_R_BASE_SOLAK, foot: FOOT_SOLAK };
  }
  if (place.site) {
    return { face: FACE_SITE, beamH: BEAM_H_SITE, beamR: BEAM_R_BASE_SITE, foot: FOOT_SITE };
  }
  return { face: FACE_AREA, beamH: BEAM_H_AREA, beamR: BEAM_R_BASE_AREA, foot: FOOT_AREA };
}

export const POI_ATLAS_URL = "/map/poi-atlas.json?v=wiki211";
export const POI_ATLAS_IMAGE = "/map/poi-atlas.webp?v=wiki211";

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
  const beamMat = useMemo(() => createMarkerBeamMaterial(), []);
  const footMat = useMemo(() => createMarkerFootMaterial(), []);
  const hitMat = useMemo(() => createMarkerHitMaterial(), []);
  useEffect(
    () => () => {
      faceMat.dispose();
      beamMat.dispose();
      footMat.dispose();
      hitMat.dispose();
    },
    [faceMat, beamMat, footMat, hitMat],
  );

  const footGeometry = useMemo(() => new THREE.CircleGeometry(0.5, 12), []);
  // Open tapered shaft: rTop 0.32, rBottom 1, unit height, open-ended.
  // aLit is bound at geometry create so the first WebGPU pipeline compile sees
  // a real instance float attribute (not a folded 0.0 abstract mix factor).
  const litAttr = useMemo(() => {
    const attr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, pins.length)), 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    return attr;
  }, [pins.length]);
  const beamGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.32, 1, 1, 10, 1, true);
    geo.setAttribute("aLit", litAttr);
    return geo;
  }, [litAttr]);

  useEffect(
    () => () => {
      footGeometry.dispose();
      beamGeometry.dispose();
    },
    [footGeometry, beamGeometry],
  );

  const faces = useRef<THREE.Group>(null);
  const hits = useRef<THREE.Group>(null);
  const feet = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const shown = useRef<number[]>([]);
  const litFlags = useRef<number[]>([]);
  const forcePose = useRef(true);
  if (shown.current.length !== pins.length) {
    shown.current = pins.map(() => 0);
    litFlags.current = pins.map(() => -1);
    forcePose.current = true;
  }

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
      const next = reducedMotion ? wanted : from + (wanted - from) * (1 - Math.exp(-delta * 9));
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
        litAttr.setX(i, wantLit);
        litAttr.needsUpdate = true;
      }

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
        beams.current?.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const sz = pinScale(pin.place);
      const faceW = sz.face * (0.88 + reveal * 0.12) * (lit ? 1.06 : 1);
      const beamH = sz.beamH * reveal;
      const beamR = sz.beamR * reveal;
      const footW = sz.foot * reveal;

      // Clearance keeps the tilted disc above the plate bevel (site pins especially).
      face.position.set(pin.x, surfaceY + beamH + faceW * 0.22 + FACE_CLEARANCE, pin.z);
      face.scale.setScalar(faceW);
      face.rotation.set(FACE_TILT, 0, 0);

      hit.position.copy(face.position);
      hit.scale.setScalar(faceW * HIT_OVERSIZE);
      hit.rotation.copy(face.rotation);

      dummy.position.set(pin.x, surfaceY + 0.0005, pin.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(footW);
      dummy.updateMatrix();
      feet.current?.setMatrixAt(i, dummy.matrix);

      // Beam: unit cylinder along Y, base at plate, top under face.
      dummy.position.set(pin.x, surfaceY + beamH / 2, pin.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(beamR, Math.max(beamH, 0.0002), beamR);
      dummy.updateMatrix();
      beams.current?.setMatrixAt(i, dummy.matrix);
    }

    if (wrotePose) {
      if (feet.current) feet.current.instanceMatrix.needsUpdate = true;
      if (beams.current) beams.current.instanceMatrix.needsUpdate = true;
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
        renderOrder={1}
      />
      <instancedMesh
        ref={beams}
        args={[beamGeometry, beamMat.material, pins.length]}
        frustumCulled={false}
        raycast={() => null}
        renderOrder={1}
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
