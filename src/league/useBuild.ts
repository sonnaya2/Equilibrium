"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { loadState, saveState } from "@/lib/storage";
import {
  emptyBuild,
  normalizeBuild,
  pickBlessing,
  resetBlessings,
  STORAGE_KEY,
  toggleElective,
  toggleRelic,
  type BuildState,
  type RegionId,
} from "./index";
import type { BlessingPath } from "./blessings";

/**
 * One shared build store for the whole app — map, planner, build, and combat
 * all read and mutate this single instance. Module-local state is only ever
 * written client-side (user actions, localStorage hydrate); server renders
 * always see the empty build.
 *
 * Share links are owned by ShareImport (layout). This module only hydrates
 * localStorage and exposes applyBuild for that one-shot import path.
 */

let state: BuildState = emptyBuild();
let hydrated = false;
const listeners = new Set<() => void>();

// Must be a stable reference: a fresh object per call makes useSyncExternalStore
// loop on the server snapshot.
const SERVER_SNAPSHOT: BuildState = emptyBuild();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(next: BuildState) {
  state = next;
  saveState(STORAGE_KEY, next);
  listeners.forEach((l) => l());
}

export function buildHasContent(b: BuildState): boolean {
  return (
    b.elective.length > 0 ||
    Object.keys(b.relics).length > 0 ||
    b.blessingPicks.length > 0 ||
    b.blessingResetsUsed > 0
  );
}

export function buildsEqual(a: BuildState, b: BuildState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Load localStorage once. Idempotent — ShareImport and useBuild both call this. */
export function hydrateLocalBuild(): BuildState {
  if (hydrated) return state;
  hydrated = true;
  // normalizeBuild owns shape validation; loadState passes raw parse through.
  state = loadState(STORAGE_KEY, emptyBuild(), normalizeBuild);
  listeners.forEach((l) => l());
  return state;
}

/** Replace store + persist (share import, reset). Marks hydrated. */
export function applyBuild(next: BuildState): void {
  hydrated = true;
  setState(next);
}

export function getBuildState(): BuildState {
  return state;
}

export function useBuild() {
  // Server snapshot stays the empty build so hydration matches; real state
  // loads from localStorage after mount. Share hashes are handled only by
  // ShareImport so any route can import without double-apply.
  const build = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
  // Always false on the first render, never seeded from `hydrated`.
  //
  // That module flag is shared and mutable: ShareImport hydrates the store from
  // the layout, so by the time a component behind a Suspense boundary hydrates,
  // `hydrated` is already true — and seeding from it made the client's first
  // render disagree with the server HTML that was built while it was false.
  // React reported that as an unpatchable `disabled` mismatch on Clear picks.
  //
  // `build` never had this problem because useSyncExternalStore uses the server
  // snapshot for the hydration render too. This has to match that discipline.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    hydrateLocalBuild();
    setLoaded(true);
  }, []);

  return {
    build,
    loaded,
    toggleRegion: (id: RegionId) => setState(toggleElective(state, id)),
    toggleRelic: (tier: number, name: string) => setState(toggleRelic(state, tier, name)),
    pickBlessing: (pathTier: number, path: BlessingPath) =>
      setState(pickBlessing(state, pathTier, path)),
    resetBlessings: () => setState(resetBlessings(state)),
    /** Electives only — relics and blessings stay. Map "Clear picks" uses this. */
    clearElectives: () =>
      setState(state.elective.length === 0 ? state : { ...state, elective: [] }),
    resetBuild: () => setState(emptyBuild()),
  };
}
