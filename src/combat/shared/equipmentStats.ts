import type { ArmourClass, EquipmentRecord, EquipmentSlot } from "../data/records";
import type { CombatStyle, SourceReference } from "../types";
import { accuracyCurve } from "../target/genericTarget";
import {
  isWeaponAccuracySlot,
  resolvedEquipmentSlots,
  type LoadoutEquipmentView,
} from "./equipment";
import { equipmentById } from "../data";

export type { ArmourClass } from "../data/records";

/**
 * Equipment stat formulas from tier, slot, armour class.
 * Exact EquipmentRecord.bonuses override; null when slot cannot carry the stat.
 * Armour base: f(t) = t³/500 + 10t + 100 (= 2.5 × accuracyCurve).
 * Armour/damage floor to 1 decimal; life points are integers.
 */
export const EQUIPMENT_TIER_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Equipment_tier",
  title: "Equipment tier",
  verifiedAt: "2026-08-02",
};

export const ARMOUR_MECHANICS_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Armour",
  title: "Armour",
  verifiedAt: "2026-08-02",
};

/** Documents the one-decimal floor for damage and armour values. */
export const COMBAT_STATS_CALCULATOR_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Calculator:Combat_stats",
  title: "Calculator:Combat stats",
  verifiedAt: "2026-08-02",
};

/** Floor to one decimal; 1e-9 guard for binary edge cases (e.g. 0.03 × f(50) = 25.5). */
export function floorOneDecimal(value: number): number {
  return Math.floor(value * 10 + 1e-9) / 10;
}

/** f(t) = t³/500 + 10t + 100, the armour tier base value. */
export function equipmentTierBase(tier: number): number {
  if (!Number.isFinite(tier) || tier < 1) {
    throw new RangeError(`equipmentTierBase: bad tier ${tier}`);
  }
  return 2.5 * accuracyCurve(tier);
}

/** Effective armour stat tier by class: tank t, power t−5, hybrid t−15, PvP t. */
export function classArmourTier(tier: number, armourClass: ArmourClass): number {
  switch (armourClass) {
    case "power":
      return tier - 5;
    case "hybrid":
      return tier - 15;
    default:
      return tier;
  }
}

/**
 * Armour slot mult: head .2, body .23, legs .22, hands/feet .05, back .03,
 * ring .02, shield .2 (offhand needs shield flag). Null if slot has no Armour.
 */
export function armourSlotMultiplier(
  slot: EquipmentSlot,
  opts?: { shield?: boolean },
): number | null {
  if (opts?.shield) return 0.2;
  switch (slot) {
    case "helmet":
      return 0.2;
    case "body":
      return 0.23;
    case "legs":
      return 0.22;
    case "gloves":
    case "boots":
      return 0.05;
    case "cape":
      return 0.03;
    case "ring":
      return 0.02;
    default:
      return null;
  }
}

/**
 * Armour: floor1(mult × f(effective tier)). armourTier overrides class-adjusted
 * tier when it differs from headline (chainbodies t-2, Vestments t70). Null if N/A.
 */
export function equipmentArmourValue(
  slot: EquipmentSlot,
  tier: number,
  armourClass: ArmourClass,
  opts?: { shield?: boolean; armourTier?: number },
): number | null {
  const multiplier = armourSlotMultiplier(slot, opts);
  if (multiplier == null) return null;
  const effectiveTier = opts?.armourTier ?? classArmourTier(tier, armourClass);
  if (!Number.isFinite(effectiveTier) || effectiveTier < 1) return null;
  return floorOneDecimal(multiplier * equipmentTierBase(effectiveTier));
}

/**
 * Defender armour: 0.1 × f(t) floor1 (rune t50 = 85.0, kalphite t90 = 245.8).
 * Infobox values win over wiki prose that claims half-tier.
 */
export function defenderArmourValue(tier: number): number {
  return floorOneDecimal(0.1 * equipmentTierBase(tier));
}

/** Tank life-point slot multipliers: head 10, body 15, legs 15, hands 5, feet 5. */
const LIFE_SLOT_MULTIPLIERS: Partial<Record<EquipmentSlot, number>> = {
  helmet: 10,
  body: 15,
  legs: 15,
  gloves: 5,
  boots: 5,
};

/** Shield life: 35 × (t−69), shields tier ≥ 70 only (t90 = 735, t99 = 1050). */
export function shieldLifeValue(tier: number): number {
  return tier >= 70 ? 35 * (tier - 69) : 0;
}

/**
 * Damage-bonus slot mult (9 Mar 2026 normalisation): head .25, body/back/ring
 * .375, legs .3125, hands/feet/pocket .15625, neck .575, melee ammo harness
 * .26875. Weapons: none (tier encodes damage).
 */
export function damageSlotMultiplier(
  slot: EquipmentSlot,
  opts?: { meleeAmmoHarness?: boolean },
): number | null {
  switch (slot) {
    case "helmet":
      return 0.25;
    case "body":
    case "cape":
    case "ring":
      return 0.375;
    case "legs":
      return 0.3125;
    case "gloves":
    case "boots":
    case "pocket":
      return 0.15625;
    case "amulet":
      return 0.575;
    case "ammo":
      return opts?.meleeAmmoHarness ? 0.26875 : null;
    default:
      return null;
  }
}

/**
 * Damage tier by class: power/PvP = full tier; tank/hybrid = null.
 * Off-model hybrid-power items need explicit damageTier on the record.
 */
export function classDamageTier(tier: number, armourClass: ArmourClass): number | null {
  return armourClass === "power" || armourClass === "pvp" ? tier : null;
}

/** Damage bonus: floor1(slot mult × damage tier). Null if slot has none. */
export function equipmentDamageValue(
  slot: EquipmentSlot,
  damageTier: number,
  opts?: { meleeAmmoHarness?: boolean },
): number | null {
  const multiplier = damageSlotMultiplier(slot, opts);
  if (multiplier == null) return null;
  if (!Number.isFinite(damageTier) || damageTier < 1) return null;
  return floorOneDecimal(multiplier * damageTier);
}

/**
 * Defender damage: floor1(2.4 × t) = half-tier off-hand fastest weapon.
 * (rune 120.0, dragon 144.0, kalphite 216.0).
 */
export function defenderDamageValue(tier: number): number {
  if (!Number.isFinite(tier) || tier < 1) {
    throw new RangeError(`defenderDamageValue: bad tier ${tier}`);
  }
  return floorOneDecimal(2.4 * tier);
}

/**
 * Life: tank = slotMult × tier; power = 0 unless lifeTier set (Nex etc. at t-5);
 * hybrid/PvP = 0; shield = 35 × (t-69). Null if slot has no Life.
 */
export function equipmentLifeValue(
  slot: EquipmentSlot,
  tier: number,
  armourClass: ArmourClass,
  opts?: { shield?: boolean; lifeTier?: number },
): number | null {
  if (opts?.shield) return shieldLifeValue(opts.lifeTier ?? tier);
  const multiplier = LIFE_SLOT_MULTIPLIERS[slot];
  if (multiplier == null) return null;
  if (!Number.isFinite(tier) || tier < 1) return null;
  if (armourClass === "tank") return multiplier * (opts?.lifeTier ?? tier);
  if (armourClass === "power" && opts?.lifeTier != null) return multiplier * opts.lifeTier;
  return 0;
}

/** Weapon tier is the record's headline `tier`; no separate field is needed. */
export type EquipmentStatName = "armour" | "life" | "damage";

export interface IncompleteEquipmentStat {
  id: string;
  stat: EquipmentStatName;
  reason: "missing-record" | "missing-slot" | "missing-tier" | "missing-armourClass";
}

export interface EquipmentStatTotals {
  /** Style-matching equipment Damage bonus (exact bonuses, then formula). */
  damage: number;
  /** Sum of every equipped Accuracy bonus including weapons - display only. */
  displayedAccuracy: number;
  /** Non-weapon Accuracy - the mechanically applied term. Weapons are tier-encoded. */
  appliedAccuracy: number;
  armour: number;
  life: number;
  prayer: number;
  /** Direct crit-chance bonuses on equipment records (none sourced yet). */
  critChance: number;
  /** Equipped records whose armour/life/damage resolved neither exactly nor by formula. */
  incomplete: IncompleteEquipmentStat[];
}

type ResolvedStat =
  { value: number; unknown?: never } | { value: 0; unknown: IncompleteEquipmentStat["reason"] };

/** Class-gated armour slots (tank t, power t-5, hybrid t-15). Rings/capes/shields use raw tier. */
const CLASS_GATED_SLOTS: ReadonlySet<EquipmentSlot> = new Set([
  "helmet",
  "body",
  "legs",
  "gloves",
  "boots",
]);

function resolveArmour(record: EquipmentRecord): ResolvedStat {
  if (record.bonuses.armour != null) return { value: record.bonuses.armour };
  if (record.slot == null) return { value: 0, unknown: "missing-slot" };
  if (record.defender) {
    return record.tier == null
      ? { value: 0, unknown: "missing-tier" }
      : { value: defenderArmourValue(record.tier) };
  }
  if (armourSlotMultiplier(record.slot, record) == null) return { value: 0 };
  if (record.tier == null) return { value: 0, unknown: "missing-tier" };
  // Shields, rings and capes take their multiplier at raw tier - no class offset.
  if (record.shield || !CLASS_GATED_SLOTS.has(record.slot)) {
    const derived = equipmentArmourValue(record.slot, record.tier, "tank", record);
    return derived == null ? { value: 0 } : { value: derived };
  }
  if (record.armourClass == null) return { value: 0, unknown: "missing-armourClass" };
  const derived = equipmentArmourValue(record.slot, record.tier, record.armourClass, record);
  return derived == null ? { value: 0 } : { value: derived };
}

function resolveLife(record: EquipmentRecord): ResolvedStat {
  if (record.bonuses.life != null) return { value: record.bonuses.life };
  if (record.defender) return { value: 0 };
  if (record.slot == null) return { value: 0, unknown: "missing-slot" };
  if (record.shield) {
    if (record.tier == null) return { value: 0, unknown: "missing-tier" };
    return { value: shieldLifeValue(record.lifeTier ?? record.tier) };
  }
  if (LIFE_SLOT_MULTIPLIERS[record.slot] == null) return { value: 0 };
  if (record.tier == null) return { value: 0, unknown: "missing-tier" };
  if (record.armourClass == null) return { value: 0, unknown: "missing-armourClass" };
  const derived = equipmentLifeValue(record.slot, record.tier, record.armourClass, record);
  return derived == null ? { value: 0 } : { value: derived };
}

function resolveDamage(record: EquipmentRecord): ResolvedStat {
  // Weapons: tier encodes AD; wiki weapon Damage face values stay out of totals.
  // Defenders are the exception (real off-hand style Damage bonus).
  if (record.slot != null && isWeaponAccuracySlot(record.slot)) {
    if (record.defender) {
      if (record.bonuses.damage != null && Number.isFinite(record.bonuses.damage)) {
        return { value: record.bonuses.damage };
      }
      return record.tier == null
        ? { value: 0, unknown: "missing-tier" }
        : { value: defenderDamageValue(record.tier) };
    }
    return { value: 0 };
  }
  if (record.bonuses.damage != null && Number.isFinite(record.bonuses.damage)) {
    return { value: record.bonuses.damage };
  }
  if (record.slot == null) return { value: 0, unknown: "missing-slot" };
  if (record.damageTier != null) {
    const derived = equipmentDamageValue(record.slot, record.damageTier, record);
    return derived == null ? { value: 0 } : { value: derived };
  }
  if (!CLASS_GATED_SLOTS.has(record.slot)) {
    // Non-class-gated slots without damageTier contribute 0 (need explicit damageTier if off-model).
    return { value: 0 };
  }
  if (record.armourClass == null) return { value: 0, unknown: "missing-armourClass" };
  if (record.tier == null) return { value: 0, unknown: "missing-tier" };
  const damageTier = classDamageTier(record.tier, record.armourClass);
  if (damageTier == null) return { value: 0 };
  const derived = equipmentDamageValue(record.slot, damageTier, record);
  return derived == null ? { value: 0 } : { value: derived };
}

/** Style Damage for one record (exact or formula). Non-defender weapons resolve to 0. */
export function equipmentRecordDamage(record: EquipmentRecord): number {
  return resolveDamage(record).value;
}

/**
 * Aggregate equipped gear via resolvedEquipmentSlots (twohand locks hands).
 * Style-match damage/accuracy (hybrid matches all); armour/life/prayer/crit agnostic.
 * Exact bonuses win over formula; unresolvable stats go in incomplete.
 */
export function aggregateEquipmentStats(
  loadout: LoadoutEquipmentView & { style?: CombatStyle },
  resolve: (id: string) => EquipmentRecord | undefined,
): EquipmentStatTotals {
  const totals: EquipmentStatTotals = {
    damage: 0,
    displayedAccuracy: 0,
    appliedAccuracy: 0,
    armour: 0,
    life: 0,
    prayer: 0,
    critChance: 0,
    incomplete: [],
  };
  const seen = new Set<string>();
  for (const id of Object.values(resolvedEquipmentSlots(loadout))) {
    if (seen.has(id)) continue;
    seen.add(id);
    const record = resolve(id);
    if (!record) {
      totals.incomplete.push({ id, stat: "armour", reason: "missing-record" });
      continue;
    }
    const styleMatches =
      !record.style ||
      record.style === "hybrid" ||
      loadout.style == null ||
      record.style === loadout.style;

    const armour = resolveArmour(record);
    if (armour.unknown) totals.incomplete.push({ id, stat: "armour", reason: armour.unknown });
    totals.armour += armour.value;

    const life = resolveLife(record);
    if (life.unknown) totals.incomplete.push({ id, stat: "life", reason: life.unknown });
    totals.life += life.value;

    if (styleMatches) {
      const damage = resolveDamage(record);
      if (damage.unknown) totals.incomplete.push({ id, stat: "damage", reason: damage.unknown });
      totals.damage += damage.value;
      const accuracy = record.bonuses.accuracy;
      if (accuracy != null && Number.isFinite(accuracy)) {
        totals.displayedAccuracy += accuracy;
        if (record.slot != null && !isWeaponAccuracySlot(record.slot)) {
          totals.appliedAccuracy += accuracy;
        }
      }
    } else {
      const accuracy = record.bonuses.accuracy;
      if (accuracy != null && Number.isFinite(accuracy)) totals.displayedAccuracy += accuracy;
    }

    if (record.bonuses.prayer != null && Number.isFinite(record.bonuses.prayer)) {
      totals.prayer += record.bonuses.prayer;
    }
    if (record.bonuses.critChance != null && Number.isFinite(record.bonuses.critChance)) {
      totals.critChance += record.bonuses.critChance;
    }
  }
  return totals;
}

/** Loadout-facing aggregation bound to the generated equipment catalogue. */
export function aggregateLoadoutEquipment(
  loadout: LoadoutEquipmentView & { style?: CombatStyle },
): EquipmentStatTotals {
  return aggregateEquipmentStats(loadout, equipmentById);
}
