"use client";

import { useEffect, useState } from "react";
import { loadState, saveState } from "@/lib/storage";
import {
  emptyBuild,
  normalizeBuild,
  STORAGE_KEY,
  toggleElective,
  type BuildState,
  type RegionId,
} from "./index";

export function useBuild() {
  const [build, setBuild] = useState<BuildState>(emptyBuild);
  const [loaded, setLoaded] = useState(false);

  // localStorage is client-only; hydrate after mount so server and first client render agree.
  useEffect(() => {
    setBuild(normalizeBuild(loadState(STORAGE_KEY, emptyBuild())));
    setLoaded(true);
  }, []);

  const update = (next: BuildState) => {
    setBuild(next);
    saveState(STORAGE_KEY, next);
  };

  return {
    build,
    loaded,
    toggleRegion: (id: RegionId) => update(toggleElective(build, id)),
    resetBuild: () => update(emptyBuild()),
  };
}
