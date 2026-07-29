import type { CombatModifier } from "../types";

/** Equilibrium league loadout. Modifiers from relics/blessings/regions layer on top of
 *  base combat through the same pipeline — never merged into core formulas. */
export interface LeagueLoadout {
  ruleset?: "base" | "equilibrium";
  relics?: string[];
  blessings?: string[];
  regions?: string[];
}

/**
 * League modifiers for a loadout. Empty until relic/blessing effects are verified —
 * see data/reference/unknowns.json ("equilibrium_blessing_effects",
 * "equilibrium_relic_tiers_2_to_7").
 */
export function leagueModifiers(_loadout: LeagueLoadout): CombatModifier[] {
  return [];
}
