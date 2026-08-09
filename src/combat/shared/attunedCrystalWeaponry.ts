import { equipmentById } from "../data";
import type { CrystalWeaponryRole, EquipmentRecord } from "../data/records";
import type { DamageProvenance } from "./damageProvenance";
import { capabilitiesOf } from "./damageProvenance";
import {
  resolvedEquipmentSlots,
  type LoadoutEquipmentView,
} from "./equipment";

/**
 * Attuned crystal weaponry damage passive.
 *
 * Sources:
 * - https://runescape.wiki/w/Crystal_equipment (both-hands setups; 25% bonus; Agility to 12%)
 * - https://runescape.wiki/w/Attuned_crystal_staff (and sibling weapon pages)
 * - In-game tooltip transcript (Attuned crystal wand): both hands / 2H / dual-wield shields
 * - Update 7 Feb 2022: "Crystal Shields also work for Attuned Crystal weaponry's dual wield effect"
 *
 * T70 crystal shield/deflector/ward qualify as the off-hand partner (official tooltip
 * clarification). Overview prose that says only "attuned shield" is incomplete vs that note.
 *
 * Agility curve: wiki pins 12% at 99 only; no intermediate table is published.
 * Use agility/825 so 99 Agility is exactly 0.12; cap at 0.12 for boosted levels.
 *
 * Armour set (2+ pieces of each family, armour slots only):
 * regular crystal armour +3%; attuned crystal armour +6% (additive on chance; no further cap).
 * Families count separately; 1 crystal + 1 attuned does not meet either threshold.
 */

export const ATTUNED_CRYSTAL_WEAPONRY_PASSIVE_ID = "attuned-crystal-weaponry" as const;
export const ATTUNED_CRYSTAL_BONUS_DAMAGE_FRACTION = 0.25;
/** 99 / 825 = 0.12 exactly. */
export const ATTUNED_CRYSTAL_AGILITY_DENOMINATOR = 825;
/** Agility-only ceiling; armour set bonus is additive on top (wiki "increased by"). */
export const ATTUNED_CRYSTAL_MAX_PROC_CHANCE = 0.12;
export const ATTUNED_CRYSTAL_COMPONENT_ID = "attuned-crystal-weaponry";

/** Wiki set bonus at 2+ regular crystal armour pieces. */
export const CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS = 0.03;
/** Wiki set bonus at 2+ attuned crystal armour pieces. */
export const ATTUNED_CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS = 0.06;
export const CRYSTAL_ARMOUR_SET_THRESHOLD = 2;

/** Body slots that count toward crystal armour set piece totals (not shields/weapons). */
export const CRYSTAL_ARMOUR_SLOTS = [
  "helmet",
  "body",
  "legs",
  "gloves",
  "boots",
] as const;

export type AttunedCrystalWeaponryState = {
  active: true;
  procChance: number;
  agilityLevel: number;
  /** Additive set bonus from 2+ crystal / attuned crystal armour pieces. */
  armourProcBonus: number;
};

export function stripAugmentedEquipmentId(id: string): string {
  return id.startsWith("item:augmented-") ? `item:${id.slice("item:augmented-".length)}` : id;
}

export function equipmentCrystalWeaponryRole(
  id: string | null | undefined,
): CrystalWeaponryRole | undefined {
  if (typeof id !== "string") return undefined;
  const direct = equipmentById(id)?.crystalWeaponry;
  if (direct) return direct;
  const baseId = stripAugmentedEquipmentId(id);
  if (baseId !== id) return equipmentById(baseId)?.crystalWeaponry;
  return undefined;
}

export function isAttunedCrystalWeapon(id: string | null | undefined): boolean {
  return equipmentCrystalWeaponryRole(id) === "attuned-weapon";
}

export function isCrystalShieldPartner(id: string | null | undefined): boolean {
  return equipmentCrystalWeaponryRole(id) === "crystal-shield-partner";
}

/**
 * Loadout eligibility (resolved slots; twohand lockout applies):
 * - attuned two-handed weapon alone
 * - dual-wield attuned weapons (MH + OH weapon/orb)
 * - attuned main-hand + crystal shield partner (T70 or attuned shield/deflector/ward)
 */
export function isAttunedCrystalWeaponryLoadoutActive(
  loadout: LoadoutEquipmentView,
): boolean {
  const slots = resolvedEquipmentSlots(loadout);
  const twohand = slots.twohand;
  if (twohand) return isAttunedCrystalWeapon(twohand);

  const mainhand = slots.mainhand;
  if (!isAttunedCrystalWeapon(mainhand)) return false;

  const offhand = slots.offhand;
  return isAttunedCrystalWeapon(offhand) || isCrystalShieldPartner(offhand);
}

/**
 * Proc chance from Agility only. 99 -> exactly 0.12. Levels above 99 stay capped at 12%.
 * Intermediate values use agility/825 (linear through the sole published endpoint).
 * Armour set bonus is applied separately in resolveAttunedCrystalWeaponry.
 */
export function attunedCrystalProcChance(agilityLevel: number): number {
  if (!Number.isFinite(agilityLevel) || agilityLevel <= 0) return 0;
  const level = Math.floor(agilityLevel);
  if (level <= 0) return 0;
  return Math.min(ATTUNED_CRYSTAL_MAX_PROC_CHANCE, level / ATTUNED_CRYSTAL_AGILITY_DENOMINATOR);
}

export function isCrystalArmourPiece(id: string | null | undefined): boolean {
  return equipmentCrystalWeaponryRole(id) === "crystal-armour";
}

export function isAttunedCrystalArmourPiece(id: string | null | undefined): boolean {
  return equipmentCrystalWeaponryRole(id) === "attuned-crystal-armour";
}

/** Count tagged crystal armour pieces in body slots only. */
export function countCrystalArmourPieces(loadout: LoadoutEquipmentView): {
  crystal: number;
  attuned: number;
} {
  const slots = resolvedEquipmentSlots(loadout);
  let crystal = 0;
  let attuned = 0;
  for (const slot of CRYSTAL_ARMOUR_SLOTS) {
    const role = equipmentCrystalWeaponryRole(slots[slot]);
    if (role === "attuned-crystal-armour") attuned += 1;
    else if (role === "crystal-armour") crystal += 1;
  }
  return { crystal, attuned };
}

/**
 * Additive proc-chance bonus from crystal armour sets (wiki Crystal equipment set table).
 * Regular and attuned families are independent; each needs 2+ of its own pieces.
 */
export function crystalArmourWeaponryProcBonus(loadout: LoadoutEquipmentView): number {
  const { crystal, attuned } = countCrystalArmourPieces(loadout);
  let bonus = 0;
  if (crystal >= CRYSTAL_ARMOUR_SET_THRESHOLD) bonus += CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS;
  if (attuned >= CRYSTAL_ARMOUR_SET_THRESHOLD) bonus += ATTUNED_CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS;
  return bonus;
}

export function resolveAttunedCrystalWeaponry(
  loadout: LoadoutEquipmentView,
  agilityLevel: number,
): AttunedCrystalWeaponryState | undefined {
  if (!isAttunedCrystalWeaponryLoadoutActive(loadout)) return undefined;
  const agilityChance = attunedCrystalProcChance(agilityLevel);
  const armourProcBonus = crystalArmourWeaponryProcBonus(loadout);
  const chance = agilityChance + armourProcBonus;
  if (chance <= 0) return undefined;
  return {
    active: true,
    procChance: chance,
    agilityLevel: Math.floor(agilityLevel),
    armourProcBonus,
  };
}

/** Direct player hits only; DoT/poison/conjure/proc/attached never qualify. */
export function isAttunedCrystalWeaponryHitEligible(provenance: DamageProvenance): boolean {
  return capabilitiesOf(provenance).directHit;
}

/**
 * Expected bonus damage from one eligible source hit.
 * EV = sourceExpected * 0.25 * procChance (damage-only RNG; not a state branch).
 */
export function attunedCrystalExpectedBonus(
  sourceExpected: number,
  procChance: number,
): number {
  if (!(sourceExpected > 0) || !(procChance > 0)) return 0;
  return sourceExpected * ATTUNED_CRYSTAL_BONUS_DAMAGE_FRACTION * procChance;
}

export function crystalWeaponryRoleFromRecord(
  record: Pick<EquipmentRecord, "crystalWeaponry"> | undefined,
): CrystalWeaponryRole | undefined {
  return record?.crystalWeaponry;
}
