import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { targetDamagePotential, playerAccuracy } from "@/combat/target/genericTarget";
import {
  energisingAccuracyBonus,
  equilibriumPerkModifier,
  lungingPerkModifier,
  ultimatumsPerkModifier,
} from "@/combat/shared/perks";
import { tectonicSet, tumekensSunshineSet } from "@/combat/shared/equipment";
import type { CombatModifier } from "@/combat/types";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { Loadout } from "./useLoadout";

/** Pure derivation of engine inputs from a Build loadout — the single place tabs
 *  resolve "what does this loadout mean numerically". UI-only; no engine changes. */

export interface CalcStats {
  base: number;
  level: number;
  /** Damage Potential as a fraction, from the target model when configured. */
  dp: number;
  critChance: number;
  critDamageBonus: number;
  /** Modifiers safe to share across every cast of a run (Equilibrium). */
  globalModifiers: CombatModifier[];
  /** Modifiers for one specific cast (global + category/ability-scoped perks). */
  castModifiersFor: (ability: AbilitySpec) => CombatModifier[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Base ability damage: manual entry, or computed from level + weapon tier when the
 *  base field is not a finite positive number. */
export function loadoutBase(loadout: Loadout): number {
  if (Number.isFinite(loadout.base) && loadout.base > 0) return loadout.base;
  return baseAbilityDamage(loadout.level, {
    kind: "twohand",
    weapon: { tier: loadout.weaponTier },
    style: loadout.style,
  });
}

export function loadoutStats(loadout: Loadout): CalcStats {
  const level = Math.min(Math.max(1, loadout.level), 145);
  const energising = loadout.perks.energising > 0 ? energisingAccuracyBonus(loadout.perks.energising) : 0;

  const dp = loadout.target
    ? targetDamagePotential(playerAccuracy(level, loadout.weaponTier) + energising, {
        defenceLevel: loadout.target.defenceLevel,
        affinity: loadout.target.affinity,
      })
    : clamp01(loadout.accuracy / 100);

  const critChance = clamp01(
    loadout.critChance / 100 +
      tectonicSet(loadout.perks.tectonicPieces, loadout.perks.eliteTectonic).critChanceBonus +
      tumekensSunshineSet(loadout.perks.tumekensPieces, loadout.perks.insideSunshine).critChanceBonus,
  );

  const globalModifiers: CombatModifier[] =
    loadout.perks.equilibrium > 0 ? [equilibriumPerkModifier(loadout.perks.equilibrium)] : [];

  return {
    base: loadoutBase(loadout),
    level,
    dp,
    critChance,
    critDamageBonus: 0,
    globalModifiers,
    castModifiersFor: (ability) => [
      ...globalModifiers,
      ...(loadout.perks.ultimatums > 0
        ? [ultimatumsPerkModifier(loadout.perks.ultimatums, ability.category)]
        : []),
      ...(loadout.perks.lunging > 0 ? [lungingPerkModifier(loadout.perks.lunging, ability.id)] : []),
    ],
  };
}
