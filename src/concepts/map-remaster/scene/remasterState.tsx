"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { RegionId } from "@/league";
import type { RemasterSkin } from "./skins";

export type RemasterFocus = {
  region: RegionId | null;
  place: string | null;
};

type RemasterApi = {
  skin: RemasterSkin;
  focus: RemasterFocus;
  setRegion: (id: RegionId | null) => void;
  setPlace: (area: string | null) => void;
  unlocked: ReadonlySet<RegionId>;
};

const Ctx = createContext<RemasterApi | null>(null);

const DEFAULT_UNLOCKED: RegionId[] = ["misthalin", "asgarnia", "havenhythe"];

export function RemasterProvider({
  skin,
  children,
  initialRegion = "misthalin",
}: {
  skin: RemasterSkin;
  children: ReactNode;
  initialRegion?: RegionId;
}) {
  const [region, setRegionState] = useState<RegionId | null>(initialRegion);
  const [place, setPlace] = useState<string | null>(null);
  const unlocked = useMemo(() => new Set<RegionId>(DEFAULT_UNLOCKED), []);

  const api = useMemo<RemasterApi>(
    () => ({
      skin,
      focus: { region, place },
      setRegion: (id) => {
        setRegionState(id);
        setPlace(null);
      },
      setPlace,
      unlocked,
    }),
    [skin, region, place, unlocked],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRemaster(): RemasterApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRemaster outside RemasterProvider");
  return v;
}
