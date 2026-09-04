import type { SourceReference } from "../types";

/**
 * Ring of Vigour (equipment) and permanent Anachronia/Extinction unlock.
 * https://runescape.wiki/w/Ring_of_vigour
 *
 * Activation sources (Boolean OR, never stacks):
 * 1. Equipped item:ring-of-vigour
 * 2. Permanent passive (Warped Gem after Extinction; combat-gated on Anachronia)
 *
 * Effects while active:
 * - After a qualifying ultimate: refund 10 adrenaline once (same gate as CoE)
 * - Weapon special / EoF specials: requirement and spend = base - floor(base * 0.1)
 *   (e.g. 50->45, 30->27, 60->54, 25->23, 55->50)
 *
 * Stacks additively with Conservation of Energy on ultimates (+10 each).
 * Onslaught is excluded from the ultimate refund (see conservationOfEnergy).
 */

export const RING_OF_VIGOUR_ITEM_ID = "item:ring-of-vigour";
export const RING_OF_VIGOUR_REFUND = 10;
/** Fraction of original special cost discounted (not a flat -10 adren). */
export const RING_OF_VIGOUR_SPECIAL_COST_DISCOUNT = 0.1;
export const RING_OF_VIGOUR_PASSIVE_REGION = "anachronia" as const;

export const RING_OF_VIGOUR_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Ring_of_vigour",
  title: "Ring of vigour",
  verifiedAt: "2026-08-03",
};

export type RingOfVigourSource = "equipped" | "permanent";

/**
 * Modelled weapon special / EoF special ability ids (audit catalogue).
 * Runtime classification is AbilitySpec.weaponSpecial via isWeaponSpecialAbility.
 * Keep in sync when adding a special under styles/*.
 */
export const MODELLED_WEAPON_SPECIAL_IDS = [
  "balance_by_force",
  "descent_of_darkness",
  "icy_tempest",
  "instability",
  "claws_of_guthix",
  "death_grasp",
  "igneous_showdown",
  "soulfire",
] as const;

export type ModelledWeaponSpecialId = (typeof MODELLED_WEAPON_SPECIAL_IDS)[number];

/** True when the ring is among currently worn equipment ids. */
export function isRingOfVigourWorn(equipmentIds: readonly string[] | undefined): boolean {
  return equipmentIds?.includes(RING_OF_VIGOUR_ITEM_ID) === true;
}

/**
 * Permanent unlock is available only when Anachronia is unlocked.
 * When region context is omitted, the buff flag alone is trusted (engine/unit tests).
 */
export function isRingOfVigourPassiveAvailable(
  unlockedRegions: readonly string[] | undefined,
): boolean {
  if (unlockedRegions == null) return true;
  return unlockedRegions.includes(RING_OF_VIGOUR_PASSIVE_REGION);
}

/** Buff flag counts only when Anachronia (or no region gate) allows it. */
export function isRingOfVigourPassiveEffective(
  permanentPassive: boolean | undefined,
  unlockedRegions?: readonly string[],
): boolean {
  return permanentPassive === true && isRingOfVigourPassiveAvailable(unlockedRegions);
}

/**
 * Shared activation: equipped ring OR permanent passive (Boolean OR).
 * Dual sources still yield a single Vigour application.
 */
export function hasRingOfVigourEffect(input: {
  equipmentIds?: readonly string[];
  ringOfVigourPassive?: boolean;
  unlockedRegions?: readonly string[];
}): boolean {
  return (
    isRingOfVigourWorn(input.equipmentIds) ||
    isRingOfVigourPassiveEffective(input.ringOfVigourPassive, input.unlockedRegions)
  );
}

/** Active sources for UI / analysis (deduped display uses this once). */
export function ringOfVigourActiveSources(input: {
  equipmentIds?: readonly string[];
  ringOfVigourPassive?: boolean;
  unlockedRegions?: readonly string[];
}): RingOfVigourSource[] {
  const sources: RingOfVigourSource[] = [];
  if (isRingOfVigourWorn(input.equipmentIds)) sources.push("equipped");
  if (isRingOfVigourPassiveEffective(input.ringOfVigourPassive, input.unlockedRegions)) {
    sources.push("permanent");
  }
  return sources;
}

export function formatRingOfVigourSources(sources: readonly RingOfVigourSource[]): string {
  const labels = sources.map((s) => (s === "equipped" ? "Equipped ring" : "Permanent unlock"));
  if (labels.length === 0) return "Ring of Vigour";
  return `Ring of Vigour · Active via: ${labels.join(", ")}`;
}

/**
 * Special-attack adrenaline requirement and spend.
 * 10% discount of original cost: base - floor(base * 0.1).
 * Wiki examples 50->45; historical 55->50 (not Math.floor(base*0.9)).
 */
export function resolveSpecialAttackAdrenalineCost(
  baseCost: number,
  hasRingOfVigour: boolean,
): number {
  if (!(baseCost > 0) || !hasRingOfVigour) return Math.max(0, baseCost);
  const discount = Math.floor(baseCost * RING_OF_VIGOUR_SPECIAL_COST_DISCOUNT);
  return Math.max(0, baseCost - discount);
}

/**
 * Sole runtime gate: AbilitySpec.weaponSpecial === true.
 * Do not fork special classification in cast/UI paths - call this.
 */
export function isWeaponSpecialAbility(ability: { weaponSpecial?: boolean }): boolean {
  return ability.weaponSpecial === true;
}

/**
 * Listed catalogue cost after Vigour (for analysis / UI).
 * Does not apply Icy Tempest stack reduction (spend-only) or free-cast zeros.
 */
export function listedWeaponSpecialCost(
  ability: { weaponSpecial?: boolean; adrenaline?: { cost?: number } },
  hasRingOfVigour: boolean,
): number {
  const base = ability.adrenaline?.cost ?? 0;
  if (!isWeaponSpecialAbility(ability)) return Math.max(0, base);
  return resolveSpecialAttackAdrenalineCost(base, hasRingOfVigour);
}
