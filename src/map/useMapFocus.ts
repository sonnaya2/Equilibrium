"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isRegionId, type RegionId } from "@/league";

/**
 * What the map route is currently looking at.
 *
 * Separate from the build store on purpose: picks are persisted player state,
 * focus is view state and dies with the page. It lives outside React for the
 * same reason useBuild does — the ledger, the inspector, the flat board and the
 * canvas all read it, and they are not in one subtree.
 *
 * Two place slots, not one. `place` is the sticky selection a click makes and a
 * pointer-out must not erase — it is what the inspector scrolls to, what the
 * camera pushes toward, and what the deep link carries. `hover` is the transient
 * pointer highlight. Collapsing them (the original design) meant there was no
 * selection to sync against at all: moving the mouse off a marker cleared the
 * only state either side could have read.
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
}

const INITIAL: MapFocus = { region: "misthalin", framed: false, place: null, hover: null };

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
  emit({ region, framed: true, place, hover: null });
}

/**
 * `#region=<id>[&place=<area>]`, both ways.
 *
 * replaceState, never push: framing a region is looking around a page, not
 * navigating, and a history entry per glance makes the back button useless.
 * replaceState also does not fire `hashchange`, so the read and write halves
 * cannot feed each other — no suppression flag needed here.
 *
 * Call once, from the route's client boundary.
 */
export function useMapHashSync() {
  const { focus } = useMapFocus();

  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const region = params.get("region");
      if (region && isRegionId(region)) focusRegionExternal(region, params.get("place"));
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    // Nothing framed and nothing pinned is the resting state, not a view worth
    // a URL — a fresh visit should stay on a clean /map.
    if (!focus.framed && !focus.place) return;
    const next = focus.place
      ? `#region=${focus.region}&place=${encodeURIComponent(focus.place)}`
      : `#region=${focus.region}`;
    if (window.location.hash !== next) history.replaceState(null, "", next);
  }, [focus.region, focus.place, focus.framed]);
}

export function useMapFocus() {
  const focus = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
  return {
    focus,
    /** Focusing a region clears both place slots: they belong to another region. */
    focusRegion: (region: RegionId) => {
      if (state.region !== region || !state.framed || state.place !== null) {
        emit({ region, framed: true, place: null, hover: null });
      }
    },
    /** Back to the table shot; the inspector keeps its subject and its pin. */
    unframe: () => {
      if (state.framed) emit({ ...state, framed: false });
    },
    /** The click. Sticky, and it frames the region so the pin is on screen. */
    selectPlace: (place: string | null) => {
      if (state.place === place) return;
      emit({ ...state, framed: place === null ? state.framed : true, place });
    },
    /** The pointer. Transient, never touches the selection. */
    hoverPlace: (hover: string | null) => {
      if (state.hover !== hover) emit({ ...state, hover });
    },
  };
}
