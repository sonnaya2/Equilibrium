import { mulFloor } from "../core/rounding";
import {
  BETA_UPDATE_3_WIKI_2026_02_13,
  BETA_UPDATE_4_WIKI_2026_02_18,
  REFINEMENTS_WIKI_2026_03_09,
} from "../data/sources";
import type { CombatModifier } from "../types";

/**
 * Invention perks as staged modifiers. Only perks with sourced current numbers are
 * modelled; everything else stays out until a source lands (ponytail: Biting's crit
 * chance and most gizmo effects are corpus-famous but unsourced post-modernisation —
 * the update-index poll on the perks dataset is the trigger to add them).
 *
 * Ability scoping happens by closure: CombatContext carries no ability identity, so
 * category- and ability-specific perks capture the cast they were built for.
 */

/** Equilibrium perk (9 Mar 2026): +10% ability damage, +1% per rank. */
export function equilibriumPerkModifier(rank: number): CombatModifier {
  return {
    id: `perk:equilibrium:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1 + (10 + rank) / 100) }),
    source: REFINEMENTS_WIKI_2026_03_09,
  };
}

/** Ultimatums perk (Beta Update 4): +3% + 1%/rank damage for ultimate casts. */
export function ultimatumsPerkModifier(rank: number, castCategory: string): CombatModifier {
  return {
    id: `perk:ultimatums:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => castCategory === "ultimate",
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1 + (3 + rank) / 100) }),
    source: BETA_UPDATE_4_WIKI_2026_02_18,
  };
}

const LUNGING_ABILITY_IDS = new Set(["melee:dismember", "magic:combust"]);

/** Lunging perk (Beta Update 3): +10% flat + 3%/rank for Dismember and Combust lines. */
export function lungingPerkModifier(rank: number, abilityId: string): CombatModifier {
  return {
    id: `perk:lunging:${rank}`,
    stage: "base",
    priority: 100,
    applies: () => LUNGING_ABILITY_IDS.has(abilityId),
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1 + (10 + 3 * rank) / 100) }),
    source: BETA_UPDATE_3_WIKI_2026_02_13,
  };
}

/** Energising perk (Beta Update 4): flat accuracy 50 + 25/rank, added to player accuracy. */
export function energisingAccuracyBonus(rank: number): number {
  return 50 + 25 * rank;
}

/** 120 skillcape perks (Beta Update 4). Only the damage-relevant ones are constants;
 *  Magic (hexes last 2x) and Ranged (10% ammo-save) feed their own style systems. */
export const ATTACK_CAPE_MELEE_HIT_CHANCE = 0.02;
export const STRENGTH_CAPE_DISMEMBER_HEAL_BONUS = 0.02;
