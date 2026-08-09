import type { AbilityHit } from "../../pipeline/calculateAbility";
import { stripAugmentedEquipmentId } from "../../shared/attunedCrystalWeaponry";
import type { SourceReference } from "../../types";

/**
 * Dark bow / Gloomfire Darkfang: Ranged basic is two independent hits of 45-55%
 * instead of one 90-110%. Wiki Ranged (ability) Darkfang row.
 * https://runescape.wiki/w/Ranged_(ability)
 */
export const DARKFANG_WEAPON_IDS: readonly string[] = ["item:dark-bow", "item:gloomfire-bow"];

export const DARKFANG_BASIC_HITS: readonly AbilityHit[] = [
  { band: { minPct: 45, maxPct: 55 } },
  { band: { minPct: 45, maxPct: 55 } },
];

export const DARKFANG_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Ranged_(ability)",
  title: "Ranged (ability)",
  verifiedAt: "2026-08-04",
};

const DARKFANG_ID_SET = new Set<string>(DARKFANG_WEAPON_IDS);

export function isDarkfangWeaponId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (DARKFANG_ID_SET.has(id)) return true;
  const base = stripAugmentedEquipmentId(id);
  return base !== id && DARKFANG_ID_SET.has(base);
}

/**
 * True when Dark bow / Gloomfire is wielded.
 * Prefer activeWeapon id (resolved MH/2H); also scans equipmentIds (legacy flat lists).
 * Augmented ids match after strip.
 */
export function hasDarkfangWeapon(
  equipmentIds: readonly string[] | undefined,
  activeWeaponId?: string | null,
): boolean {
  if (isDarkfangWeaponId(activeWeaponId)) return true;
  if (!equipmentIds?.length) return false;
  return equipmentIds.some((id) => isDarkfangWeaponId(id));
}

/** Two real hits; each participates independently in per-hit systems. */
export function darkfangBasicHits(): AbilityHit[] {
  return DARKFANG_BASIC_HITS.map((h) => ({ band: { ...h.band } }));
}
