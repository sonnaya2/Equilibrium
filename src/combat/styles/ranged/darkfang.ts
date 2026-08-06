import type { AbilityHit } from "../../pipeline/calculateAbility";
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

export function hasDarkfangWeapon(equipmentIds: readonly string[] | undefined): boolean {
  if (!equipmentIds?.length) return false;
  const set = new Set(equipmentIds);
  return DARKFANG_WEAPON_IDS.some((id) => set.has(id));
}

/** Two real hits; each participates independently in per-hit systems. */
export function darkfangBasicHits(): AbilityHit[] {
  return DARKFANG_BASIC_HITS.map((h) => ({ band: { ...h.band } }));
}
