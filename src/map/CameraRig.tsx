"use client";

/**
 * A designed camera, not a sandbox.
 *
 * No orbit controls, no free tumble, no going under the board. Every shot is
 * four spherical scalars plus a target, and a move is a damped lerp of those —
 * which is what makes a long move arc around the world instead of driving
 * through Kandarin on the way to the Desert. A cartesian lerp between two
 * positions does exactly that, which is why this does not use one.
 *
 * The table shot is solved from the live aspect rather than authored, so the
 * board fills whatever cell the layout gives it. Focus shots are solved the same
 * way and then clamped against the map's own extents: pushing in on the Desert
 * must never sail Tirannwn off the frame because the solver forgot the board has
 * edges.
 *
 * Pointer parallax is a degree and a half. It is there to make the board feel
 * like an object on a table, not to let anyone fly.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { PLACES_BY_REGION, rasterPlaceUv } from "./data/placeAnchors";
import { MAP_WORLD, REGION_ANCHOR_BY_ID, anchorWorld } from "./data/regionAnchors";
import { mapFlags } from "./mapQuality";

interface Framing {
  /** Radians. 0 looks due north across the board. */
  azimuth: number;
  /** Radians above the surface. Never below MIN_ELEVATION, never past vertical. */
  elevation: number;
  radius: number;
  target: [number, number, number];
  fov: number;
}

const FOV = 34;
/** The overview: a shallow three-quarter view, the way you stand over a table. */
const TABLE_ELEVATION = 0.74;
/** Framed shots tip further overhead so a region's shape reads. */
const FOCUS_ELEVATION = 0.88;
const PLACE_ELEVATION = 0.8;
const MIN_ELEVATION = 0.34;
/** Breathing room around the board at the overview. */
const TABLE_MARGIN = 1.07;
/** Aim a little south of centre: the tilt makes the near half project larger, so
 *  a shot centred on the geometric middle leaves dead sky above the board. */
const TABLE_BIAS = 0.055;
/** Height the shots aim at — the plate caps, not the water they sit in. */
const SURFACE_Y = 0.012;

const PARALLAX_AZIMUTH = 0.026;
const PARALLAX_ELEVATION = 0.012;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function lerpAngle(a: number, b: number, k: number) {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * k;
}

/** Radius that fits a WxH board at this elevation and aspect. */
function fitRadius(width: number, depth: number, elevation: number, aspect: number, fov: number) {
  const half = Math.tan((fov * Math.PI) / 360);
  const byWidth = width / (2 * half * Math.max(aspect, 0.35));
  const byDepth = (depth * Math.sin(elevation)) / (2 * half);
  return Math.max(byWidth, byDepth);
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
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const flags = mapFlags();

  const table = useMemo<Framing>(() => {
    const elevation = flags.topDown ? Math.PI / 2 - 0.001 : TABLE_ELEVATION;
    return {
      azimuth: 0,
      elevation,
      radius: fitRadius(
        MAP_WORLD.width * TABLE_MARGIN,
        MAP_WORLD.height * TABLE_MARGIN,
        elevation,
        aspect,
        FOV,
      ),
      target: [0, SURFACE_Y, MAP_WORLD.height * TABLE_BIAS],
      fov: FOV,
    };
  }, [aspect, flags.topDown]);

  const want = useMemo<Framing>(() => {
    const region = focus ? REGION_ANCHOR_BY_ID.get(focus) : undefined;
    if (!region) return table;

    let uv = region.uv;
    if (place) {
      const pin = PLACES_BY_REGION.get(region.id)?.find((entry) => entry.area === place);
      if (pin) uv = rasterPlaceUv(pin);
    }
    const [rawX, rawZ] = anchorWorld(uv);

    const elevation = flags.topDown
      ? Math.PI / 2 - 0.001
      : place
        ? PLACE_ELEVATION
        : FOCUS_ELEVATION;
    // Swing round to the region's own side of the board so the move reads as an
    // arc over the world rather than a dolly straight at it.
    const azimuth = flags.topDown ? 0 : clamp((rawX / MAP_WORLD.width) * 0.9, -0.42, 0.42);
    // Regions differ by three times in area; `size` is the authored weight.
    const span = place ? 0.34 : 0.66 + region.size * 0.14;
    const radius = fitRadius(span, span * 0.78, elevation, aspect, FOV);

    // What the shot can actually see, so the clamp knows how far the target may
    // travel before the board's edge enters the frame.
    const half = Math.tan((FOV * Math.PI) / 360) * radius;
    const limitX = Math.max(0, MAP_WORLD.width * 0.5 - half * aspect);
    const limitZ = Math.max(0, MAP_WORLD.height * 0.5 - half / Math.sin(elevation));

    return {
      azimuth,
      elevation,
      radius,
      target: [clamp(rawX, -limitX, limitX), SURFACE_Y, clamp(rawZ, -limitZ, limitZ)],
      fov: FOV,
    };
  }, [aspect, focus, place, table, flags.topDown]);

  // Open a touch wider and lower, then settle — the board arrives rather than
  // cutting in. Under reduced motion the first frame is already the answer.
  const current = useRef<Framing>({
    ...table,
    elevation: reducedMotion ? table.elevation : table.elevation - 0.16,
    radius: table.radius * (reducedMotion ? 1 : 1.18),
    target: [...table.target] as [number, number, number],
  });
  const moving = useRef(true);
  const pointer = useRef({ x: 0, y: 0 });
  const parallax = useRef({ x: 0, y: 0 });
  const targetVec = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [invalidate, want]);

  useEffect(() => {
    if (reducedMotion || flags.topDown) return;
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
  }, [gl, invalidate, reducedMotion, flags.topDown]);

  useFrame((_, delta) => {
    const state = current.current;

    if (reducedMotion) {
      state.azimuth = want.azimuth;
      state.elevation = want.elevation;
      state.radius = want.radius;
      state.fov = want.fov;
      state.target = [...want.target] as [number, number, number];
      parallax.current.x = 0;
      parallax.current.y = 0;
      moving.current = false;
    } else if (moving.current) {
      const k = 1 - Math.exp(-delta * 5.4);
      state.azimuth = lerpAngle(state.azimuth, want.azimuth, k);
      state.elevation = lerp(state.elevation, want.elevation, k);
      state.radius = lerp(state.radius, want.radius, k);
      state.fov = lerp(state.fov, want.fov, k);
      state.target[0] = lerp(state.target[0], want.target[0], k);
      state.target[1] = lerp(state.target[1], want.target[1], k);
      state.target[2] = lerp(state.target[2], want.target[2], k);
      moving.current =
        Math.abs(state.elevation - want.elevation) > 0.0015 ||
        Math.abs(state.radius - want.radius) > 0.003 ||
        Math.abs(state.azimuth - want.azimuth) > 0.0015 ||
        Math.abs(state.target[0] - want.target[0]) > 0.003 ||
        Math.abs(state.target[2] - want.target[2]) > 0.003;
    }

    let drifting = false;
    if (!reducedMotion && !flags.topDown) {
      const k = 1 - Math.exp(-delta * 3.6);
      const x = clamp(pointer.current.x, -1, 1) * PARALLAX_AZIMUTH;
      const y = clamp(pointer.current.y, -1, 1) * PARALLAX_ELEVATION;
      parallax.current.x = lerp(parallax.current.x, x, k);
      parallax.current.y = lerp(parallax.current.y, y, k);
      drifting =
        Math.abs(parallax.current.x - x) > 0.0002 || Math.abs(parallax.current.y - y) > 0.0002;
    }

    const azimuth = state.azimuth + parallax.current.x;
    // The floor is what stops the camera from sliding under the board, which is
    // the one place a top-down map has no answer for.
    const elevation = clamp(
      state.elevation + parallax.current.y,
      MIN_ELEVATION,
      Math.PI / 2 - 0.001,
    );
    targetVec.set(state.target[0], state.target[1], state.target[2]);
    const flat = Math.cos(elevation) * state.radius;
    position.set(
      targetVec.x + Math.sin(azimuth) * flat,
      targetVec.y + Math.sin(elevation) * state.radius,
      targetVec.z + Math.cos(azimuth) * flat,
    );
    camera.position.copy(position);
    camera.up.set(0, 1, 0);
    camera.lookAt(targetVec);
    if (Math.abs(camera.fov - state.fov) > 0.001) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
    if (moving.current || drifting) invalidate();
  });

  return null;
}
