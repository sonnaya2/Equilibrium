"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LOADOUT,
  LOADOUT_STORAGE_KEY,
  normalizeLoadout,
  pruneUnknownEquipment,
  type Loadout,
} from "./model";

/** React + localStorage integration over pure loadout model functions. */
export function useLoadout() {
  const [loadout, setLoadout] = useState<Loadout>(DEFAULT_LOADOUT);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOADOUT_STORAGE_KEY);
      if (!stored) return;
      const cleaned = pruneUnknownEquipment(normalizeLoadout(JSON.parse(stored)));
      setLoadout(cleaned);
      // Persist prune so retired/orphan ids do not reappear every boot.
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
        setLoadout((current) => {
          const normalized = pruneUnknownEquipment(normalizeLoadout(current));
          try {
            window.localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(normalized));
          } catch {
            // Storage full/blocked - expiry still applies in memory.
          }
          return normalized;
        });
      },
      Math.max(0, until - now) + 20,
    );
    return () => window.clearTimeout(timeout);
  }, [loadout.buffs.powerburstOfVitalityUntil, loadout.buffs.powerburstOfVitalityCooldownUntil]);

  const update = (next: Loadout) => {
    const withLevels = next.style === "melee" ? { ...next, level: next.strengthLevel } : next;
    const normalized = pruneUnknownEquipment(normalizeLoadout(withLevels));
    setLoadout(normalized);
    try {
      window.localStorage.setItem(LOADOUT_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Storage full/blocked - session state still works.
    }
  };

  return [loadout, update] as const;
}
