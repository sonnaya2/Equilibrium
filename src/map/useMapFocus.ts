"use client";

import { useSyncExternalStore } from "react";
import type { RegionId } from "@/league";

/**
 * What the map route is currently looking at.
 *
 * Separate from the build store on purpose: picks are persisted player state,
 * focus is view state and dies with the page. It lives outside React for the
 * same reason useBuild does — the ledger, the inspector, the flat board and the
 * canvas all read it, and they are not in one subtree.
 *
 * `place` is the highlighted content row, which is the map-to-data link: hover
 * a row and its marker lights on the board, hover a marker and its row does.
 */

export interface MapFocus {
  /** The inspector's subject. Always set — the panel is never blank. */
  region: RegionId;
  /** Whether the camera is pushed in on that region, or back on the table shot.
   *  Clicking the board's empty water pulls out without emptying the inspector. */
  framed: boolean;
  place: string | null;
}

let state: MapFocus = { region: "misthalin", framed: false, place: null };
const listeners = new Set<() => void>();

// Stable reference or useSyncExternalStore loops on the server snapshot.
const SERVER_SNAPSHOT: MapFocus = { region: "misthalin", framed: false, place: null };

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

export function useMapFocus() {
  const focus = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
  return {
    focus,
    /** Focusing a region clears the place: they belong to different regions. */
    focusRegion: (region: RegionId) => {
      if (state.region !== region || !state.framed) emit({ region, framed: true, place: null });
    },
    /** Back to the table shot; the inspector keeps its subject. */
    unframe: () => {
      if (state.framed) emit({ ...state, framed: false });
    },
    focusPlace: (place: string | null) => {
      if (state.place !== place) emit({ ...state, place });
    },
  };
}
