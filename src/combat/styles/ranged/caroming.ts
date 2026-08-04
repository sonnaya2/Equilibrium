import type { AbilityHit } from "../../pipeline/calculateAbility";
import { caromingRicochetBonus } from "../../shared/perks";

const RICOCHET_IDS = new Set([
  "ricochet",
  "greater_ricochet",
  "ranged:ricochet",
  "ranged:greater-ricochet",
]);

export function isRicochetAbility(abilityId: string): boolean {
  return RICOCHET_IDS.has(abilityId);
}

/**
 * Apply Caroming at Ricochet band construction: each hit band × (1 + 4%/rank).
 * Preserves per-hit structure; does not flatten to one total or copy multi-target.
 */
export function applyCaromingToRicochetHits(
  hits: readonly AbilityHit[],
  rank: number,
): AbilityHit[] {
  if (!Number.isInteger(rank) || rank < 1) {
    return hits.map((h) => ({ ...h, band: { ...h.band } }));
  }
  const mult = 1 + caromingRicochetBonus(rank);
  return hits.map((h) => ({
    ...h,
    band: {
      minPct: h.band.minPct * mult,
      maxPct: h.band.maxPct * mult,
    },
  }));
}
