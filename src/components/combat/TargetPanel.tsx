"use client";

import type { AffinityKind } from "@/combat/target/genericTarget";
import { NumberField } from "./NumberField";
import type { Loadout } from "./useLoadout";

/** NPC target model — when on, DP follows the hit-chance chain instead of accuracy%. */
export function TargetPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Target</h2>
      <p className="mt-1 text-xs text-parch-300">
        Uses Defence and affinity for Damage Potential.
      </p>
      <div className="loadout-fields mt-3">
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.target !== null}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                target: event.target.checked ? { defenceLevel: 80, affinity: "same" } : null,
              })
            }
          />
          Use NPC target model
        </label>
        {loadout.target ? (
          <>
            <NumberField
              label="Defence level"
              value={loadout.target.defenceLevel}
              onChange={(defenceLevel) =>
                setLoadout({ ...loadout, target: { ...loadout.target!, defenceLevel } })
              }
            />
            <label className="grid grid-cols-[1fr_110px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <span>Affinity</span>
              <select
                value={loadout.target.affinity}
                onChange={(event) =>
                  setLoadout({
                    ...loadout,
                    target: {
                      ...loadout.target!,
                      affinity: event.target.value as AffinityKind,
                    },
                  })
                }
                className="w-full border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
              >
                <option value="weak">Weak (70)</option>
                <option value="same">Same (60)</option>
                <option value="strong">Strong (50)</option>
                <option value="weakness">Specific weakness (90)</option>
              </select>
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
