/** Probability and lane-aggregation helpers for stochastic summaries. */

export const PROB_TOLERANCE = 1e-9;
export const WEIGHT_TOLERANCE = 1e-12;
export const RESIDUAL_FREE_TOLERANCE = 1e-12;

export function isNearOne(mass: number, tolerance = PROB_TOLERANCE): boolean {
  return Math.abs(mass - 1) <= tolerance;
}

export function isNearZero(value: number, tolerance = WEIGHT_TOLERANCE): boolean {
  return Math.abs(value) <= tolerance;
}

/** Weighted mean; returns 0 when total weight is non-positive. */
export function weightedMean(
  parts: readonly { weight: number; value: number }[],
  totalWeight?: number,
): number {
  const w = totalWeight ?? parts.reduce((sum, p) => sum + p.weight, 0);
  if (!(w > 0)) return 0;
  return parts.reduce((sum, p) => sum + p.weight * p.value, 0) / w;
}

export function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Support min/max offsets relative to weight-averaged path conditionals.
 * When future damage lands after a merge, `totalMin += d` and
 * `supportMin = totalMin + supportMinOffset` stay correct because the offset
 * encodes only the past differential (min − mix).
 */
export function supportMinFrom(totalMin: number, supportMinOffset: number): number {
  return totalMin + supportMinOffset;
}

export function supportMaxFrom(totalMax: number, supportMaxOffset: number): number {
  return totalMax + supportMaxOffset;
}

export function mergeSupportOffsets(
  aTotalMin: number,
  aTotalMax: number,
  aSupportMinOffset: number,
  aSupportMaxOffset: number,
  bTotalMin: number,
  bTotalMax: number,
  bSupportMinOffset: number,
  bSupportMaxOffset: number,
  weightA: number,
  weightB: number,
): { totalMin: number; totalMax: number; supportMinOffset: number; supportMaxOffset: number } {
  const weight = weightA + weightB;
  const mix = (x: number, y: number) => (weightA * x + weightB * y) / weight;
  const totalMin = mix(aTotalMin, bTotalMin);
  const totalMax = mix(aTotalMax, bTotalMax);
  const supportMin = Math.min(
    supportMinFrom(aTotalMin, aSupportMinOffset),
    supportMinFrom(bTotalMin, bSupportMinOffset),
  );
  const supportMax = Math.max(
    supportMaxFrom(aTotalMax, aSupportMaxOffset),
    supportMaxFrom(bTotalMax, bSupportMaxOffset),
  );
  return {
    totalMin,
    totalMax,
    supportMinOffset: supportMin - totalMin,
    supportMaxOffset: supportMax - totalMax,
  };
}
