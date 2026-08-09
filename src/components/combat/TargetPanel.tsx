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
      <p className="mt-1 text-xs text-parch-300">
        Damage Potential from NPC stats. Death Mark uses expected landed damage and does not model
        boss phase nullification, special soft caps, Resonance, reflection, or phase replacement.
      </p>
      <div className="loadout-fields mt-3">
        <label className="loadout-check">
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
          Use NPC target
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
            <label className="loadout-select loadout-select--wide">
              <span>Affinity</span>
              <select
                value={target.affinity}
                onChange={(event) => updateTarget({ affinity: event.target.value as AffinityKind })}
              >
                <option value="weak">Weak (70)</option>
                <option value="same">Same (60)</option>
                <option value="strong">Strong (50)</option>
                <option value="weakness">Specific weakness (90)</option>
              </select>
            </label>
            <label className="loadout-check">
              <input
                type="checkbox"
                checked={target.damagePotentialOverride !== undefined}
                onChange={(event) =>
                  updateTarget({ damagePotentialOverride: event.target.checked ? 1 : undefined })
                }
              />
              Manual Damage Potential
            </label>
            {target.damagePotentialOverride !== undefined ? (
              <NumberField
                label="Damage Potential"
                value={target.damagePotentialOverride * 100}
                onChange={(value) =>
                  updateTarget({ damagePotentialOverride: Math.min(1, Math.max(0, value / 100)) })
                }
                suffix="%"
              />
            ) : null}
            <label className="loadout-check">
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
            <label className="loadout-check">
              <input
                type="checkbox"
                checked={target.maximumLifePoints !== undefined}
                onChange={(event) =>
                  updateTarget({
                    maximumLifePoints: event.target.checked ? 100_000 : undefined,
                  })
                }
              />
              Track target maximum Hitpoints
            </label>
            {target.maximumLifePoints !== undefined ? (
              <NumberField
                label="Maximum Hitpoints"
                value={target.maximumLifePoints}
                min={1}
                onChange={(value) =>
                  updateTarget({
                    maximumLifePoints: Math.min(10_000_000, Math.max(1, Math.floor(value))),
                  })
                }
              />
            ) : null}
            <label className="loadout-check">
              <input
                type="checkbox"
                checked={target.hasApplicableWeakness === true}
                onChange={(event) =>
                  updateTarget({ hasApplicableWeakness: event.target.checked || undefined })
                }
              />
              Has an applicable weakness
            </label>
            <label className="loadout-check">
              <input
                type="checkbox"
                checked={target.demon === true}
                onChange={(event) => updateTarget({ demon: event.target.checked || undefined })}
              />
              Demon (Demon Slayer perk)
            </label>
            <label className="loadout-check">
              <input
                type="checkbox"
                checked={target.dragon === true}
                onChange={(event) => updateTarget({ dragon: event.target.checked || undefined })}
              />
              Dragon (Dragon Slayer perk)
            </label>
            <label className="loadout-check">
              <input
                type="checkbox"
                checked={target.undead === true}
                onChange={(event) => updateTarget({ undead: event.target.checked || undefined })}
              />
              Undead (Undead Slayer perk / Salve)
            </label>
            <label className="loadout-check">
              <input
                type="checkbox"
                checked={target.onSlayerTask === true}
                onChange={(event) =>
                  updateTarget({ onSlayerTask: event.target.checked || undefined })
                }
              />
              On Slayer task (helmet)
            </label>
            <NumberField
              label="Target size"
              value={target.size ?? 1}
              min={1}
              onChange={(value) => updateTarget({ size: Math.max(1, Math.floor(value)) })}
            />
            <NumberField
              label="Occupied tiles"
              value={target.occupiedTiles ?? 1}
              onChange={(value) => updateTarget({ occupiedTiles: Math.max(1, Math.floor(value)) })}
            />
            <NumberField
              label="Targets in area"
              value={target.areaTargets ?? 1}
              min={1}
              onChange={(value) => updateTarget({ areaTargets: Math.max(1, Math.floor(value)) })}
            />
            <label className="loadout-check">
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
            <NumberField
              label="Incoming hit damage"
              value={target.incomingHitDamage ?? 0}
              min={0}
              onChange={(value) =>
                updateTarget({
                  incomingHitDamage: value > 0 ? Math.min(1_000_000, value) : undefined,
                })
              }
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
