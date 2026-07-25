"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { loadState, saveState } from "@/lib/storage";
import { readBuildFromLocation } from "./share";
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

export function useBuild() {
  // Server snapshot stays the empty build so hydration matches; real state
  // loads from localStorage after mount.
  const build = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT);
  const [loaded, setLoaded] = useState(hydrated);

  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      const shared = readBuildFromLocation();
      setState(shared ?? normalizeBuild(loadState(STORAGE_KEY, emptyBuild())));
    }
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
    resetBuild: () => setState(emptyBuild()),
  };
}
