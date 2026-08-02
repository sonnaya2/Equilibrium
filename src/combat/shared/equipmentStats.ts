import type { ArmourClass, EquipmentRecord, EquipmentSlot } from "../data/records";
import type { CombatStyle, SourceReference } from "../types";
import { accuracyCurve } from "../target/genericTarget";
import { isWeaponAccuracySlot, type LoadoutEquipmentView } from "./equipment";
import { equipmentById } from "../data";

export type { ArmourClass } from "../data/records";

/**
 * Pure equipment stat derivation from tier, slot and armour classification.
 *
 * Exact sourced bonuses (EquipmentRecord.bonuses) always override these derived
 * values; these helpers exist for records whose bonuses are not individually
 * sourced. A slot that cannot carry a stat yields null — unknown stays
 * distinguishable from a sourced zero, and no value is invented.
 *
 * Armour base: f(t) = t³/500 + 10t + 100 (identical to 2.5 × accuracyCurve).
 * Armour and damage floor to one decimal; life points are integers.
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

/**
 * Floor to one decimal. The 1e-9 guard absorbs binary representation error at
 * exact decimal boundaries (e.g. 0.03 × f(50) = 25.5); real values are ~1e-6
 * apart, so the guard can never cross a mechanical boundary.
 */
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
 * Armour slot multiplier (head .2, body .23, legs .22, hands .05, feet .05,
 * back .03, ring .02, shield .2). Shields are stored in the offhand slot, so
 * `shield` is explicit metadata. Null when the slot carries no Armour stat.
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
 * Derived Armour value for one piece: floor₁(mult × f(effective tier)).
 * `armourTier` overrides the class-adjusted tier for items whose armour tier
 * diverges from their headline tier (e.g. chainbodies at t−2, Vestments t70).
 * Null when the slot carries no Armour stat or the effective tier is unusable.
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
 * Defenders: half the shield multiplier at full tier — 0.1 × f(t) floored to
 * one decimal (rune t50 = 85.0, kalphite t90 = 245.8). Wiki prose claiming
 * half-tier stats conflicts with the live infobox values; the values win.
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
 * Damage-bonus slot multipliers (9 Mar 2026 normalisation brought items back in
 * line with this formula): head .25, body/back/ring .375, legs .3125,
 * hands/feet/pocket .15625, neck .575. Melee ammo-harness items use .26875;
 * other ammo carries no damage bonus. Weapon slots have none — weapon damage
 * is encoded by tier, never listed as a bonus.
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
 * Effective damage tier by class: power and PvP armour carry damage at their
 * full tier; tank and hybrid carry none (null). Off-model hybrid-power items
 * (Cinderbane, rogue gloves, …) need an explicit damageTier on the record.
 */
export function classDamageTier(tier: number, armourClass: ArmourClass): number | null {
  return armourClass === "power" || armourClass === "pvp" ? tier : null;
}

/**
 * Derived equipment Damage bonus: floor₁(slot multiplier × damage tier),
 * applied per item. Null when the slot carries no damage bonus.
 */
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
 * Defender damage: an off-hand fastest weapon of half tier — 4.8 × (t/2) —
 * floored to one decimal (rune 120.0, dragon 144.0, kalphite 216.0).
 */
export function defenderDamageValue(tier: number): number {
  if (!Number.isFinite(tier) || tier < 1) {
    throw new RangeError(`defenderDamageValue: bad tier ${tier}`);
  }
  return floorOneDecimal(2.4 * tier);
}

/**
 * Derived Life bonus for one armour piece.
 * Tank: slotMult × tier. Power: 0 by default — exceptional power sets (Nex,
 * masterwork magic/ranged) carry LP at tier−5, expressed by an explicit
 * `lifeTier` on the record. Hybrid and PvP: 0. Shield: 35 × (t−69).
 * Null when the slot carries no Life stat (jewellery, weapons, ammo, cape).
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
  /** Sum of every equipped Accuracy bonus including weapons — display only. */
  displayedAccuracy: number;
  /** Non-weapon Accuracy — the mechanically applied term. Weapons are tier-encoded. */
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

/**
 * Slots whose stat derivation is class-gated (armour pieces: tank t, power t−5,
 * hybrid t−15). Shields, rings and capes derive at raw tier; amulets, pockets
 * and ammo carry no Armour/Life at all.
 */
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
  // Shields, rings and capes take their multiplier at raw tier — no class offset.
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
  if (record.bonuses.damage != null) return { value: record.bonuses.damage };
  if (record.slot == null) return { value: 0, unknown: "missing-slot" };
  if (isWeaponAccuracySlot(record.slot)) {
    // Defenders are off-hand weapons with a real damage bonus.
    if (record.defender) {
      return record.tier == null
        ? { value: 0, unknown: "missing-tier" }
        : { value: defenderDamageValue(record.tier) };
    }
    return { value: 0 };
  }
  if (record.damageTier != null) {
    const derived = equipmentDamageValue(record.slot, record.damageTier, record);
    return derived == null ? { value: 0 } : { value: derived };
  }
  if (!CLASS_GATED_SLOTS.has(record.slot)) {
    // Jewellery without a sourced damage bonus contributes zero — absence is
    // not flagged here; off-model hybrid-power items need an explicit damageTier.
    return { value: 0 };
  }
  if (record.armourClass == null) return { value: 0, unknown: "missing-armourClass" };
  if (record.tier == null) return { value: 0, unknown: "missing-tier" };
  const damageTier = classDamageTier(record.tier, record.armourClass);
  if (damageTier == null) return { value: 0 };
  const derived = equipmentDamageValue(record.slot, damageTier, record);
  return derived == null ? { value: 0 } : { value: derived };
}

/** Slots a two-handed weapon overrides: when twohand is occupied, hands are locked. */
const TWOHAND_LOCKED_SLOTS: readonly string[] = ["mainhand", "offhand"];

/**
 * The canonical equipment aggregation. Equipped slots only — unlock pins are
 * never equipped; duplicate item ids count once; an occupied twohand slot
 * locks mainhand/offhand out. Damage/accuracy sums keep the established
 * style-matching rule (hybrid counts for every style); armour, life, prayer
 * and crit chance are style-agnostic. Exact sourced bonuses win over
 * formula-derived values; anything unresolvable is reported in `incomplete`
 * instead of being silently treated as zero.
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
  const slots = loadout.equipmentSlots ?? {};
  const twohandEquipped = typeof slots.twohand === "string";
  const seen = new Set<string>();
  for (const [slot, id] of Object.entries(slots)) {
    if (typeof id !== "string" || seen.has(id)) continue;
    if (twohandEquipped && TWOHAND_LOCKED_SLOTS.includes(slot)) continue;
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
