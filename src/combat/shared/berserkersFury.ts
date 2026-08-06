import type { CombatContext, CombatModifier, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";

/**
 * Berserker's Fury (Archaeology monolith relic).
 * https://runescape.wiki/w/Berserker%27s_Fury
 * Breakpoints: Module:Berserker's Fury calculator (wiki).
 *
 * Half-open HP bands from floor(pct/100 * maxLP), with adjacency shrink so
 * ranges do not overlap:
 *   current >= max -> 0
 *   [91%, 100%) -> 0.5% ... [1%, 11%) -> 5.0%
 *   (0%, 1%) -> 5.5% (LP 1 .. floor(0.01*max)-1)
 * Not linear in missing health. Display steps of 0.5% up to 5.5%.
 * Affects Basic Attacks, abilities, and channels; not bleeds (wiki).
 * Core stage after roll, before crit -> pipeline stage "roll".
 */

export const BERSERKERS_FURY_ID = "berserkers_fury";
export const BERSERKERS_FURY_NAME = "Berserker's Fury";
export const BERSERKERS_FURY_ICON = "/game/upgrades/permanent-unlocks/berserkers-fury.webp";
export const BERSERKERS_FURY_MAX_BONUS = 0.055;
export const DEFAULT_CURRENT_HEALTH_PERCENT = 50;

export const BERSERKERS_FURY_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Berserker%27s_Fury",
  title: "Berserker's Fury",
  verifiedAt: "2026-08-02",
};

const LOWER_PCT = [91, 81, 71, 61, 51, 41, 31, 21, 11, 1] as const;
const UPPER_PCT = [100, 91, 81, 71, 61, 51, 41, 31, 21, 11] as const;
const BAND_BONUS = [0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05] as const;

export function sanitizeHealthPercent(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CURRENT_HEALTH_PERCENT;
  return Math.min(100, Math.max(0, value));
}

/** Life points from a 0-100 health percent of maximum (floored). */
export function lifePointsFromHealthPercent(
  maximumLifePoints: number,
  currentHealthPercent: number,
): number {
  if (!(maximumLifePoints > 0) || !Number.isFinite(maximumLifePoints)) return 0;
  const pct = sanitizeHealthPercent(currentHealthPercent);
  return Math.floor((maximumLifePoints * pct) / 100);
}

/** Damage bonus fraction (0.03 = +3%). Pure; no React / DOM. */
export function getBerserkersFuryBonus(input: {
  currentLifePoints: number;
  maximumLifePoints: number;
}): number {
  const max = input.maximumLifePoints;
  const current = input.currentLifePoints;
  if (!(max > 0) || !Number.isFinite(max) || !Number.isFinite(current)) return 0;
  if (current >= max) return 0;
  if (current < 1) return BERSERKERS_FURY_MAX_BONUS;

  const lowerHP = LOWER_PCT.map((p) => Math.floor((p / 100) * max));
  const upperHP = UPPER_PCT.map((p) => Math.floor((p / 100) * max));

  // Wiki module adjacency: shrink upper bound when it collides with the next band's lower.
  if (upperHP[0] === max) upperHP[0] -= 1;
  for (let i = 1; i <= 8; i++) {
    if (upperHP[i] === lowerHP[i - 1]) upperHP[i] -= 1;
  }
  if (upperHP[9] === lowerHP[8]) upperHP[9] -= 1;

  for (let i = 0; i < 10; i++) {
    if (current >= lowerHP[i] && current <= upperHP[i]) return BAND_BONUS[i];
  }
  if (current >= 1 && current <= lowerHP[9] - 1) return BERSERKERS_FURY_MAX_BONUS;
  return 0;
}

/** Bonus from a 0-100 health percent of maximum. */
export function getBerserkersFuryBonusFromPercent(input: {
  currentHealthPercent: number;
  maximumLifePoints: number;
}): number {
  const current = lifePointsFromHealthPercent(input.maximumLifePoints, input.currentHealthPercent);
  return getBerserkersFuryBonus({
    currentLifePoints: current,
    maximumLifePoints: input.maximumLifePoints,
  });
}

export function berserkersFuryModifier(bonus: number): CombatModifier | null {
  if (!(bonus > 0) || !Number.isFinite(bonus)) return null;
  const mult = 1 + bonus;
  return {
    id: `relic:${BERSERKERS_FURY_ID}`,
    stage: "roll",
    priority: 200,
    applies: (context: CombatContext) => context.dotKind !== "bleed",
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: BERSERKERS_FURY_SOURCE,
  };
}
