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
  relentlessProcChance,
  ultimatumsPerkModifier,
} from "@/combat/shared/perks";
import {
  equippedSetCounts,
  isWeaponAccuracySlot,
  loadoutFirstNecromancerConjureDamageMult,
  loadoutSetCritChance,
  setDamageModifiers,
  setEffectsSummary,
  sumEquipmentBonuses,
  sumNonWeaponAccuracy,
} from "@/combat/shared/equipment";
import { prayerBoostedStyleLevel, prayerDamageModifier, styleCurseById } from "@/combat/shared/prayers";
import { vulnerabilityModifier } from "@/combat/shared/vulnerability";
import { overloadBoostedLevel, type OverloadTier } from "@/combat/shared/potions";
import { equipmentById } from "@/combat/data";
import type { AdrenalineRules, ProcRules } from "@/combat/rotation/simulate";
import type { CombatModifier } from "@/combat/types";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { Loadout } from "./useLoadout";

/** Re-export for GearPanel / setup consumers. */
export { equippedSetCounts, setEffectsSummary };

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
  /**
   * First Necromancer set mult on conjure spirit basic autos (1 if set inactive).
   * Pass to SimulateInput.conjureBasicDamageMult.
   */
  conjureBasicDamageMult?: number;
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
 * Sum wiki combat Damage / Accuracy from equipped pieces (display totals).
 * Hit chance does NOT add full weapon Accuracy ratings — those mirror tier and
 * would double-count playerAccuracy(level, weaponTier). See nonWeaponAccuracyBonus.
 * Style damage on armour is not folded into base AD either (tier-driven AD).
 */
export function equippedBonuses(loadout: Loadout): { damage: number; accuracy: number } {
  return sumEquipmentBonuses(equippedRecordIds(loadout).map((id) => equipmentById(id)?.bonuses));
}

/**
 * Flat accuracy from non-weapon slots only (gloves, rings, amulets, cape, armour, …).
 * Mainhand / offhand / twohand Accuracy is excluded — encoded by weapon tier.
 */
export function nonWeaponAccuracyBonus(loadout: Loadout): number {
  const pieces: { slot?: string | null; bonuses?: { accuracy?: number } | null }[] = [];
  const seen = new Set<string>();
  for (const [slot, id] of Object.entries(loadout.equipmentSlots ?? {})) {
    if (typeof id !== "string") continue;
    if (isWeaponAccuracySlot(slot)) {
      seen.add(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    pieces.push({ slot, bonuses: equipmentById(id)?.bonuses });
  }
  for (const id of loadout.equipmentIds ?? []) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    const record = equipmentById(id);
    if (!record) continue;
    pieces.push({ slot: record.slot, bonuses: record.bonuses });
  }
  return sumNonWeaponAccuracy(pieces);
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
  const accessoryAccuracy = nonWeaponAccuracyBonus(loadout);
  const weaponTier = loadoutWeaponTier(loadout);

  // Target model: level+tier curve + Energising + non-weapon flat accuracy only.
  // Without a target, the manual accuracy% slider remains authoritative.
  const dp = loadout.target
    ? targetDamagePotential(
        playerAccuracy(attackLevel, weaponTier) + energising + accessoryAccuracy,
        {
          defenceLevel: loadout.target.defenceLevel,
          affinity: loadout.target.affinity,
        },
      )
    : clamp01(loadout.accuracy / 100);

  // Equilibrium perk prevents critical strikes (wiki). Biting/set bonuses ignored while active.
  // Set crit: actual gear counts (Math.max with manual perk piece sliders — no double-count).
  const setCounts = equippedSetCounts(loadout);
  const biting =
    loadout.perks.biting > 0
      ? bitingCritChanceBonus(loadout.perks.biting, loadout.perks.bitingLevel20)
      : 0;
  const setCrit = loadoutSetCritChance({
    equipmentSlots: loadout.equipmentSlots,
    equipmentIds: loadout.equipmentIds,
    perks: {
      tectonicPieces: loadout.perks.tectonicPieces,
      eliteTectonic: loadout.perks.eliteTectonic,
      tumekensPieces: loadout.perks.tumekensPieces,
      insideSunshine: loadout.perks.insideSunshine,
    },
  });
  const critChance =
    loadout.perks.equilibrium > 0
      ? 0
      : clamp01(loadout.critChance / 100 + biting + setCrit);

  const globalModifiers: CombatModifier[] = [];
  if (loadout.perks.equilibrium > 0) {
    globalModifiers.push(equilibriumPerkModifier(loadout.perks.equilibrium));
  }
  if (loadout.perks.eruptive > 0) {
    globalModifiers.push(eruptivePerkModifier(loadout.perks.eruptive));
  }
  // Catalogue damageMult sets (none sourced yet — structure ready).
  globalModifiers.push(
    ...setDamageModifiers(setCounts, {
      insideSunshine: loadout.perks.insideSunshine,
    }),
  );
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
    relentlessRefundChance:
      loadout.perks.relentless > 0
        ? relentlessProcChance(loadout.perks.relentless, loadout.perks.relentlessLevel20)
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
    conjureBasicDamageMult: loadoutFirstNecromancerConjureDamageMult({
      equipmentSlots: loadout.equipmentSlots,
      equipmentIds: loadout.equipmentIds,
    }),
  };
}
