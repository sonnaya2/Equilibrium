import type { SourceReference } from "../types";

/**
 * Crit is four separate layers: strike chance, strike damage, guaranteed crits, and
 * per-hit eligibility inside multi-hit abilities. Never a flat damage * 1.5.
 *
 * Post-Mar-2024 base crit damage progression reaches +50% at level 90.
 */
export const BASE_CRIT_DAMAGE_AT_90 = 0.5;
export const CRIT_DAMAGE_LEVEL_ANCHOR = 90;

const BASE_CRIT_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Combat_Style_Modernisation",
  title: "Combat Style Modernisation",
  verifiedAt: "2026-07-24",
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
 * Base crit damage multiplier at a style level. The +50% at 90 anchor is verified;
 * the pre-90 shape is a linear interpolation marked derived — replace with the Wiki
 * curve when sourced. Derived values are never presented as verified.
 */
export function baseCritDamageMultiplier(level: number, damageBonus = 0): number {
  if (!Number.isFinite(level) || level < 0) throw new RangeError(`crit: bad level ${level}`);
  const progression = Math.min(level / CRIT_DAMAGE_LEVEL_ANCHOR, 1);
  return 1 + BASE_CRIT_DAMAGE_AT_90 * progression + damageBonus;
}

export const BASE_CRIT_DERIVATION: SourceReference = {
  source: "derived",
  url: "https://runescape.wiki/w/Combat_Style_Modernisation",
  title: "Pre-90 crit damage shape: linear to the verified level-90 anchor",
  verifiedAt: "2026-07-24",
  derivedFrom: [BASE_CRIT_SOURCE],
};

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
