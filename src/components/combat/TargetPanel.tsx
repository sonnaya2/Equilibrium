"use client";

import type { AffinityKind } from "@/combat/target/genericTarget";
import { NumberField } from "./NumberField";
import type { Loadout, LoadoutTarget } from "./useLoadout";

export function TargetPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const target = loadout.target;
  const updateTarget = (patch: Partial<LoadoutTarget>) => {
    if (!target) return;
    setLoadout({ ...loadout, target: { ...target, ...patch } });
  };

  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Target</h2>
      <p className="mt-1 text-xs text-parch-300">Calculates Damage Potential from target stats.</p>
      <div className="loadout-fields mt-3">
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={target !== null}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                target: event.target.checked
                  ? { defenceLevel: 80, armour: 0, affinity: "same", additiveHitChance: 0 }
                  : null,
              })
            }
          />
          Use NPC target model
        </label>
        {target ? (
          <>
            <NumberField
              label="Defence level"
              value={target.defenceLevel}
              onChange={(defenceLevel) => updateTarget({ defenceLevel: Math.max(0, defenceLevel) })}
            />
            <NumberField
              label="Armour value"
              value={target.armour ?? 0}
              onChange={(armour) => updateTarget({ armour: Math.max(0, armour) })}
            />
            <NumberField
              label="Additive accuracy modifier"
              value={target.additiveHitChance ?? 0}
              onChange={(additiveHitChance) => updateTarget({ additiveHitChance })}
              suffix="%"
            />
            <label className="grid grid-cols-[1fr_110px] items-center gap-3 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <span>Affinity</span>
              <select
                value={target.affinity}
                onChange={(event) => updateTarget({ affinity: event.target.value as AffinityKind })}
                className="w-full border border-stone-750 bg-transparent px-2 py-1 text-sm text-parch-50"
              >
                <option value="weak">Weak (70)</option>
                <option value="same">Same (60)</option>
                <option value="strong">Strong (50)</option>
                <option value="weakness">Specific weakness (90)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <input
                type="checkbox"
                checked={target.damagePotentialOverride !== undefined}
                onChange={(event) =>
                  updateTarget({ damagePotentialOverride: event.target.checked ? 1 : undefined })
                }
              />
              Manual Damage Potential override
            </label>
            {target.damagePotentialOverride !== undefined ? (
              <NumberField
                label="Damage Potential override"
                value={target.damagePotentialOverride * 100}
                onChange={(value) =>
                  updateTarget({ damagePotentialOverride: Math.min(1, Math.max(0, value / 100)) })
                }
                suffix="%"
              />
            ) : null}
            <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <input
                type="checkbox"
                checked={target.hpPercent !== undefined}
                onChange={(event) =>
                  updateTarget({ hpPercent: event.target.checked ? 100 : undefined })
                }
              />
              Track target HP %
            </label>
            {target.hpPercent !== undefined ? (
              <NumberField
                label="HP %"
                value={target.hpPercent}
                onChange={(value) => updateTarget({ hpPercent: Math.min(100, Math.max(0, value)) })}
              />
            ) : null}
            <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <input
                type="checkbox"
                checked={target.hasApplicableWeakness === true}
                onChange={(event) =>
                  updateTarget({ hasApplicableWeakness: event.target.checked || undefined })
                }
              />
              Has an applicable weakness
            </label>
            <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <input
                type="checkbox"
                checked={target.demon === true}
                onChange={(event) =>
                  updateTarget({ demon: event.target.checked || undefined })
                }
              />
              Demon (Demon Slayer perk)
            </label>
            <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <input
                type="checkbox"
                checked={target.dragon === true}
                onChange={(event) =>
                  updateTarget({ dragon: event.target.checked || undefined })
                }
              />
              Dragon (Dragon Slayer perk)
            </label>
            <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <input
                type="checkbox"
                checked={target.undead === true}
                onChange={(event) =>
                  updateTarget({ undead: event.target.checked || undefined })
                }
              />
              Undead (Undead Slayer perk)
            </label>
            <NumberField
              label="Occupied tiles"
              value={target.occupiedTiles ?? 1}
              onChange={(value) => updateTarget({ occupiedTiles: Math.max(1, Math.floor(value)) })}
            />
            <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
              <input
                type="checkbox"
                checked={target.poisonImmune === true}
                onChange={(event) =>
                  updateTarget({ poisonImmune: event.target.checked || undefined })
                }
              />
              Poison immune
            </label>
            {/* Barkscales counts incoming hits, which an outgoing rotation never
                sees. Zero means no scenario stated, not a zero-damage result. */}
            <NumberField
              label="Incoming hit interval (s)"
              value={target.incomingHitIntervalSeconds ?? 0}
              min={0}
              onChange={(value) =>
                updateTarget({
                  incomingHitIntervalSeconds: value > 0 ? Math.min(600, value) : undefined,
                })
              }
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
