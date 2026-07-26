"use client";

import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { NumberField } from "./NumberField";
import { loadoutDamageLevel, loadoutWeaponTier } from "./loadoutStats";
import {
  withAttackLevel,
  withStrengthLevel,
  withStyleLevel,
  type Loadout,
} from "./useLoadout";

/** Manual combat stats feeding the engine until per-item bonuses are sourced. */
export function StatsPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-parch-50">Stats</h2>
      <p className="mt-1 text-xs text-parch-300">
        Item bonuses empty until sourced — weapon tier still drives damage.
      </p>
      <div className="mt-3 border-t border-stone-750">
        {loadout.style === "melee" ? (
          <>
            <NumberField
              label="Attack level"
              value={loadout.attackLevel}
              onChange={(attackLevel) => setLoadout(withAttackLevel(loadout, attackLevel))}
            />
            <NumberField
              label="Strength level"
              value={loadout.strengthLevel}
              onChange={(strengthLevel) => setLoadout(withStrengthLevel(loadout, strengthLevel))}
            />
          </>
        ) : (
          <NumberField
            label="Style level"
            value={loadout.level}
            onChange={(level) => setLoadout(withStyleLevel(loadout, level))}
          />
        )}
        <NumberField
          label="Weapon tier"
          value={loadout.weaponTier}
          onChange={(weaponTier) => setLoadout({ ...loadout, weaponTier })}
        />
        <NumberField
          label="Base ability damage"
          value={loadout.base}
          onChange={(base) => setLoadout({ ...loadout, base })}
        />
        <div className="flex justify-end border-b border-stone-750/70 py-1.5">
          <button
            type="button"
            onClick={() =>
              setLoadout({
                ...loadout,
                base: baseAbilityDamage(loadoutDamageLevel(loadout), {
                  kind: "twohand",
                  weapon: { tier: loadoutWeaponTier(loadout) },
                  style: loadout.style,
                }),
              })
            }
            className="border border-stone-750 px-2 py-1 text-xs text-parch-100 hover:bg-white/[0.02] hover:text-parch-50"
          >
            Compute from level + tier
          </button>
        </div>
        <NumberField
          label="Accuracy"
          value={loadout.accuracy}
          onChange={(accuracy) => setLoadout({ ...loadout, accuracy })}
          suffix="%"
        />
        <NumberField
          label="Crit chance"
          value={loadout.critChance}
          onChange={(critChance) => setLoadout({ ...loadout, critChance })}
          suffix="%"
        />
      </div>
    </div>
  );
}
