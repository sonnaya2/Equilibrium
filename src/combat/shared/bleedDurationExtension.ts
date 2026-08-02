import type { AbilityHit, AbilitySpec } from "../pipeline/calculateAbility";
import type { ActiveEquipmentEffects } from "./equipment";
import { hasPassive } from "./equipment";

/**
 * Masterwork Spear of Annihilation (and any future same-rule passive):
 * additional eligible bleed hits = floor(base eligible bleed-hit count × 0.5).
 * Fractional remainder is discarded. Applied once to the base list only.
 *
 * Source: https://runescape.wiki/w/Masterwork_Spear_of_Annihilation (verified 2026-08-02).
 */
export const MASTERWORK_SPEAR_BLEED_EXTENSION_PASSIVE = "masterwork-spear-bleed-extension" as const;

export const BLEED_DURATION_EXTENSION_FACTOR = 0.5;

/** A hit is part of the extendable bleed tail when it is an explicit bleed DoT. */
export function isExtendableBleedHit(hit: AbilityHit): boolean {
  return hit.dot === true && hit.dotKind === "bleed";
}

/**
 * Count base eligible bleed-tail hits. Direct hits, attached components, and
 * non-bleed DoTs are excluded. Does not look at ability ids.
 */
export function eligibleBleedHitCount(hits: readonly AbilityHit[]): number {
  return hits.reduce((n, hit) => n + (isExtendableBleedHit(hit) ? 1 : 0), 0);
}

/**
 * Additional hits from a 50% duration extension, floored.
 * Always computed from the base list — never from a post-extension list.
 */
export function additionalBleedHitsFromExtension(baseBleedCount: number): number {
  if (!Number.isFinite(baseBleedCount) || baseBleedCount <= 0) return 0;
  return Math.floor(baseBleedCount * BLEED_DURATION_EXTENSION_FACTOR);
}

/**
 * Cadence (ticks between successive bleed hits) from the base bleed tail.
 * Falls back to the first hit's tickOffset when only one bleed hit exists.
 */
export function bleedCadenceTicks(bleedHits: readonly AbilityHit[]): number {
  if (bleedHits.length >= 2) {
    const a = bleedHits[0]!.tickOffset ?? 0;
    const b = bleedHits[1]!.tickOffset ?? 0;
    const step = b - a;
    return step > 0 ? step : 1;
  }
  if (bleedHits.length === 1) {
    const offset = bleedHits[0]!.tickOffset ?? 0;
    return offset > 0 ? offset : 1;
  }
  return 1;
}

/**
 * Pure hit-list extension for an equipped duration passive.
 * Returns a new array; never mutates `hits`. Idempotent only when fed base hits
 * — callers must not re-apply against an already-extended list.
 */
export function extendBleedHitList(hits: readonly AbilityHit[]): AbilityHit[] {
  const bleedHits = hits.filter(isExtendableBleedHit);
  const extra = additionalBleedHitsFromExtension(bleedHits.length);
  if (extra === 0) return hits.map((h) => ({ ...h, band: { ...h.band } }));

  const cadence = bleedCadenceTicks(bleedHits);
  const template = bleedHits[bleedHits.length - 1]!;
  const lastOffset = template.tickOffset ?? 0;
  const appended: AbilityHit[] = [];
  for (let i = 1; i <= extra; i++) {
    appended.push({
      ...template,
      band: { ...template.band },
      critEligible: false,
      dot: true,
      dotKind: "bleed",
      ...(template.bleedId != null ? { bleedId: template.bleedId } : {}),
      tickOffset: lastOffset + cadence * i,
    });
  }
  return [...hits.map((h) => ({ ...h, band: { ...h.band } })), ...appended];
}

/**
 * Resolve equipment-adjusted ability hits for Quick and simulation.
 * Applies only when the ability declares `bleedDurationExtension` for a passive
 * that is active on the loadout. Canonical ability tables are never mutated.
 */
export function resolveAbilityWithEquipment(
  ability: AbilitySpec,
  effects: ActiveEquipmentEffects | undefined,
): AbilitySpec {
  const declared = ability.bleedDurationExtension?.equipmentPassive;
  if (
    declared == null ||
    declared !== MASTERWORK_SPEAR_BLEED_EXTENSION_PASSIVE ||
    !hasPassive(effects, MASTERWORK_SPEAR_BLEED_EXTENSION_PASSIVE)
  ) {
    return ability;
  }
  if (eligibleBleedHitCount(ability.hits) === 0) return ability;
  return { ...ability, hits: extendBleedHitList(ability.hits) };
}
