import type { SourceReference } from "../types";

/**
 * Crit is four separate layers: strike chance, strike damage, guaranteed crits, and
 * per-hit eligibility inside multi-hit abilities. Never a flat damage * 1.5.
 *
 * Post-Mar-2024 base crit damage progression reaches +50% at level 90.
 */
export const BASE_CRIT_DAMAGE_AT_90 = 0.5;
export const CRIT_DAMAGE_LEVEL_ANCHOR = 90;

/**
 * Base crit damage is sourced stepwise, not interpolated (wiki, 4 Mar 2024 update):
 * +10% at levels 1–19, +5% per further 10 levels, capped at +50% from 90 —
 * boosted levels past 90 stay at +50%.
 * https://runescape.wiki/w/Critical_strike (verified 2026-07-31)
 */
export const BASE_CRIT_DERIVATION: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Critical_strike",
  title: "Critical strike",
  verifiedAt: "2026-07-31",
};

export interface CritLayers {
  /** Final strike chance 0..1 (base plus modifiers, summed by the caller). */
  chance: number;
  /** Extra crit damage on top of base, e.g. +0.2 from an ability. */
  damageBonus?: number;
  /** Skips the chance roll. */
  guaranteed?: boolean;
  /** False = this hit cannot crit at all (default for bleed tails). */
  eligible?: boolean;
}

/**
 * Base crit damage multiplier at a style level: stepwise per BASE_CRIT_DERIVATION.
 * damageBonus stacks on top as its own layer.
 */
export function baseCritDamageMultiplier(level: number, damageBonus = 0): number {
  if (!Number.isFinite(level) || level < 0) throw new RangeError(`crit: bad level ${level}`);
  const step = Math.max(1, Math.floor(level / 10));
  return 1 + Math.min(BASE_CRIT_DAMAGE_AT_90, 0.05 * (step + 1)) + damageBonus;
}

export function rollsCrit(layers: CritLayers, roll: number): boolean {
  if (layers.eligible === false) return false;
  if (layers.guaranteed) return true;
  return roll < layers.chance;
}

/** Chance-weighted crit probability for expectation math. */
export function critProbability(layers: CritLayers): number {
  if (layers.eligible === false) return 0;
  if (layers.guaranteed) return 1;
  return Math.min(1, Math.max(0, layers.chance));
}
