import type { SourceReference } from "../types";

/**
 * Overload-family level boosts. Formula from current Overload wiki (verified 2026-07-26):
 *   boost = floor(level × percent) + flat
 * where regular overload is 15% + 3, supreme 16% + 4, elder 17% + 5.
 *
 * The boosted level feeds accuracy composition and base ability damage alike:
 * wiki Ability damage computes from the style level "including boosts", with the
 * DPL curve capped at 145 (= level 120 + potion boosts) (verified 2026-07-31).
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
