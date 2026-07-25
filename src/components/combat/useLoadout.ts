"use client";

import { useEffect, useState } from "react";
import type { CombatStyle } from "@/combat/types";

/** Shared combat loadout: Build writes, Rotation and Analysis read. Persisted to
 *  localStorage under eq:loadout:v1, same pattern as the league build store. */
export interface Loadout {
  style: CombatStyle;
  level: number;
  base: number;
  /** 0-100 percentages, as the UI presents them. */
  accuracy: number;
  critChance: number;
  /** Selected data/combat equipment record ids (organisational — stat bonuses are
   *  unsourced per item and stay empty until the corpus lands them). */
  equipmentIds: string[];
}

export const DEFAULT_LOADOUT: Loadout = {
  style: "melee",
  level: 99,
  base: 1000,
  accuracy: 100,
  critChance: 10,
  equipmentIds: [],
};

const KEY = "eq:loadout:v1";

function normalize(value: unknown): Loadout {
  if (typeof value !== "object" || value === null) return DEFAULT_LOADOUT;
  const raw = value as Partial<Loadout>;
  return {
    style: ["melee", "ranged", "magic", "necromancy"].includes(raw.style as string)
      ? (raw.style as CombatStyle)
      : DEFAULT_LOADOUT.style,
    level: Number.isFinite(raw.level) ? Number(raw.level) : DEFAULT_LOADOUT.level,
    base: Number.isFinite(raw.base) ? Number(raw.base) : DEFAULT_LOADOUT.base,
    accuracy: Number.isFinite(raw.accuracy) ? Number(raw.accuracy) : DEFAULT_LOADOUT.accuracy,
    critChance: Number.isFinite(raw.critChance) ? Number(raw.critChance) : DEFAULT_LOADOUT.critChance,
    equipmentIds: Array.isArray(raw.equipmentIds)
      ? raw.equipmentIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function useLoadout() {
  const [loadout, setLoadout] = useState<Loadout>(DEFAULT_LOADOUT);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored) setLoadout(normalize(JSON.parse(stored)));
    } catch {
      // Corrupt storage falls back to defaults.
    }
  }, []);

  const update = (next: Loadout) => {
    setLoadout(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage full/blocked — the session state still works.
    }
  };

  return [loadout, update] as const;
}
