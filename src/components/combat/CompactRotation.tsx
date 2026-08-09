"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import { abilityIconPath } from "@/lib/gameArt";
import { loadState } from "@/lib/storage";
import { GameIcon } from "../GameIcon";
import { abilityTtkLabel } from "./abilityTtkPresentation";
import { CombatFrame } from "./CombatFrame";
import type { CalcStats } from "./loadoutStats";
import { loadActiveRevoBar, loadRotationMode } from "./revoBarLibrary";
import { defaultRevoBarIds } from "./revoBarResolve";
import type { Loadout } from "./useLoadout";

const STORAGE_KEY = "eq:rotation:v1";
const DISPLAY_LIMIT = 14;
const CATALOGUE = resolveAbilityCatalogue();

function readManualRotation(): string[] {
  const stored = loadState<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter((id): id is string => typeof id === "string" && CATALOGUE.byId.has(id));
}

function readRotation(style: string, stats: CalcStats): string[] {
  if (loadRotationMode() === "manual") return readManualRotation();
  return (
    loadActiveRevoBar(style, stats.weaponConfiguration) ??
    defaultRevoBarIds(style, stats.weaponConfiguration, {
      passiveIds: stats.equipmentEffects.passiveIds,
      equipmentIds: stats.equipmentIds,
    })
  ).filter((id) => CATALOGUE.byId.has(id));
}

export function CompactRotation({
  style,
  stats,
  loadout,
  onOpenRotation,
}: {
  style: string;
  stats: CalcStats;
  loadout: Loadout;
  onOpenRotation: () => void;
}) {
  const [queue, setQueue] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setQueue(readRotation(style, stats));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("eq:rotation:changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("eq:rotation:changed", sync);
    };
  }, [stats, style]);

  const visibleQueue = useMemo(() => queue.slice(0, DISPLAY_LIMIT), [queue]);
  const maxLp = loadout.target?.maximumLifePoints;
  const dp = stats.dp;
  const base = stats.base;

  return (
    <CombatFrame
      as="section"
      className="setup-rotation-card"
      aria-labelledby="compact-rotation-title"
    >
      <header className="setup-card-header">
        <h2 id="compact-rotation-title" className="combat-section-title">
          Rotation
        </h2>
      </header>
      <button
        type="button"
        className="compact-rotation-surface"
        onClick={onOpenRotation}
        aria-label={
          visibleQueue.length
            ? `Open rotation editor, ${queue.length} abilities loaded`
            : "Open rotation editor"
        }
      >
        {visibleQueue.length ? (
          <ol className="compact-rotation-list">
            {visibleQueue.map((id, index) => {
              const ability = CATALOGUE.byId.get(id);
              if (!ability) return null;
              const ttk = abilityTtkLabel(base, ability, dp, maxLp);
              return (
                <li
                  key={`${id}-${index}`}
                  title={`${index + 1}. ${ability.name} · est. TTK ${ttk} (band midpoint × DP; not full sim)`}
                  aria-label={`${index + 1}. ${ability.name}, estimated time to kill ${ttk}`}
                >
                  <GameIcon src={abilityIconPath(ability.id, ability.style)} size={30} />
                  <span className="compact-rotation-ttk" aria-hidden>
                    {ttk}
                  </span>
                  <span className="sr-only">{ability.name}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="compact-rotation-empty">No bar loaded. Click to open rotation.</p>
        )}
      </button>
    </CombatFrame>
  );
}
