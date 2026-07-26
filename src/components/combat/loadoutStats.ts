import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { targetDamagePotential, playerAccuracy } from "@/combat/target/genericTarget";
import {
  bitingCritChanceBonus,
  energisingAccuracyBonus,
  equilibriumPerkModifier,
  eruptivePerkModifier,
  IMPATIENT_EXTRA_ADRENALINE,
  impatientProcChance,
  invigoratingAdrenalineMultiplier,
  lungingPerkModifier,
  ultimatumsPerkModifier,
} from "@/combat/shared/perks";
import { sumEquipmentBonuses, tectonicSet, tumekensSunshineSet } from "@/combat/shared/equipment";
import { prayerBoostedStyleLevel, prayerDamageModifier, styleCurseById } from "@/combat/shared/prayers";
import { vulnerabilityModifier } from "@/combat/shared/vulnerability";
import { overloadBoostedLevel, type OverloadTier } from "@/combat/shared/potions";
import { equipmentById } from "@/combat/data";
import type { AdrenalineRules, ProcRules } from "@/combat/rotation/simulate";
import type { CombatModifier } from "@/combat/types";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { Loadout } from "./useLoadout";

/** Pure derivation of engine inputs from a Setup loadout — single place tabs
 *  resolve "what does this loadout mean numerically". */

export interface CalcStats {
  base: number;
  /**
   * Level feeding crit damage (and base AD when computed). Strength for melee;
   * style level for Ranged / Magic / Necromancy.
   */
  level: number;
  /** Level feeding playerAccuracy when the target model is active. */
  attackLevel: number;
  dp: number;
  critChance: number;
  critDamageBonus: number;
  globalModifiers: CombatModifier[];
  castModifiersFor: (ability: AbilitySpec) => CombatModifier[];
  /** Invigorating / Impatient rules for rotation + revolution sim. */
  adrenaline?: AdrenalineRules;
  /** Crackling / Aftershock EV ranks for rotation + revolution sim. */
  procs?: ProcRules;
  /** Planted Feet: base Sunshine / Death's Swiftness duration ×1.25. */
  plantedFeet?: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clampLevel = (value: number) => Math.min(Math.max(1, value), 145);

/** Unique equipment record ids from slots + legacy flat list. */
function equippedRecordIds(loadout: Loadout): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of Object.values(loadout.equipmentSlots ?? {})) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of loadout.equipmentIds ?? []) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Sum wiki combat Damage / Accuracy from equipped pieces.
 * Weapon Accuracy ratings are catalog/display — hit chance still uses tier via
 * playerAccuracy(level, weaponTier). Flat weapon Damage is not folded into base AD
 * (ability damage is tier-driven).
 */
export function equippedBonuses(loadout: Loadout): { damage: number; accuracy: number } {
  return sumEquipmentBonuses(equippedRecordIds(loadout).map((id) => equipmentById(id)?.bonuses));
}

/** Equipped twohand or mainhand tier when tagged on the record. */
export function equippedWeaponTier(loadout: Loadout): number | null {
  const slots = loadout.equipmentSlots ?? {};
  for (const slot of ["twohand", "mainhand"] as const) {
    const id = slots[slot];
    if (typeof id !== "string") continue;
    const record = equipmentById(id);
    if (record?.tier != null && Number.isFinite(record.tier)) return record.tier;
  }
  // Legacy flat list: first weapon-tier record.
  for (const id of loadout.equipmentIds ?? []) {
    const record = equipmentById(id);
    if (record?.tier != null && Number.isFinite(record.tier) && record.slot &&
        (record.slot === "mainhand" || record.slot === "twohand" || record.slot === "offhand")) {
      return record.tier;
    }
  }
  return null;
}

export function loadoutWeaponTier(loadout: Loadout): number {
  return equippedWeaponTier(loadout) ?? loadout.weaponTier;
}

export function loadoutAttackLevel(loadout: Loadout): number {
  return clampLevel(loadout.style === "melee" ? loadout.attackLevel : loadout.level);
}

export function loadoutDamageLevel(loadout: Loadout): number {
  return clampLevel(loadout.style === "melee" ? loadout.strengthLevel : loadout.level);
}

export function loadoutBase(loadout: Loadout): number {
  if (Number.isFinite(loadout.base) && loadout.base > 0) return loadout.base;
  return baseAbilityDamage(loadoutDamageLevel(loadout), {
    kind: "twohand",
    weapon: { tier: loadoutWeaponTier(loadout) },
    style: loadout.style,
  });
}

export function loadoutStats(loadout: Loadout): CalcStats {
  const curse =
    loadout.buffs?.styleCurse && loadout.buffs.styleCurse !== "none"
      ? styleCurseById(loadout.buffs.styleCurse)
      : undefined;
  const overloadTier =
    loadout.buffs?.overload && loadout.buffs.overload !== "none"
      ? (loadout.buffs.overload as OverloadTier)
      : null;

  let attackLevel = loadoutAttackLevel(loadout);
  if (overloadTier) attackLevel = overloadBoostedLevel(attackLevel, overloadTier);
  if (curse) attackLevel = prayerBoostedStyleLevel(attackLevel, curse);

  const level = loadoutDamageLevel(loadout);
  const energising = loadout.perks.energising > 0 ? energisingAccuracyBonus(loadout.perks.energising) : 0;
  const weaponTier = loadoutWeaponTier(loadout);

  const dp = loadout.target
    ? targetDamagePotential(playerAccuracy(attackLevel, weaponTier) + energising, {
        defenceLevel: loadout.target.defenceLevel,
        affinity: loadout.target.affinity,
      })
    : clamp01(loadout.accuracy / 100);

  // Equilibrium prevents critical strikes (wiki). Biting/set bonuses ignored while active.
  const biting =
    loadout.perks.biting > 0
      ? bitingCritChanceBonus(loadout.perks.biting, loadout.perks.bitingLevel20)
      : 0;
  const critChance =
    loadout.perks.equilibrium > 0
      ? 0
      : clamp01(
          loadout.critChance / 100 +
            biting +
            tectonicSet(loadout.perks.tectonicPieces, loadout.perks.eliteTectonic).critChanceBonus +
            tumekensSunshineSet(loadout.perks.tumekensPieces, loadout.perks.insideSunshine)
              .critChanceBonus,
        );

  const globalModifiers: CombatModifier[] = [];
  if (loadout.perks.equilibrium > 0) {
    globalModifiers.push(equilibriumPerkModifier(loadout.perks.equilibrium));
  }
  if (loadout.perks.eruptive > 0) {
    globalModifiers.push(eruptivePerkModifier(loadout.perks.eruptive));
  }
  if (loadout.buffs?.vulnerability) globalModifiers.push(vulnerabilityModifier());
  if (curse) globalModifiers.push(prayerDamageModifier(curse));

  const adrenaline: AdrenalineRules = {
    basicGainMultiplier:
      loadout.perks.invigorating > 0
        ? invigoratingAdrenalineMultiplier(loadout.perks.invigorating)
        : 1,
    impatientExpectedExtra:
      loadout.perks.impatient > 0
        ? impatientProcChance(loadout.perks.impatient, loadout.perks.impatientLevel20) *
          IMPATIENT_EXTRA_ADRENALINE
        : 0,
  };

  const procs: ProcRules = {
    cracklingRank: loadout.perks.crackling > 0 ? loadout.perks.crackling : 0,
    aftershockRank: loadout.perks.aftershock > 0 ? loadout.perks.aftershock : 0,
  };

  return {
    base: loadoutBase(loadout),
    level,
    attackLevel,
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
    adrenaline,
    procs,
    plantedFeet: loadout.perks.plantedFeet === true,
  };
}
