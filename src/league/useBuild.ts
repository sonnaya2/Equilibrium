"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { loadState, saveState } from "@/lib/storage";
import {
  emptyBuild,
  normalizeBuild,
  STORAGE_KEY,
  toggleElective,
  type BuildState,
  type RegionId,
} from "./index";

/**
 * One shared build store for the whole app — map, planner, build, and combat
 * all read and mutate this single instance. Module-local state is only ever
 * written client-side (user actions, localStorage hydrate); server renders
 * always see the empty build.
 */

let state: BuildState = emptyBuild();
let hydrated = false;
const listeners = new Set<() => void>();

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
  const build = useSyncExternalStore(subscribe, () => state, emptyBuild);
  const [loaded, setLoaded] = useState(hydrated);

  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      setState(normalizeBuild(loadState(STORAGE_KEY, emptyBuild())));
    }
    setLoaded(true);
  }, []);

  return {
    build,
    loaded,
    toggleRegion: (id: RegionId) => setState(toggleElective(build, id)),
    resetBuild: () => setState(emptyBuild()),
  };
}
