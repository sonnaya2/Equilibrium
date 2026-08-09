"use client";

import type { ResolvedSlot } from "@/combat/data/specs";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { abilityTtkLabel } from "./abilityTtkPresentation";

export function RevoBarGraphic({
  slots,
  revoSize,
  baseAbilityDamage,
  damagePotential,
  maximumLifePoints,
}: {
  slots: ResolvedSlot[];
  revoSize: number;
  /** Setup base AD for rough TTK. Omit to hide TTK. */
  baseAbilityDamage?: number;
  damagePotential?: number;
  maximumLifePoints?: number | null;
}) {
  const showTtk =
    baseAbilityDamage != null &&
    damagePotential != null &&
    maximumLifePoints != null &&
    maximumLifePoints > 0;

  return (
    <div className="ability-bar" role="list" aria-label="Revolution bar">
      {slots.map((slot, index) => {
        const isKeybind = index >= revoSize;
        const unmodelled = !isKeybind && slot.modelledBy === "unmodelled";
        const cat =
          slot.spec?.category === "enhanced"
            ? "enhanced"
            : slot.spec?.category === "threshold"
              ? "threshold"
              : slot.spec?.category === "basic"
                ? "basic"
                : slot.spec?.category === "ultimate"
                  ? "ultimate"
                  : slot.spec?.category === "utility"
                    ? "utility"
                    : undefined;
        const ttk =
          showTtk && slot.spec
            ? abilityTtkLabel(
                baseAbilityDamage,
                slot.spec as AbilitySpec,
                damagePotential,
                maximumLifePoints,
              )
            : null;
        return (
          <div
            key={`${slot.name}-${index}`}
            role="listitem"
            title={
              ttk
                ? `${slot.name} · est. TTK ${ttk} (band midpoint × DP; not full sim)`
                : slot.name
            }
            data-category={cat}
            className={`ability-bar-slot border ${
              isKeybind
                ? "border-dashed border-stone-750/40 text-parch-300/45"
                : unmodelled
                  ? "border-dashed border-stone-750 text-parch-300/60"
                  : "border-stone-750 bg-stone-850 text-parch-50"
            }`}
          >
            <div className="ability-bar-slot__number font-mono">{index + 1}</div>
            {slot.spec ? (
              <GameIcon
                src={abilityIconPath(slot.spec.id, slot.spec.style)}
                size={72}
                className="ability-bar-slot__icon"
              />
            ) : (
              <span className="ability-bar-slot__empty" aria-hidden="true" />
            )}
            <div className="ability-bar-slot__name">{slot.name}</div>
            {ttk && !isKeybind && !unmodelled ? (
              <div className="ability-bar-slot__ttk" aria-label={`Estimated time to kill ${ttk}`}>
                {ttk}
              </div>
            ) : null}
            {isKeybind ? <div className="ability-bar-slot__tag">keybind</div> : null}
            {unmodelled ? <div className="ability-bar-slot__tag">skip</div> : null}
          </div>
        );
      })}
    </div>
  );
}
