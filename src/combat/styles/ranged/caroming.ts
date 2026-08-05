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
 * Apply Caroming at Ricochet band construction.
 * Wiki Caroming (post 9 Mar 2026): +4% ability damage per rank per hit (flat AD
 * percentage points, not multiplicative). Rank 4: 75-85 -> 91-101; returns 15-20
 * -> 31-36; late GR 4-6 -> 20-22.
 * Preserves per-hit structure; does not flatten to one total or copy multi-target.
 */
function flatCaromingPct(pct: number, rank: number): number {
  // caromingRicochetBonus(rank) === 0.04 * rank -> 4 * rank percentage points
  return pct + Math.round(caromingRicochetBonus(rank) * 100);
}

export function applyCaromingToRicochetHits(
  hits: readonly AbilityHit[],
  rank: number,
): AbilityHit[] {
  if (!Number.isInteger(rank) || rank < 1) {
    return hits.map((h) => ({ ...h, band: { ...h.band } }));
  }
  return hits.map((h) => ({
    ...h,
    band: {
      minPct: flatCaromingPct(h.band.minPct, rank),
      maxPct: flatCaromingPct(h.band.maxPct, rank),
    },
  }));
}
