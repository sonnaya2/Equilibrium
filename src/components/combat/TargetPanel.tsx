"use client";

import { useMemo, useState } from "react";
import { DEFAULT_AFFINITIES, sanitizeAffinity } from "@/combat/target/genericTarget";
import { NumberField } from "./NumberField";
import type { Loadout, LoadoutTarget } from "./useLoadout";
import {
  applyTargetPreset,
  filterTargetPresetOptions,
  isTargetModifiedFromPreset,
  listTargetPresetOptions,
  presetLabel,
  resetTargetToPreset,
} from "./targetPresetUi";

const NAMED_AFFINITY_OPTIONS = [
  { value: DEFAULT_AFFINITIES.weak, label: "Weak (70)" },
  { value: DEFAULT_AFFINITIES.same, label: "Same (60)" },
  { value: DEFAULT_AFFINITIES.strong, label: "Strong (50)" },
  { value: DEFAULT_AFFINITIES.weakness, label: "Specific weakness (90)" },
] as const;

const NAMED_AFFINITY_VALUES = new Set<number>(NAMED_AFFINITY_OPTIONS.map((o) => o.value));

export function TargetPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const target = loadout.target;
  const [presetQuery, setPresetQuery] = useState("");
  const presetOptions = useMemo(() => listTargetPresetOptions(), []);
  const filteredPresets = useMemo(
    () => filterTargetPresetOptions(presetOptions, presetQuery),
    [presetOptions, presetQuery],
  );
  const modified =
    target != null && isTargetModifiedFromPreset(target, loadout.style);
  const updateTarget = (patch: Partial<LoadoutTarget>) => {
    if (!target) return;
    setLoadout({ ...loadout, target: { ...target, ...patch } });
  };

  const affinitySelectValue =
    target && NAMED_AFFINITY_VALUES.has(target.affinity) ? String(target.affinity) : "custom";

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
                  ? {
                      defenceLevel: 80,
                      armour: 0,
                      affinity: DEFAULT_AFFINITIES.same,
                      additiveHitChance: 0,
                    }
                  : null,
              })
            }
          />
          Use NPC target
        </label>
        {target ? (
          <>
            <label className="loadout-select loadout-select--wide">
              <span>Boss preset</span>
              <input
                type="search"
                className="loadout-input"
                placeholder="Search bosses (KBD, Rax, Amascut…)"
                value={presetQuery}
                onChange={(event) => setPresetQuery(event.target.value)}
                aria-label="Search boss presets"
              />
              <select
                value={target.targetPresetId ?? ""}
                onChange={(event) => {
                  const id = event.target.value;
                  if (!id) {
                    updateTarget({ targetPresetId: undefined });
                    return;
                  }
                  const next = applyTargetPreset(id, loadout.style, target);
                  if (next) setLoadout({ ...loadout, target: next });
                }}
              >
                <option value="">Custom</option>
                {filteredPresets.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.support === "provisional" ? " (provisional)" : ""}
                    {option.aliases.length ? ` · ${option.aliases[0]}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {target.targetPresetId ? (
              <p className="text-xs text-parch-300">
                {presetLabel(target.targetPresetId)}
                {modified ? " · Modified" : " · Wiki values"}
                {modified ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        setLoadout({
                          ...loadout,
                          target: resetTargetToPreset(target, loadout.style),
                        })
                      }
                    >
                      Reset to Wiki
                    </button>
                  </>
                ) : null}
              </p>
            ) : null}
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
                value={affinitySelectValue}
                onChange={(event) => {
                  if (event.target.value === "custom") {
                    updateTarget({ affinity: 55 });
                    return;
                  }
                  updateTarget({ affinity: sanitizeAffinity(Number(event.target.value)) });
                }}
              >
                {NAMED_AFFINITY_OPTIONS.map((option) => (
                  <option key={option.value} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
            {affinitySelectValue === "custom" ? (
              <NumberField
                label="Affinity percent"
                value={target.affinity}
                min={1}
                max={100}
                onChange={(value) => updateTarget({ affinity: sanitizeAffinity(value) })}
                suffix="%"
              />
            ) : null}
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
              Track target maximum LP
            </label>
            {target.maximumLifePoints !== undefined ? (
              <NumberField
                label="Maximum LP"
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
