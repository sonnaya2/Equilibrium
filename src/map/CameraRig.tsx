"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { PLACES_BY_REGION, rasterPlaceUv } from "./data/placeAnchors";
import { MAP_WORLD, REGION_ANCHOR_BY_ID, anchorWorld } from "./data/regionAnchors";

interface Framing {
  azimuth: number;
  elevation: number;
  radius: number;
  target: readonly [number, number, number];
  fov: number;
}

const TABLE: Framing = {
  azimuth: 0,
  elevation: 1.34,
  radius: 0.8,
  target: [0, 0, 0.03],
  fov: 38,
};

const PARALLAX_AZIMUTH = 0.025;
const PARALLAX_ELEVATION = 0.012;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function lerpAngle(a: number, b: number, k: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * k;
}

function orbit(
  out: THREE.Vector3,
  target: THREE.Vector3,
  azimuth: number,
  elevation: number,
  radius: number,
) {
  const flat = Math.cos(elevation) * radius;
  out.set(
    target.x + Math.sin(azimuth) * flat,
    target.y + Math.sin(elevation) * radius,
    target.z + Math.cos(azimuth) * flat,
  );
}

export function CameraRig({
  focus,
  place,
  reducedMotion,
}: {
  focus: RegionId | null;
  place?: string | null;
  reducedMotion: boolean;
}) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const aspect = useThree((state) => state.size.width / state.size.height);

  const table = useMemo<Framing>(() => {
    const halfFov = (TABLE.fov * Math.PI) / 360;
    const widthFit = (MAP_WORLD.width * 0.54) / (Math.tan(halfFov) * aspect);
    const depthFit =
      (MAP_WORLD.height * 0.54 * Math.sin(TABLE.elevation)) / Math.tan(halfFov);
    return { ...TABLE, radius: Math.max(TABLE.radius, widthFit, depthFit) };
  }, [aspect]);

  const want = useMemo<Framing>(() => {
    const region = focus ? REGION_ANCHOR_BY_ID.get(focus) : undefined;
    if (!region) return table;

    let uv = region.uv;
    if (place) {
      const placeAnchor = PLACES_BY_REGION.get(region.id)?.find((entry) => entry.area === place);
      if (placeAnchor) uv = rasterPlaceUv(placeAnchor);
    }

    const [rawX, rawZ] = anchorWorld(uv);
    const radius = place ? 0.45 : 0.7 + region.size * 0.08;
    const halfFov = (38 * Math.PI) / 360;
    const halfWidth = radius * Math.tan(halfFov) * aspect;
    const halfDepth = (radius * Math.tan(halfFov)) / Math.sin(1.28);
    const limitX = Math.max(0, MAP_WORLD.width * 0.5 - halfWidth);
    const limitZ = Math.max(0, MAP_WORLD.height * 0.5 - halfDepth);

    return {
      azimuth: 0,
      elevation: 1.28,
      radius,
      target: [
        Math.max(-limitX, Math.min(limitX, rawX)),
        0,
        Math.max(-limitZ, Math.min(limitZ, rawZ)),
      ],
      fov: 38,
    };
  }, [aspect, focus, place, table]);

  const current = useRef({
    azimuth: table.azimuth,
    elevation: 1.08,
    radius: table.radius * 1.25,
    fov: table.fov + 4,
    target: new THREE.Vector3(...table.target),
  });
  const moving = useRef(true);
  const pointer = useRef({ x: 0, y: 0 });
  const parallax = useRef({ x: 0, y: 0 });
  const wantTarget = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [invalidate, want]);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = gl.domElement;
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      invalidate();
    };
    const leave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
      invalidate();
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
    };
  }, [gl, invalidate, reducedMotion]);

  useFrame((_, delta) => {
    const state = current.current;
    wantTarget.set(...want.target);

    if (reducedMotion) {
      state.azimuth = want.azimuth;
      state.elevation = want.elevation;
      state.radius = want.radius;
      state.fov = want.fov;
      state.target.copy(wantTarget);
      parallax.current.x = 0;
      parallax.current.y = 0;
      moving.current = false;
    } else if (moving.current) {
      const k = 1 - Math.exp(-delta * 6.5);
      state.azimuth = lerpAngle(state.azimuth, want.azimuth, k);
      state.elevation = lerp(state.elevation, want.elevation, k);
      state.radius = lerp(state.radius, want.radius, k);
      state.fov = lerp(state.fov, want.fov, k);
      state.target.lerp(wantTarget, k);
      moving.current =
        Math.abs(state.elevation - want.elevation) > 0.002 ||
        Math.abs(state.radius - want.radius) > 0.004 ||
        Math.abs(state.fov - want.fov) > 0.05 ||
        state.target.distanceTo(wantTarget) > 0.004;
    }

    let parallaxMoving = false;
    if (!reducedMotion) {
      const k = 1 - Math.exp(-delta * 4);
      const x = Math.max(-1, Math.min(1, pointer.current.x)) * PARALLAX_AZIMUTH;
      const y = Math.max(-1, Math.min(1, pointer.current.y)) * PARALLAX_ELEVATION;
      parallax.current.x = lerp(parallax.current.x, x, k);
      parallax.current.y = lerp(parallax.current.y, y, k);
      parallaxMoving =
        Math.abs(parallax.current.x - x) > 0.0002 ||
        Math.abs(parallax.current.y - y) > 0.0002;
    }

    orbit(
      position,
      state.target,
      state.azimuth + parallax.current.x,
      state.elevation + parallax.current.y,
      state.radius,
    );
    camera.position.copy(position);
    camera.lookAt(state.target);
    if (Math.abs(camera.fov - state.fov) > 0.001) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
    if (moving.current || parallaxMoving) invalidate();
  });

  return null;
}
