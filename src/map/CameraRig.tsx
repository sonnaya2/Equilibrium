"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { SHAPE_BY_ID, TABLE_FRAMING, type Framing } from "./data/regionShapes";

/**
 * The camera never tumbles. It sits on a small set of authored framings and
 * moves between them on a damped arc that keeps it above the board the whole
 * way, so every frame is a shot someone chose rather than wherever a drag left
 * things.
 *
 * The transition lerps the four spherical scalars plus the target and the fov,
 * never the cartesian position. That is the load-bearing part: for two far-apart
 * regions, a straight position lerp cuts through the board and the shot dies
 * mid-move. Interpolating azimuth keeps the camera on its arc by construction.
 */

/**
 * Half-extents of the land, plus margin — not of the uv square. The coastline
 * spans u 0.085..0.921, so fitting the full 2-unit plane parks the camera far
 * enough back to leave a sixth of the canvas empty on both flanks.
 */
const FIT_HALF_WIDTH = 0.92;
const FIT_HALF_DEPTH = 0.4;

/** Pointer parallax, in radians. ~1.7 deg of yaw, ~0.9 of pitch. */
const PARALLAX_AZIMUTH = 0.03;
const PARALLAX_ELEVATION = 0.015;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Shortest way round, so a move west never spins the long way east. */
function lerpAngle(a: number, b: number, k: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * k;
}

/** Spherical around the target. Azimuth 0 is due south, elevation is above the board. */
function place(out: THREE.Vector3, target: THREE.Vector3, az: number, el: number, r: number) {
  const flat = Math.cos(el) * r;
  out.set(target.x + Math.sin(az) * flat, target.y + Math.sin(el) * r, target.z + Math.cos(az) * flat);
}

export function CameraRig({
  focus,
  reducedMotion,
}: {
  focus: RegionId | null;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const aspect = useThree((s) => s.size.width / s.size.height);

  /**
   * The table shot pulls back only as far as the viewport actually needs. The
   * old rig used a fixed 2.9/aspect, which on a tall canvas parked the camera
   * a full unit further out than the fit required and left the board sitting in
   * the middle 40% of a mostly empty frame.
   */
  const table = useMemo<Framing>(() => {
    const halfFov = (TABLE_FRAMING.fov * Math.PI) / 360;
    const forWidth = FIT_HALF_WIDTH / (Math.tan(halfFov) * aspect);
    const forDepth = FIT_HALF_DEPTH / Math.tan(halfFov);
    return { ...TABLE_FRAMING, radius: Math.max(TABLE_FRAMING.radius, forWidth, forDepth) };
  }, [aspect]);

  const want = focus ? (SHAPE_BY_ID.get(focus)?.framing ?? table) : table;

  // Current solved framing. Seeded high and wide so the first frames are an
  // intro descent onto the table, exactly once.
  const cur = useRef({
    azimuth: table.azimuth,
    elevation: 1.15,
    radius: table.radius * 1.45,
    fov: table.fov + 6,
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
  }, [want, invalidate]);

  // Parallax is input-driven, so the frameloop still sleeps when the pointer
  // parks. Zero under reduced motion, and the listener is not even attached.
  useEffect(() => {
    if (reducedMotion) return;
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      invalidate();
    };
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
      invalidate();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, invalidate, reducedMotion]);

  useFrame((_, delta) => {
    const c = cur.current;
    wantTarget.set(...want.target);

    if (reducedMotion) {
      c.azimuth = want.azimuth;
      c.elevation = want.elevation;
      c.radius = want.radius;
      c.fov = want.fov;
      c.target.copy(wantTarget);
      parallax.current.x = 0;
      parallax.current.y = 0;
    } else if (moving.current) {
      const k = 1 - Math.exp(-delta * 6.5);
      c.azimuth = lerpAngle(c.azimuth, want.azimuth, k);
      c.elevation = lerp(c.elevation, want.elevation, k);
      c.radius = lerp(c.radius, want.radius, k);
      c.fov = lerp(c.fov, want.fov, k);
      c.target.lerp(wantTarget, k);
      const settled =
        Math.abs(c.azimuth - want.azimuth) < 0.002 &&
        Math.abs(c.elevation - want.elevation) < 0.002 &&
        Math.abs(c.radius - want.radius) < 0.004 &&
        Math.abs(c.fov - want.fov) < 0.05 &&
        c.target.distanceTo(wantTarget) < 0.004;
      if (settled) moving.current = false;
    }

    // Damped toward the pointer, applied after the framing solve so it can
    // never fight it and never accumulates into a new viewing angle.
    let parallaxMoving = false;
    if (!reducedMotion) {
      const pk = 1 - Math.exp(-delta * 4);
      const targetX = Math.max(-1, Math.min(1, pointer.current.x)) * PARALLAX_AZIMUTH;
      const targetY = Math.max(-1, Math.min(1, pointer.current.y)) * PARALLAX_ELEVATION;
      parallax.current.x = lerp(parallax.current.x, targetX, pk);
      parallax.current.y = lerp(parallax.current.y, targetY, pk);
      parallaxMoving =
        Math.abs(parallax.current.x - targetX) > 0.0002 ||
        Math.abs(parallax.current.y - targetY) > 0.0002;
    }

    place(
      position,
      c.target,
      c.azimuth + parallax.current.x,
      // Clamped above the board: parallax may tilt the shot, never dip under it.
      Math.max(0.32, Math.min(1.35, c.elevation + parallax.current.y)),
      c.radius,
    );
    camera.position.copy(position);
    camera.lookAt(c.target);
    if (Math.abs(camera.fov - c.fov) > 0.001) {
      camera.fov = c.fov;
      camera.updateProjectionMatrix();
    }

    if (moving.current || parallaxMoving) invalidate();
  });

  return null;
}
