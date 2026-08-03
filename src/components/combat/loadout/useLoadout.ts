"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_LOADOUT,
  LOADOUT_STORAGE_KEY,
  normalizeLoadout,
  pruneUnknownEquipment,
  type Loadout,
} from "./model";

export type SetLoadout = (next: Loadout | ((prev: Loadout) => Loadout)) => void;

function persist(loadout: Loadout): Loadout {
  const withLevels =
    loadout.style === "melee" ? { ...loadout, level: loadout.strengthLevel } : loadout;
  const normalized = pruneUnknownEquipment(normalizeLoadout(withLevels));
  try {
    window.localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage full/blocked - session state still works.
  }
  return normalized;
}

/** React + localStorage integration over pure loadout model functions. */
export function useLoadout(): readonly [Loadout, SetLoadout] {
  const [loadout, setLoadoutState] = useState<Loadout>(DEFAULT_LOADOUT);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOADOUT_STORAGE_KEY);
      if (!stored) return;
      const cleaned = pruneUnknownEquipment(normalizeLoadout(JSON.parse(stored)));
      setLoadoutState(cleaned);
      try {
        window.localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(cleaned));
      } catch {
        // Storage full/blocked - in-memory prune still applies.
      }
    } catch {
      // Corrupt storage falls back to defaults.
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    const deadlines = [
      loadout.buffs.powerburstOfVitalityUntil,
      loadout.buffs.powerburstOfVitalityCooldownUntil,
    ].filter((deadline): deadline is number => deadline != null && deadline > now);
    if (deadlines.length === 0) return;
    const until = Math.min(...deadlines);
    const timeout = window.setTimeout(
      () => {
        setLoadoutState((current) => persist(current));
      },
      Math.max(0, until - now) + 20,
    );
    return () => window.clearTimeout(timeout);
  }, [loadout.buffs.powerburstOfVitalityUntil, loadout.buffs.powerburstOfVitalityCooldownUntil]);

  const update = useCallback<SetLoadout>((next) => {
    setLoadoutState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      return persist(resolved);
    });
  }, []);

  return [loadout, update] as const;
}
