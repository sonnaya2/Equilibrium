"use client";

import { useEffect, useState } from "react";
import type { AffinityKind } from "@/combat/target/genericTarget";
import type { CombatStyle } from "@/combat/types";

/** Shared combat loadout: Build writes, Rotation and Analysis read. Persisted to
 *  localStorage under eq:loadout:v1; older stored shapes normalize forward. */
export interface LoadoutTarget {
  defenceLevel: number;
  affinity: AffinityKind;
}

export interface LoadoutPerks {
  equilibrium: number;
  ultimatums: number;
  lunging: number;
  energising: number;
  tectonicPieces: number;
  eliteTectonic: boolean;
  tumekensPieces: number;
  insideSunshine: boolean;
}

export interface Loadout {
  style: CombatStyle;
  level: number;
  /** Weapon tier feeding baseAbilityDamage and playerAccuracy. */
  weaponTier: number;
  /** Manual base override; NaN means "compute from level + weapon tier". */
  base: number;
  /** 0-100 percentages, as the UI presents them. */
  accuracy: number;
  critChance: number;
  /** When set, Damage Potential comes from the target model instead of accuracy%. */
  target: LoadoutTarget | null;
  perks: LoadoutPerks;
  /** Selected data/combat equipment record ids (organisational — stat bonuses are
   *  unsourced per item and stay empty until the corpus lands them). */
  equipmentIds: string[];
}

export const DEFAULT_LOADOUT: Loadout = {
  style: "melee",
  level: 99,
  weaponTier: 90,
  base: 1000,
  accuracy: 100,
  critChance: 10,
  target: null,
  perks: {
    equilibrium: 0,
    ultimatums: 0,
    lunging: 0,
    energising: 0,
    tectonicPieces: 0,
    eliteTectonic: false,
    tumekensPieces: 0,
    insideSunshine: false,
  },
  equipmentIds: [],
};

const KEY = "eq:loadout:v1";
const STYLES = ["melee", "ranged", "magic", "necromancy"];
const AFFINITIES = ["weak", "same", "strong", "weakness"];

const clampRank = (value: unknown, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(0, Math.floor(Number(value))), max) : 0;
const num = (value: unknown, fallback: number) => (Number.isFinite(value) ? Number(value) : fallback);

function normalize(value: unknown): Loadout {
  if (typeof value !== "object" || value === null) return DEFAULT_LOADOUT;
  const raw = value as Partial<Loadout>;
  const rawPerks = (raw.perks ?? {}) as Partial<LoadoutPerks>;
  const rawTarget = raw.target as Partial<LoadoutTarget> | null | undefined;
  return {
    style: STYLES.includes(raw.style as string) ? (raw.style as CombatStyle) : DEFAULT_LOADOUT.style,
    level: num(raw.level, DEFAULT_LOADOUT.level),
    weaponTier: num(raw.weaponTier, DEFAULT_LOADOUT.weaponTier),
    base: num(raw.base, DEFAULT_LOADOUT.base),
    accuracy: num(raw.accuracy, DEFAULT_LOADOUT.accuracy),
    critChance: num(raw.critChance, DEFAULT_LOADOUT.critChance),
    target:
      rawTarget && AFFINITIES.includes(rawTarget.affinity as string)
        ? {
            defenceLevel: num(rawTarget.defenceLevel, 80),
            affinity: rawTarget.affinity as AffinityKind,
          }
        : null,
    perks: {
      equilibrium: clampRank(rawPerks.equilibrium, 5),
      ultimatums: clampRank(rawPerks.ultimatums, 4),
      lunging: clampRank(rawPerks.lunging, 4),
      energising: clampRank(rawPerks.energising, 4),
      tectonicPieces: clampRank(rawPerks.tectonicPieces, 5),
      eliteTectonic: rawPerks.eliteTectonic === true,
      tumekensPieces: clampRank(rawPerks.tumekensPieces, 5),
      insideSunshine: rawPerks.insideSunshine === true,
    },
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
