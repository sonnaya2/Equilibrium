"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import { MAP_WORLD } from "./data/regionAnchors";
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
/**
 * Land runs u 0.085..0.921, so its half-width is 0.836. The rest is margin for
 * pointer parallax, which swings the view about 0.048 world units at the table
 * radius — 0.89 covers it with a little to spare. Anything under ~0.884 clips
 * the Tirannwn and Havenhythe coasts whenever the mouse moves.
 */
const FIT_HALF_WIDTH = 0.89;
/**
 * Derived, not a literal: the land runs nearly the full v range, so half the
 * world depth is the extent plus a little margin. Hardcoding it meant every
 * change to MAP_WORLD.height silently clipped the Wilderness off the top and
 * the Desert off the bottom.
 */
const FIT_HALF_DEPTH = MAP_WORLD.height * 0.5;
/**
 * Both fits above solve against the *target plane*, which is a flat
 * approximation of a perspective shot. Under the ~46 degree tilt the south
 * coast sits well nearer the camera than the target does and perspective
 * magnifies it, so the honest fit runs the board off the bottom and flanks.
 * Rather than solve the projected hull in closed form, this is a measured
 * margin: `window.__mapFitProbe().overflow` reports the cut on each side in CSS
 * pixels, and this is the smallest value that keeps all four negative.
 */
const FIT_MARGIN = 1.03;

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
function orbit(out: THREE.Vector3, target: THREE.Vector3, az: number, el: number, r: number) {
  const flat = Math.cos(el) * r;
  out.set(target.x + Math.sin(az) * flat, target.y + Math.sin(el) * r, target.z + Math.cos(az) * flat);
}

export function CameraRig({
  focus,
  place,
  reducedMotion,
}: {
  focus: RegionId | null;
  /** Selected place, if any. Pushes in on its anchor without a new shot. */
  place?: string | null;
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
    // Foreshortened, not flat. The board is seen at ~46 degrees, so its depth
    // covers `sin(elevation)` of the screen height it would cover top-down.
    // Fitting the raw depth asked for a 39% bigger radius than the shot needs
    // and was the second half of the small-board problem, after the aspect box.
    const forDepth = (FIT_HALF_DEPTH * Math.sin(TABLE_FRAMING.elevation)) / Math.tan(halfFov);
    return {
      ...TABLE_FRAMING,
      radius: Math.max(TABLE_FRAMING.radius, forWidth, forDepth) * FIT_MARGIN,
    };
  }, [aspect]);

  // Selecting a place reuses that region's authored shot and only swaps the
  // target and closes the distance — no second camera path, and the framing
  // stays one someone chose. Memoised because the settle effect keys off it.
  const want = useMemo<Framing>(() => {
    const base = focus ? (SHAPE_BY_ID.get(focus)?.framing ?? table) : table;
    if (!focus || !place) return base;
    const anchor = PLACES_BY_REGION.get(focus)?.find((p) => p.area === place);
    if (!anchor) return base;
    return {
      ...base,
      target: [
        (anchor.uv[0] - 0.5) * MAP_WORLD.width,
        base.target[1],
        (anchor.uv[1] - 0.5) * MAP_WORLD.height,
      ],
      radius: base.radius * 0.6,
    };
  }, [focus, place, table]);

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
      // Snapping *is* settled. Without this, `moving` is only ever cleared in
      // the animated branch below, so under reduced motion it stays true and
      // the tail of this function invalidates on every single frame — pinning
      // frameloop="demand" at the display's refresh rate for as long as the
      // route is open. Exactly backwards for the setting that asks for less.
      moving.current = false;
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

    orbit(
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
