"use client";

import type { ResolvedSlot } from "@/combat/data/specs";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";

export function RevoBarGraphic({
  slots,
  revoSize,
  selectedIndex,
  onSelectSlot,
}: {
  slots: ResolvedSlot[];
  revoSize: number;
  selectedIndex?: number;
  onSelectSlot?: (index: number) => void;
}) {
  return (
    <div className="ability-bar" role="group" aria-label="Revolution bar">
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
        return (
          <button
            key={`${slot.name}-${index}`}
            type="button"
            title={slot.name}
            aria-pressed={selectedIndex === index}
            onClick={() => onSelectSlot?.(index)}
            data-category={cat}
            className={`ability-bar-slot border${selectedIndex === index ? " is-selected" : ""} ${
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
            {isKeybind ? <div className="ability-bar-slot__tag">keybind</div> : null}
            {unmodelled ? <div className="ability-bar-slot__tag">skip</div> : null}
          </button>
        );
      })}
    </div>
  );
}
