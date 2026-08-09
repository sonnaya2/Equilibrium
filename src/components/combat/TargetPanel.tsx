"use client";

import { useMemo, useState } from "react";
import { DEFAULT_AFFINITIES, sanitizeAffinity } from "@/combat/target/genericTarget";
import { GameIcon } from "../GameIcon";
import { NumberField } from "./NumberField";
import type { Loadout, LoadoutTarget } from "./useLoadout";
import {
  applyTargetPreset,
  filterTargetPresetOptions,
  isTargetModifiedFromPreset,
  listTargetPresetOptions,
  presetLabel,
  resetTargetToPreset,
  targetPresetIconPath,
} from "./targetPresetUi";

const NAMED_AFFINITY_OPTIONS = [
  { value: DEFAULT_AFFINITIES.weak, label: "Weak (70)" },
  { value: DEFAULT_AFFINITIES.same, label: "Same (60)" },
  { value: DEFAULT_AFFINITIES.strong, label: "Strong (50)" },
  { value: DEFAULT_AFFINITIES.weakness, label: "Specific weakness (90)" },
] as const;

const NAMED_AFFINITY_VALUES = new Set<number>(NAMED_AFFINITY_OPTIONS.map((o) => o.value));

const BLANK_TARGET: LoadoutTarget = {
  defenceLevel: 80,
  armour: 0,
  affinity: DEFAULT_AFFINITIES.same,
  additiveHitChance: 0,
};

export function TargetPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  const target = loadout.target;
  const [presetQuery, setPresetQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const presetOptions = useMemo(() => listTargetPresetOptions(), []);
  const filteredPresets = useMemo(
    () => filterTargetPresetOptions(presetOptions, presetQuery),
    [presetOptions, presetQuery],
  );
  const modified = target != null && isTargetModifiedFromPreset(target, loadout.style);
  const selectedPresetId = target?.targetPresetId ?? "";
  const selectedName = selectedPresetId
    ? (presetLabel(selectedPresetId) ?? selectedPresetId)
    : target
      ? "Custom target"
      : null;
  const selectedIconSrc = selectedPresetId
    ? targetPresetIconPath(presetLabel(selectedPresetId) ?? "")
    : null;

  const updateTarget = (patch: Partial<LoadoutTarget>) => {
    if (!target) return;
    setLoadout({ ...loadout, target: { ...target, ...patch } });
  };

  const selectBoss = (presetId: string) => {
    if (!presetId) {
      // Custom: drop catalogue identity and Mark fuel from the preset.
      if (!target) {
        setLoadout({ ...loadout, target: { ...BLANK_TARGET } });
        return;
      }
      const { targetPresetId: _id, weaknessAffinity: _w, ...rest } = target;
      setLoadout({ ...loadout, target: { ...rest } });
      return;
    }
    const next = applyTargetPreset(presetId, loadout.style, target);
    if (next) setLoadout({ ...loadout, target: next });
  };

  const affinitySelectValue =
    target && NAMED_AFFINITY_VALUES.has(target.affinity) ? String(target.affinity) : "custom";

  return (
    <div className="loadout-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Target</h2>
      <p className="mt-1 text-xs text-parch-300">
        Pick a boss plate for Wiki Defence, armour, and style affinity. Advanced fields stay
        editable. Death Mark does not model phase soft caps or reflection.
      </p>

      <div className="target-boss-picker mt-3">
        <div className="target-boss-picker__head">
          <label className="target-boss-picker__search">
            <span className="sr-only">Search bosses</span>
            <input
              type="search"
              className="loadout-input"
              placeholder="Search bosses (KBD, Rax, Amascut…)"
              value={presetQuery}
              onChange={(event) => setPresetQuery(event.target.value)}
            />
          </label>
          {selectedName ? (
            <div className="target-boss-picker__selected">
              <span className="target-boss-picker__selected-icon" aria-hidden>
                <GameIcon src={selectedIconSrc} size={28} />
              </span>
              <div>
                <p className="target-boss-picker__selected-name">{selectedName}</p>
                <p className="text-xs text-parch-300">
                  {selectedPresetId
                    ? modified
                      ? "Modified from Wiki"
                      : "Wiki values"
                    : "Manual target"}
                  {selectedPresetId && modified ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          if (!target) return;
                          setLoadout({
                            ...loadout,
                            target: resetTargetToPreset(target, loadout.style),
                          });
                        }}
                      >
                        Reset to Wiki
                      </button>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-parch-300">No NPC target · 100% Damage Potential assumption</p>
          )}
        </div>

        <div className="icon-tile-grid target-boss-picker__grid" role="listbox" aria-label="Boss presets">
          {filteredPresets.map((option) => {
            const pressed = selectedPresetId === option.id;
            const disabled = !option.applyable;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={pressed}
                aria-pressed={pressed}
                aria-disabled={disabled}
                disabled={disabled}
                title={
                  disabled
                    ? `${option.name} (incomplete stats)`
                    : `${option.name}${option.aliases[0] ? ` · ${option.aliases[0]}` : ""}`
                }
                onClick={() => {
                  if (disabled) return;
                  if (pressed) {
                    setLoadout({ ...loadout, target: null });
                    return;
                  }
                  selectBoss(option.id);
                }}
                className={`icon-tile${option.iconSrc ? "" : " icon-tile--text"}${
                  disabled ? " is-disabled" : ""
                }${pressed ? " is-on" : ""}`}
              >
                {option.iconSrc ? (
                  <GameIcon src={option.iconSrc} size={34} className="icon-tile__icon" />
                ) : (
                  <span>{option.aliases[0] ?? option.name.slice(0, 4)}</span>
                )}
                <span className="sr-only">
                  {option.name}
                  {option.support === "provisional" ? ", provisional" : ""}
                </span>
                <span className="icon-tip" role="tooltip">
                  <strong>{option.name}</strong>
                  {option.aliases.length ? option.aliases.join(", ") : option.encounter}
                  {option.support === "provisional" ? " · provisional" : ""}
                  {disabled ? " · incomplete stats" : ""}
                </span>
              </button>
            );
          })}
        </div>
        {filteredPresets.length === 0 ? (
          <p className="mt-2 text-xs text-parch-300">No bosses match that search.</p>
        ) : null}

        {target ? (
          <div className="target-boss-picker__stats" aria-label="Applied target stats">
            <span>
              Def <strong>{target.defenceLevel}</strong>
            </span>
            <span>
              Armour <strong>{target.armour ?? 0}</strong>
            </span>
            <span>
              Aff <strong>{target.affinity}</strong>
            </span>
            {target.size != null ? (
              <span>
                Size <strong>{target.size}</strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="loadout-fields mt-3">
        <label className="loadout-check">
          <input
            type="checkbox"
            checked={target !== null}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                target: event.target.checked
                  ? target ?? { ...BLANK_TARGET }
                  : null,
              })
            }
          />
          Use NPC target
        </label>
        <label className="loadout-check">
          <input
            type="checkbox"
            checked={showAdvanced || (target != null && !selectedPresetId)}
            onChange={(event) => setShowAdvanced(event.target.checked)}
          />
          Advanced target fields
        </label>

        {target && (showAdvanced || !selectedPresetId) ? (
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
              Applicable specific weakness (Demon&apos;s Mark)
            </label>
            {target.weaknessAffinity != null ? (
              <p className="text-xs text-parch-300">
                Sourced weakness affinity {target.weaknessAffinity}
                {target.hasApplicableWeakness
                  ? " · Mark may raise effective Aff at Damage Potential resolve"
                  : ""}
              </p>
            ) : null}
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
