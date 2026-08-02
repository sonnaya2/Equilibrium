import type { AbilityHit } from "../../pipeline/calculateAbility";

/** Explicit hit classification — never infer bleed/DoT from critEligible. */

export function isDamagingHit(hit: AbilityHit): boolean {
  return hit.band.maxPct > 0 || hit.band.minPct > 0;
}

export function isDotHit(hit: AbilityHit): boolean {
  return hit.dot === true;
}

export function isBleedHit(hit: AbilityHit): boolean {
  return hit.dotKind === "bleed" || hit.bleedId != null;
}

export function isDirectHit(hit: AbilityHit): boolean {
  return !isDotHit(hit);
}

export function isCritEligibleHit(hit: AbilityHit): boolean {
  return hit.critEligible !== false;
}

export function firstEligibleDirectHitIndex(hits: readonly AbilityHit[]): number {
  return hits.findIndex((h) => isDirectHit(h) && isCritEligibleHit(h));
}

export function hasDamagingHits(hits: readonly AbilityHit[]): boolean {
  return hits.length > 0 && hits.some(isDamagingHit);
}

export function hasFuryConsumingHit(hits: readonly AbilityHit[]): boolean {
  return hits.some((h) => !isBleedHit(h) && isDamagingHit(h));
}
