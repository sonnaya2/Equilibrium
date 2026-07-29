"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { isRegionId, type RegionId } from "@/league";

/**
 * Route-local view state shared by the board, canvas, ledger, and inspector.
 * `place` is sticky selection; `hover` is transient pointer state.
 */

export interface MapFocus {
  /** The inspector's subject. Always set — the panel is never blank. */
  region: RegionId;
  /** Whether the camera is pushed in on that region, or back on the table shot.
   *  Clicking the board's empty water pulls out without emptying the inspector. */
  framed: boolean;
  /** Sticky: survives pointer-out, cleared only by selecting elsewhere. */
  place: string | null;
  /** Transient: dies on pointer-out. Never drives the camera. */
  hover: string | null;
  /**
   * Designed zoom step on the spherical solve (not free orbit).
   * Higher = closer. Multiplies framing radius by ZOOM_STEP_MUL^zoom.
   */
  zoom: number;
  /**
   * Flat board instead of the 3D one, by choice rather than by capability.
   *
   * Separate from the WebGPU probe in MapScene: that one reports what the
   * browser can do, this one reports what the player wants. Both land on
   * FlatBoard, and the planner is complete either way — the 3D is the good
   * version of the experience, not a dependency of it.
   */
  flat: boolean;
}

/** Zoom in raises this; zoom out lowers it. */
export const ZOOM_MIN = -2;
/**
 * Closer end of the designed zoom ladder. Was 4 (~2.2× radius); 10 reaches
 * ~7× base so pins and coasts can be inspected without fighting the clamp.
 */
export const ZOOM_MAX = 10;
/** Radius scale per zoom step — <1 means zoom-in shortens the shot. */
export const ZOOM_STEP_MUL = 0.82;

/** Remembered across visits — a 2D preference is a preference, not a session. */
export const FLAT_STORAGE_KEY = "eq:map:flat:v1";

const INITIAL: MapFocus = {
  region: "misthalin",
  framed: false,
  place: null,
  hover: null,
  zoom: 0,
  flat: false,
};

let state: MapFocus = INITIAL;
const listeners = new Set<() => void>();

// Stable reference or useSyncExternalStore loops on the server snapshot.
const SERVER_SNAPSHOT: MapFocus = INITIAL;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: MapFocus) {
  state = next;
  listeners.forEach((l) => l());
}

/** Read the store outside React — deep-link parsing runs before any render. */
export function mapFocusSnapshot(): MapFocus {
  return state;
}

export function focusRegionExternal(region: RegionId, place: string | null = null) {
  emit({ ...state, region, framed: true, place, hover: null });
}

/** Focusing a region clears both place slots: they belong to another region. */
export function focusRegion(region: RegionId) {
  if (state.region !== region || !state.framed || state.place !== null) {
    emit({ ...state, region, framed: true, place: null, hover: null });
  }
}

/** Back to the table shot; the inspector keeps its subject and its pin. */
export function unframe() {
  if (state.framed) emit({ ...state, framed: false });
}

/**
 * The click. Sticky, and a non-null pick frames the region so the pin is on
 * screen. Re-selecting the same place while unframed re-frames without toggle.
 * Hover is never written here — pointer-out must not erase a pin.
 */
export function selectPlace(place: string | null) {
  if (state.place === place) {
    if (place !== null && !state.framed) emit({ ...state, framed: true });
    return;
  }
  emit({ ...state, framed: place === null ? state.framed : true, place });
}

let hoverRaf = 0;
let hoverQueued: string | null | undefined;

/**
 * Coalesce hover emits to one per animation frame.
 * Unthrottled pointerenter/leave across many pins was a Cascading Update storm
 * through every useMapFocus subscriber (ledger, inspector, canvas).
 */
export function hoverPlace(hover: string | null) {
  // Clear immediately so pointer-out never leaves a sticky hover highlight.
  if (hover === null) {
    hoverQueued = undefined;
    if (hoverRaf) {
      cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
    }
    if (state.hover !== null) emit({ ...state, hover: null });
    return;
  }
  if (state.hover === hover) return;
  hoverQueued = hover;
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    const next = hoverQueued;
    hoverQueued = undefined;
    if (next === undefined || state.hover === next) return;
    emit({ ...state, hover: next });
  });
}

/** Step the designed zoom. +1 closer, −1 wider. Clamped; keeps spherical solve. */
export function nudgeZoom(delta: number) {
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom + delta));
  if (next !== state.zoom) emit({ ...state, zoom: next });
}

export function setZoom(zoom: number) {
  const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(zoom)));
  if (next !== state.zoom) emit({ ...state, zoom: next });
}

/** Persists a view-only preference outside build shares and exports. */
export function setFlatBoard(flat: boolean) {
  if (state.flat === flat) return;
  try {
    window.localStorage.setItem(FLAT_STORAGE_KEY, flat ? "1" : "0");
  } catch {
    // Storage failure leaves the preference session-only.
  }
  emit({ ...state, flat });
}

/** Read the stored preference once, after mount. Server snapshot stays false. */
export function hydrateFlatBoard() {
  try {
    if (window.localStorage.getItem(FLAT_STORAGE_KEY) === "1" && !state.flat) {
      emit({ ...state, flat: true });
    }
  } catch {
    // Nothing stored, or storage unavailable.
  }
}

export function zoomRadiusMul(zoom: number = state.zoom): number {
  return Math.pow(ZOOM_STEP_MUL, zoom);
}

/**
 * Synchronizes `#region=<id>[&place=<area>]` with replaceState. Framing does not
 * create history entries, and replaceState avoids a hashchange feedback loop.
 */
export function useMapHashSync() {
  const { focus } = useMapFocus();
  // Only strip a stale hash when we *transition* into rest. Cold mount is rest
  // with INITIAL before apply() — clearing there would eat a deep link.
  const prevActive = useRef(false);

  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const region = params.get("region");
      if (!region || !isRegionId(region)) return;
      const raw = params.get("place");
      const place = raw && raw.length > 0 ? raw : null;
      focusRegionExternal(region, place);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    const active = focus.framed || focus.place !== null;
    if (!active) {
      if (prevActive.current && window.location.hash.startsWith("#region=")) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }
      prevActive.current = false;
      return;
    }
    prevActive.current = true;
    const next = focus.place
      ? `#region=${focus.region}&place=${encodeURIComponent(focus.place)}`
      : `#region=${focus.region}`;
    if (window.location.hash !== next) history.replaceState(null, "", next);
  }, [focus.region, focus.place, focus.framed]);
}

export function useMapFocus() {
  const focus = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_SNAPSHOT,
  );
  // Module-level actions stay identity-stable for effect deps (PlaceList hover clear).
  return {
    focus,
    focusRegion,
    unframe,
    selectPlace,
    hoverPlace,
    nudgeZoom,
    setZoom,
    setFlatBoard,
  };
}
