import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { targetDamagePotential, playerAccuracy } from "@/combat/target/genericTarget";
import {
  bitingCritChanceBonus,
  energisingAccuracyBonus,
  equilibriumDamageBonus,
  eruptiveDamageBonus,
  invigoratingAdrenalineMultiplier,
  lungingPerkModifier,
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
import {
  prayerBoostedStyleLevel,
  prayerDamageModifier,
  styleCurseById,
} from "@/combat/shared/prayers";
import { vulnerabilityModifier } from "@/combat/shared/vulnerability";
import { overloadBoostedLevel, type OverloadTier } from "@/combat/shared/potions";
import { STANDARD_HIT_CAP, type HitCapRule } from "@/combat/core/hitCaps";
import { equipmentById } from "@/combat/data";
import type { AdrenalineRules, ProcRules } from "@/combat/engine/simulation/simulate";
import type { CombatModifier } from "@/combat/types";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { Loadout } from "./useLoadout";

/** Re-export for GearPanel / setup consumers. */
export { equippedSetCounts, setEffectsSummary };

/** Pure derivation of engine inputs from a Setup loadout — single place tabs
 *  resolve "what does this loadout mean numerically". */

export interface CalcStats {
  combatStyle: string;
  baseDamageMode: "automatic" | "manual";
  rawBase: number;
  base: number;
  /**
   * Level feeding the crit damage layer. Strength for melee; style level for
   * Ranged / Magic / Necromancy. Base AD uses loadoutEffectiveDamageLevel.
   */
  level: number;
  /** Level feeding playerAccuracy when the target model is active. */
  attackLevel: number;
  dp: number;
  critChance: number;
  critDamageBonus: number;
  cap: HitCapRule;
  startingAdrenaline: number;
  effectiveDamageLevel: number;
  mainhandTier: number;
  offhandTier: number | null;
  spellTier: number | null;
  ammunitionTier: number | null;
  equipmentStyleDamageBonus: number;
  styleDamageBonus: number;
  damagePotentialSource: "target stats" | "manual override" | "100% assumption";
  equipmentIds: readonly string[];
  weaponConfiguration: "twohand" | "dualwield" | "mainhand" | "necromancy";
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

/** Unique records occupying equipment slots. Unlock pins are never equipped. */
function equippedRecordIds(loadout: Loadout): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of Object.values(loadout.equipmentSlots ?? {})) {
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
 * Matching armour and jewellery damage is folded into base AD separately.
 */
export function equippedBonuses(loadout: Loadout): { damage: number; accuracy: number } {
  return sumEquipmentBonuses(equippedRecordIds(loadout).map((id) => equipmentById(id)?.bonuses));
}

const WEAPON_SLOTS = new Set(["mainhand", "offhand", "twohand", "ammo"]);

/** Style bonus `b`: matching armour/jewellery bonuses, never weapon damage. */
export function equipmentStyleDamageBonus(loadout: Loadout): number {
  let bonus = 0;
  for (const id of equippedRecordIds(loadout)) {
    const record = equipmentById(id);
    if (!record?.slot || WEAPON_SLOTS.has(record.slot)) continue;
    if (record.style && record.style !== "hybrid" && record.style !== loadout.style) continue;
    if (record.bonuses.damage != null && Number.isFinite(record.bonuses.damage)) {
      bonus += record.bonuses.damage;
    }
  }
  return bonus;
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
    const record = equipmentById(id);
    if (record?.style && record.style !== "hybrid" && record.style !== loadout.style) continue;
    pieces.push({ slot, bonuses: record?.bonuses });
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
    if (
      record?.tier != null &&
      Number.isFinite(record.tier) &&
      (!record.style || record.style === "hybrid" || record.style === loadout.style)
    ) {
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

export function loadoutOverloadTier(loadout: Loadout): OverloadTier | null {
  return loadout.buffs?.overload && loadout.buffs.overload !== "none"
    ? (loadout.buffs.overload as OverloadTier)
    : null;
}

/**
 * Damage level feeding base ability damage: overload-boosted (wiki Ability damage
 * uses the style level "including boosts", capped at 145 = 120 + potion boosts;
 * verified 2026-07-31). Prayer stays an ability-stage modifier, never baked in.
 */
export function loadoutEffectiveDamageLevel(loadout: Loadout): number {
  const level = loadoutDamageLevel(loadout);
  const tier = loadoutOverloadTier(loadout);
  return clampLevel(tier ? overloadBoostedLevel(level, tier) : level);
}

function slotWeaponTier(
  loadout: Loadout,
  slot: "twohand" | "mainhand" | "offhand" | "ammo",
): number | null {
  const id = loadout.equipmentSlots?.[slot];
  if (typeof id !== "string") return null;
  const record = equipmentById(id);
  if (record?.style && record.style !== "hybrid" && record.style !== loadout.style) return null;
  const tier = record?.tier;
  return tier != null && Number.isFinite(tier) ? tier : null;
}

type WeaponHand = Parameters<typeof baseAbilityDamage>[1];

/**
 * Weapon configuration from equipped slots: twohand → 2H formula; mainhand +
 * offhand → dual wield (a necromancy conduit occupies the offhand slot and
 * routes here); mainhand only → main hand. No tiered weapon in any slot → the
 * legacy fallback: weaponTier slider through the twohand formula, as before.
 */
export function loadoutWeaponConfig(loadout: Loadout): WeaponHand {
  const styleBonus = equipmentStyleDamageBonus(loadout) + loadout.styleDamageBonus;
  const twohandTier = slotWeaponTier(loadout, "twohand");
  const mainhandTier = slotWeaponTier(loadout, "mainhand");
  const offhandTier = slotWeaponTier(loadout, "offhand");
  if (loadout.style === "necromancy") {
    return {
      kind: "necromancy",
      deathGuard: { tier: mainhandTier ?? loadout.weaponTier },
      conduit: { tier: offhandTier ?? loadout.offhandTier },
      styleBonus,
    };
  }
  const caps =
    loadout.style === "ranged"
      ? { ammunitionTier: slotWeaponTier(loadout, "ammo") ?? loadout.ammunitionTier }
      : loadout.style === "magic"
        ? { spellTier: loadout.spellTier }
        : {};
  if (twohandTier != null) {
    return {
      kind: "twohand",
      weapon: { tier: twohandTier },
      style: loadout.style,
      styleBonus,
      ...caps,
    };
  }
  if (mainhandTier != null) {
    return offhandTier != null
      ? {
          kind: "mainhand",
          style: loadout.style,
          weapon: { tier: mainhandTier },
          offhand: { tier: offhandTier },
          styleBonus,
          ...caps,
        }
      : {
          kind: "mainhand",
          style: loadout.style,
          weapon: { tier: mainhandTier },
          styleBonus,
          ...caps,
        };
  }
  if (loadout.weaponConfiguration === "mainhand") {
    return {
      kind: "mainhand",
      style: loadout.style,
      weapon: { tier: loadout.weaponTier },
      styleBonus,
      ...caps,
    };
  }
  if (loadout.weaponConfiguration === "dualwield") {
    return {
      kind: "mainhand",
      style: loadout.style,
      weapon: { tier: loadout.weaponTier },
      offhand: { tier: loadout.offhandTier },
      styleBonus,
      ...caps,
    };
  }
  return {
    kind: "twohand",
    weapon: { tier: loadoutWeaponTier(loadout) },
    style: loadout.style,
    styleBonus,
    ...caps,
  };
}

/** Base ability damage computed from the effective level and equipped weapon config. */
export function computedLoadoutBase(loadout: Loadout): number {
  return baseAbilityDamage(loadoutEffectiveDamageLevel(loadout), loadoutWeaponConfig(loadout));
}

export function loadoutBase(loadout: Loadout): number {
  const raw =
    loadout.baseDamage.mode === "manual" && loadout.baseDamage.manualValue > 0
      ? loadout.baseDamage.manualValue
      : computedLoadoutBase(loadout);
  const equilibrium =
    loadout.perks.equilibrium > 0 ? 1 + equilibriumDamageBonus(loadout.perks.equilibrium) : 1;
  const eruptive = loadout.perks.eruptive > 0 ? 1 + eruptiveDamageBonus(loadout.perks.eruptive) : 1;
  return Math.floor(Math.floor(raw * equilibrium) * eruptive);
}

export function loadoutStats(loadout: Loadout): CalcStats {
  const curse =
    loadout.buffs?.styleCurse && loadout.buffs.styleCurse !== "none"
      ? styleCurseById(loadout.buffs.styleCurse)
      : undefined;
  const overloadTier = loadoutOverloadTier(loadout);

  let attackLevel = loadoutAttackLevel(loadout);
  if (overloadTier) attackLevel = overloadBoostedLevel(attackLevel, overloadTier);
  if (curse) attackLevel = prayerBoostedStyleLevel(attackLevel, curse);

  const level = loadoutDamageLevel(loadout);
  const energising =
    loadout.perks.energising > 0 ? energisingAccuracyBonus(loadout.perks.energising) : 0;
  const accessoryAccuracy = nonWeaponAccuracyBonus(loadout);
  const weaponTier = loadoutWeaponTier(loadout);

  // Target model: level+tier curve + Energising + non-weapon flat accuracy only.
  // Without a target, the manual accuracy% slider remains authoritative.
  const dp = loadout.target
    ? targetDamagePotential(
        playerAccuracy(attackLevel, weaponTier) + energising + accessoryAccuracy,
        {
          defenceLevel: loadout.target.defenceLevel,
          armour: loadout.target.armour,
          affinity: loadout.target.affinity,
          additiveHitChance: (loadout.target.additiveHitChance ?? 0) / 100,
          damagePotentialOverride: loadout.target.damagePotentialOverride,
        },
      )
    : clamp01(loadout.accuracy / 100);

  // Equilibrium perk prevents critical strikes (wiki). Biting/set bonuses ignored while active.
  // Set crit: actual gear counts (Math.max with manual perk piece sliders — no double-count).
  const setCounts = equippedSetCounts({ equipmentSlots: loadout.equipmentSlots });
  const biting =
    loadout.perks.biting > 0
      ? bitingCritChanceBonus(loadout.perks.biting, loadout.perks.bitingLevel20)
      : 0;
  const setCrit = loadoutSetCritChance({
    equipmentSlots: loadout.equipmentSlots,
    perks: {
      tectonicPieces: loadout.perks.tectonicPieces,
      eliteTectonic: loadout.perks.eliteTectonic,
      tumekensPieces: loadout.perks.tumekensPieces,
      insideSunshine: loadout.perks.insideSunshine,
    },
  });
  const critChance =
    loadout.perks.equilibrium > 0 ? 0 : clamp01(loadout.critChance / 100 + biting + setCrit);

  const globalModifiers: CombatModifier[] = [];
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
    // Impatient / Relentless are state-changing RNG: the rotation drivers
    // branch on them (probability-weighted), never flat expected value.
    impatientRank: loadout.perks.impatient > 0 ? loadout.perks.impatient : 0,
    impatientLevel20: loadout.perks.impatientLevel20,
    relentlessRank: loadout.perks.relentless > 0 ? loadout.perks.relentless : 0,
    relentlessLevel20: loadout.perks.relentlessLevel20,
  };

  const procs: ProcRules = {
    cracklingRank: loadout.perks.crackling > 0 ? loadout.perks.crackling : 0,
    aftershockRank: loadout.perks.aftershock > 0 ? loadout.perks.aftershock : 0,
  };
  const weaponConfig = loadoutWeaponConfig(loadout);
  const equipmentDamage = equipmentStyleDamageBonus(loadout);
  const mainhandTier =
    weaponConfig.kind === "necromancy" ? weaponConfig.deathGuard.tier : weaponConfig.weapon.tier;
  const offhandTier =
    weaponConfig.kind === "necromancy"
      ? (weaponConfig.conduit?.tier ?? null)
      : weaponConfig.kind === "mainhand"
        ? (weaponConfig.offhand?.tier ?? null)
        : null;

  return {
    combatStyle: loadout.style,
    baseDamageMode: loadout.baseDamage.mode,
    rawBase:
      loadout.baseDamage.mode === "manual"
        ? loadout.baseDamage.manualValue
        : computedLoadoutBase(loadout),
    base: loadoutBase(loadout),
    level,
    attackLevel,
    dp,
    critChance,
    critDamageBonus: 0,
    cap: { cap: STANDARD_HIT_CAP, bypass: !loadout.hitCapEnabled },
    startingAdrenaline: loadout.startingAdrenaline,
    effectiveDamageLevel: loadoutEffectiveDamageLevel(loadout),
    mainhandTier,
    offhandTier,
    spellTier:
      weaponConfig.kind !== "necromancy" && weaponConfig.style === "magic"
        ? (weaponConfig.spellTier ?? null)
        : null,
    ammunitionTier:
      weaponConfig.kind !== "necromancy" && weaponConfig.style === "ranged"
        ? (weaponConfig.ammunitionTier ?? null)
        : null,
    equipmentStyleDamageBonus: equipmentDamage,
    styleDamageBonus: equipmentDamage + loadout.styleDamageBonus,
    damagePotentialSource: loadout.target
      ? loadout.target.damagePotentialOverride != null
        ? "manual override"
        : "target stats"
      : loadout.accuracy === 100
        ? "100% assumption"
        : "manual override",
    equipmentIds: equippedRecordIds(loadout),
    weaponConfiguration:
      weaponConfig.kind === "necromancy"
        ? "necromancy"
        : weaponConfig.kind === "twohand"
          ? "twohand"
          : weaponConfig.offhand
            ? "dualwield"
            : "mainhand",
    globalModifiers,
    castModifiersFor: (ability) => [
      ...globalModifiers,
      ...(loadout.perks.ultimatums > 0
        ? [ultimatumsPerkModifier(loadout.perks.ultimatums, ability.category)]
        : []),
      ...(loadout.perks.lunging > 0
        ? [lungingPerkModifier(loadout.perks.lunging, ability.id)]
        : []),
    ],
    adrenaline,
    procs,
    plantedFeet: loadout.perks.plantedFeet === true,
    conjureBasicDamageMult: loadoutFirstNecromancerConjureDamageMult({
      equipmentSlots: loadout.equipmentSlots,
    }),
  };
}
