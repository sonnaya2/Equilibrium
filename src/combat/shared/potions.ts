import type { SourceReference } from "../types";

/**
 * Overload-family level boosts. Formula from current Overload wiki (verified 2026-07-26):
 *   boost = floor(level × percent) + flat
 * where regular overload is 15% + 3, supreme 16% + 4, elder 17% + 5.
 *
 * Scope note (honest): the 4 Mar 2024 Core Combat Update removed the boosted-level
 * contribution to damage-per-level. These helpers return the temporary skill level
 * delta for accuracy / hit-chance composition. They do NOT multiply ability damage
 * and must not be fed into DPL as if boosted levels raised ability damage base.
 */

export const OVERLOAD_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Overload",
  title: "Overload",
  verifiedAt: "2026-07-26",
};

export const SUPREME_OVERLOAD_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Supreme_overload_potion",
  title: "Supreme overload potion",
  verifiedAt: "2026-07-26",
};

export const ELDER_OVERLOAD_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Elder_overload_potion",
  title: "Elder overload potion",
  verifiedAt: "2026-07-26",
};

export type OverloadTier = "overload" | "supreme" | "elder";

export interface OverloadFormula {
  id: OverloadTier;
  name: string;
  percent: number;
  flat: number;
  durationSeconds: number;
  reapplySeconds: number;
  source: SourceReference;
}

export const OVERLOAD_FORMULAS: Record<OverloadTier, OverloadFormula> = {
  overload: {
    id: "overload",
    name: "Overload",
    percent: 0.15,
    flat: 3,
    durationSeconds: 360,
    reapplySeconds: 15,
    source: OVERLOAD_SOURCE,
  },
  supreme: {
    id: "supreme",
    name: "Supreme overload",
    percent: 0.16,
    flat: 4,
    durationSeconds: 360,
    reapplySeconds: 15,
    source: SUPREME_OVERLOAD_SOURCE,
  },
  elder: {
    id: "elder",
    name: "Elder overload",
    percent: 0.17,
    flat: 5,
    durationSeconds: 360,
    reapplySeconds: 15,
    source: ELDER_OVERLOAD_SOURCE,
  },
};

/** Temporary levels added to each combat style stat. */
export function overloadLevelBoost(baseLevel: number, tier: OverloadTier = "overload"): number {
  if (!Number.isFinite(baseLevel) || baseLevel < 1) {
    throw new RangeError(`overloadLevelBoost: bad base level ${baseLevel}`);
  }
  const formula = OVERLOAD_FORMULAS[tier];
  return Math.floor(baseLevel * formula.percent) + formula.flat;
}

/** Effective skill level while the overload boost is active. */
export function overloadBoostedLevel(baseLevel: number, tier: OverloadTier = "overload"): number {
  return baseLevel + overloadLevelBoost(baseLevel, tier);
}
