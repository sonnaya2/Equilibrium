"use client";

/**
 * Designed camera with restricted mouse + WASD control.
 *
 * Still spherical (azimuth / elevation / radius / target) — never free OrbitControls.
 * Mouse: LMB drag orbit, RMB/MMB drag pan, wheel zoom steps.
 * Keys: WASD pan on the board plane (camera-relative). Everything is clamped so
 * you cannot fly under the board, spin forever, or pan off the map.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { PLACES_BY_REGION, rasterPlaceUv } from "./data/placeAnchors";
import { MAP_WORLD, REGION_ANCHOR_BY_ID, anchorWorld } from "./data/regionAnchors";
import { mapFlags } from "./mapQuality";
import { nudgeZoom, zoomRadiusMul } from "./useMapFocus";

interface Framing {
  azimuth: number;
  elevation: number;
  radius: number;
  target: [number, number, number];
  fov: number;
}

const FOV = 34;
const TABLE_ELEVATION = 0.74;
const FOCUS_ELEVATION = 0.88;
const PLACE_ELEVATION = 0.8;
const MIN_ELEVATION = 0.38;
const MAX_ELEVATION = 1.12;
const TABLE_MARGIN = 1.07;
const TABLE_BIAS = 0.055;
const SURFACE_Y = 0.012;

/** Soft hover parallax — disabled while dragging. */
const PARALLAX_AZIMUTH = 0.02;
const PARALLAX_ELEVATION = 0.01;

/** User orbit offsets from the designed shot (radians). */
const MAX_AZ_OFF = 0.95;
const MAX_EL_OFF = 0.42;
/** Pan target max from designed target (world units on 2u board). */
const MAX_PAN = 0.55;
/** WASD pan speed in world units per second (board is ~2u wide). */
const KEY_PAN_SPEED = 0.55;
/** Pixels of movement before a press becomes a drag (clicks still pick). */
const DRAG_THRESHOLD = 5;
const ORBIT_SENS = 0.0055;
const PAN_SENS = 0.00135;

const WASD_CODES = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

function typingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true'], input, textarea, select"));
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function lerpAngle(a: number, b: number, k: number) {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * k;
}

function fitRadius(width: number, depth: number, elevation: number, aspect: number, fov: number) {
  const half = Math.tan((fov * Math.PI) / 360);
  const byWidth = width / (2 * half * Math.max(aspect, 0.35));
  const byDepth = (depth * Math.sin(elevation)) / (2 * half);
  return Math.max(byWidth, byDepth);
}

interface UserControl {
  azOff: number;
  elOff: number;
  txOff: number;
  tzOff: number;
  mode: "idle" | "pending" | "orbit" | "pan";
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  button: number;
}

export function CameraRig({
  focus,
  place,
  zoom = 0,
  reducedMotion,
}: {
  focus: RegionId | null;
  place?: string | null;
  zoom?: number;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const flags = mapFlags();
  const zMul = zoomRadiusMul(zoom);

  const table = useMemo<Framing>(() => {
    const elevation = flags.topDown ? Math.PI / 2 - 0.001 : TABLE_ELEVATION;
    const baseR = fitRadius(
      MAP_WORLD.width * TABLE_MARGIN,
      MAP_WORLD.height * TABLE_MARGIN,
      elevation,
      aspect,
      FOV,
    );
    return {
      azimuth: 0,
      elevation,
      radius: baseR * zMul,
      target: [0, SURFACE_Y, MAP_WORLD.height * TABLE_BIAS],
      fov: FOV,
    };
  }, [aspect, flags.topDown, zMul]);

  const want = useMemo<Framing>(() => {
    const region = focus ? REGION_ANCHOR_BY_ID.get(focus) : undefined;
    if (!region) return table;

    let uv = region.uv;
    if (place) {
      const pin = PLACES_BY_REGION.get(region.id)?.find((entry) => entry.area === place);
      if (pin) uv = rasterPlaceUv(pin);
    }
    let [rawX, rawZ] = anchorWorld(uv);
    // Southern anchors (desert, islands) leave a huge empty ocean band under
    // the plate when the look-at sits on the crest. Nudge inland so the shot
    // keeps land in frame instead of pure south sea (clipboard desert crop).
    if (!place && rawZ > MAP_WORLD.height * 0.12) {
      rawZ -= Math.min(0.12, (rawZ - MAP_WORLD.height * 0.12) * 0.45);
    }

    const elevation = flags.topDown
      ? Math.PI / 2 - 0.001
      : place
        ? PLACE_ELEVATION
        : FOCUS_ELEVATION;
    const azimuth = flags.topDown ? 0 : clamp((rawX / MAP_WORLD.width) * 0.9, -0.42, 0.42);
    // Slightly wider than before so a framed desert still shows neighbouring coast.
    const span = place ? 0.34 : 0.72 + region.size * 0.16;
    const radius = fitRadius(span, span * 0.78, elevation, aspect, FOV) * zMul;

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
  }, [aspect, focus, place, table, flags.topDown, zMul]);

  const current = useRef<Framing>({
    ...table,
    elevation: reducedMotion ? table.elevation : table.elevation - 0.16,
    radius: table.radius * (reducedMotion ? 1 : 1.18),
    target: [...table.target] as [number, number, number],
  });
  const moving = useRef(true);
  const pointer = useRef({ x: 0, y: 0 });
  const parallax = useRef({ x: 0, y: 0 });
  const user = useRef<UserControl>({
    azOff: 0,
    elOff: 0,
    txOff: 0,
    tzOff: 0,
    mode: "idle",
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    button: 0,
  });
  /** Held WASD codes — board-plane pan, same clamps as mouse pan. */
  const keys = useRef(new Set<string>());
  const targetVec = useMemo(() => new THREE.Vector3(), []);
  const position = useMemo(() => new THREE.Vector3(), []);

  // New designed shot: ease there and clear manual offsets so focus/place win.
  useEffect(() => {
    user.current.azOff = 0;
    user.current.elOff = 0;
    user.current.txOff = 0;
    user.current.tzOff = 0;
    moving.current = true;
    invalidate();
  }, [invalidate, want.azimuth, want.elevation, want.radius, want.target[0], want.target[2], focus, place]);

  // Hover parallax (not while dragging).
  useEffect(() => {
    if (reducedMotion || flags.topDown) return;
    const canvas = gl.domElement;
    const move = (event: PointerEvent) => {
      if (user.current.mode === "orbit" || user.current.mode === "pan") return;
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

  // Restricted drag + wheel (mouse).
  useEffect(() => {
    if (reducedMotion) return;
    const canvas = gl.domElement;
    canvas.style.touchAction = "none";

    const endDrag = (event: PointerEvent) => {
      const u = user.current;
      if (u.pointerId !== event.pointerId) return;
      if (u.mode === "orbit" || u.mode === "pan") {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
        canvas.style.cursor = "";
      }
      u.mode = "idle";
      u.pointerId = -1;
      invalidate();
    };

    const onDown = (event: PointerEvent) => {
      // LMB orbit · RMB / MMB / shift+LMB pan. Ignore other buttons.
      const pan =
        event.button === 2 ||
        event.button === 1 ||
        (event.button === 0 && event.shiftKey);
      const orbit = event.button === 0 && !event.shiftKey;
      if (!orbit && !pan) return;
      if (flags.topDown && orbit) return; // top-down: pan + zoom only

      const u = user.current;
      u.mode = "pending";
      u.button = event.button;
      u.pointerId = event.pointerId;
      u.startX = event.clientX;
      u.startY = event.clientY;
      u.lastX = event.clientX;
      u.lastY = event.clientY;
    };

    const onMove = (event: PointerEvent) => {
      const u = user.current;
      if (u.pointerId !== event.pointerId || u.mode === "idle") return;

      const dx = event.clientX - u.lastX;
      const dy = event.clientY - u.lastY;

      if (u.mode === "pending") {
        const total = Math.hypot(event.clientX - u.startX, event.clientY - u.startY);
        if (total < DRAG_THRESHOLD) return;
        const pan =
          u.button === 2 || u.button === 1 || (u.button === 0 && event.shiftKey);
        u.mode = pan || flags.topDown ? "pan" : "orbit";
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        canvas.style.cursor = u.mode === "pan" ? "move" : "grabbing";
        // Kill hover parallax while driving.
        pointer.current.x = 0;
        pointer.current.y = 0;
      }

      u.lastX = event.clientX;
      u.lastY = event.clientY;

      if (u.mode === "orbit") {
        u.azOff = clamp(u.azOff - dx * ORBIT_SENS, -MAX_AZ_OFF, MAX_AZ_OFF);
        u.elOff = clamp(u.elOff + dy * ORBIT_SENS, -MAX_EL_OFF, MAX_EL_OFF);
        moving.current = false; // hold designed lerp while user aims
        invalidate();
        return;
      }

      if (u.mode === "pan") {
        // Pan on the board plane using current azimuth (right + forward-flat).
        const az = current.current.azimuth + u.azOff;
        const rightX = Math.cos(az);
        const rightZ = -Math.sin(az);
        const fwdX = -Math.sin(az);
        const fwdZ = -Math.cos(az);
        const scale = current.current.radius * PAN_SENS;
        u.txOff = clamp(u.txOff - (rightX * dx + fwdX * dy) * scale, -MAX_PAN, MAX_PAN);
        u.tzOff = clamp(u.tzOff - (rightZ * dx + fwdZ * dy) * scale, -MAX_PAN, MAX_PAN);
        moving.current = false;
        invalidate();
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      nudgeZoom(event.deltaY > 0 ? -1 : 1);
      invalidate();
    };

    const onContext = (event: Event) => {
      // RMB pan — block browser menu on the canvas.
      event.preventDefault();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContext);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
      canvas.style.cursor = "";
      canvas.style.touchAction = "";
    };
  }, [gl, invalidate, reducedMotion, flags.topDown]);

  // WASD board pan — window-level so canvas need not steal focus (ledger stays
  // the a11y surface). Ignore when typing in form fields / contenteditable.
  useEffect(() => {
    if (reducedMotion) return;

    const onDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!WASD_CODES.has(event.code)) return;
      if (typingTarget(event.target)) return;
      if (keys.current.has(event.code)) return;
      keys.current.add(event.code);
      event.preventDefault();
      moving.current = false;
      // Kill hover parallax while driving.
      pointer.current.x = 0;
      pointer.current.y = 0;
      invalidate();
    };
    const onUp = (event: KeyboardEvent) => {
      if (!WASD_CODES.has(event.code)) return;
      keys.current.delete(event.code);
      invalidate();
    };
    const clear = () => {
      if (keys.current.size === 0) return;
      keys.current.clear();
      invalidate();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      keys.current.clear();
    };
  }, [invalidate, reducedMotion]);

  useFrame((_, delta) => {
    const state = current.current;
    const u = user.current;
    const dragging = u.mode === "orbit" || u.mode === "pan";
    const keying = keys.current.size > 0;
    const driving = dragging || keying;

    // WASD: camera-relative pan on the board plane, same MAX_PAN as mouse.
    // W/S along look flat; A/D along camera right. Diagonal keys normalize.
    if (keying && !reducedMotion) {
      const held = keys.current;
      let mx = 0;
      let mz = 0;
      if (held.has("KeyW")) mz += 1;
      if (held.has("KeyS")) mz -= 1;
      if (held.has("KeyA")) mx -= 1;
      if (held.has("KeyD")) mx += 1;
      if (mx !== 0 || mz !== 0) {
        const len = Math.hypot(mx, mz) || 1;
        mx /= len;
        mz /= len;
        const az = state.azimuth + u.azOff;
        const rightX = Math.cos(az);
        const rightZ = -Math.sin(az);
        // Flat look dir matches camera → target on XZ (see position solve below).
        const fwdX = -Math.sin(az);
        const fwdZ = -Math.cos(az);
        const step = KEY_PAN_SPEED * Math.min(delta, 0.05);
        u.txOff = clamp(u.txOff + (rightX * mx + fwdX * mz) * step, -MAX_PAN, MAX_PAN);
        u.tzOff = clamp(u.tzOff + (rightZ * mx + fwdZ * mz) * step, -MAX_PAN, MAX_PAN);
        moving.current = false;
      }
    }

    if (reducedMotion) {
      state.azimuth = want.azimuth;
      state.elevation = want.elevation;
      state.radius = want.radius;
      state.fov = want.fov;
      state.target = [...want.target] as [number, number, number];
      parallax.current.x = 0;
      parallax.current.y = 0;
      moving.current = false;
    } else if (moving.current && !driving) {
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
    } else if (!driving) {
      // Keep radius/fov in sync with zoom steps without yanking orbit offsets.
      const k = 1 - Math.exp(-delta * 6);
      state.radius = lerp(state.radius, want.radius, k);
      state.fov = lerp(state.fov, want.fov, k);
    }

    let drifting = false;
    if (!reducedMotion && !flags.topDown && !driving) {
      const k = 1 - Math.exp(-delta * 3.6);
      const x = clamp(pointer.current.x, -1, 1) * PARALLAX_AZIMUTH;
      const y = clamp(pointer.current.y, -1, 1) * PARALLAX_ELEVATION;
      parallax.current.x = lerp(parallax.current.x, x, k);
      parallax.current.y = lerp(parallax.current.y, y, k);
      drifting =
        Math.abs(parallax.current.x - x) > 0.0002 || Math.abs(parallax.current.y - y) > 0.0002;
    } else {
      parallax.current.x = 0;
      parallax.current.y = 0;
    }

    const azimuth = state.azimuth + u.azOff + parallax.current.x;
    const elevation = clamp(
      state.elevation + u.elOff + parallax.current.y,
      MIN_ELEVATION,
      MAX_ELEVATION,
    );

    // Target clamp: keep the look-point on the board.
    const limitX = MAP_WORLD.width * 0.48;
    const limitZ = MAP_WORLD.height * 0.48;
    const tx = clamp(state.target[0] + u.txOff, -limitX, limitX);
    const tz = clamp(state.target[2] + u.tzOff, -limitZ, limitZ);

    targetVec.set(tx, SURFACE_Y, tz);
    const flat = Math.cos(elevation) * state.radius;
    position.set(
      targetVec.x + Math.sin(azimuth) * flat,
      targetVec.y + Math.sin(elevation) * state.radius,
      targetVec.z + Math.cos(azimuth) * flat,
    );
    // Hard floor — never under the table.
    if (position.y < 0.08) position.y = 0.08;

    camera.position.copy(position);
    camera.up.set(0, 1, 0);
    camera.lookAt(targetVec);
    if (Math.abs(camera.fov - state.fov) > 0.001) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
    if (moving.current || drifting || driving) invalidate();
  });

  return null;
}
