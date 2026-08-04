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
 * Apply Caroming at Ricochet band construction: each hit band * (1 + 4%/rank).
 * Integer scale path: pct * (100 + 4*rank) / 100 (avoids 15 * 1.04 float dust).
 * Preserves per-hit structure; does not flatten to one total or copy multi-target.
 */
function scaleBandPct(pct: number, rank: number): number {
  // caromingRicochetBonus(rank) === 0.04 * rank
  const scale = 100 + Math.round(caromingRicochetBonus(rank) * 100);
  return (pct * scale) / 100;
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
      minPct: scaleBandPct(h.band.minPct, rank),
      maxPct: scaleBandPct(h.band.maxPct, rank),
    },
  }));
}
