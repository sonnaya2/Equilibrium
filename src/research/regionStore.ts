"use client";

import { useEffect, useState } from "react";
import type { ResearchRegion } from "./catalog";

const regions = new Map<string, ResearchRegion>();
const pending = new Map<string, Promise<ResearchRegion>>();

function loadResearchRegion(id: string): Promise<ResearchRegion> {
  const loaded = regions.get(id);
  if (loaded) return Promise.resolve(loaded);

  const active = pending.get(id);
  if (active) return active;

  if (!/^[a-z0-9-]+$/.test(id)) return Promise.reject(new Error(`Invalid region id: ${id}`));

  const request = fetch(`/data/regions/${id}`, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Region data returned ${response.status}`);
      return response.json() as Promise<ResearchRegion>;
    })
    .then((region) => {
      if (region.id !== id)
        throw new Error(`Region data mismatch: expected ${id}, got ${region.id}`);
      regions.set(id, region);
      pending.delete(id);
      return region;
    })
    .catch((error) => {
      pending.delete(id);
      throw error;
    });

  pending.set(id, request);
  return request;
}

export function useResearchRegion(id: string) {
  const [region, setRegion] = useState<ResearchRegion | null>(() => regions.get(id) ?? null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setRegion(regions.get(id) ?? null);
    setError("");
    loadResearchRegion(id).then(
      (next) => {
        if (live) setRegion(next);
      },
      (reason) => {
        if (live) setError(reason instanceof Error ? reason.message : "Region data failed to load");
      },
    );
    return () => {
      live = false;
    };
  }, [id]);

  return { region, error };
}
