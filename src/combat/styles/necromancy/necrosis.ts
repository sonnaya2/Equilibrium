import { NECROSIS_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Necrosis (unchanged by the modernisation — changelog §5.10): max 12 stacks.
 * Touch of Death grants 4. Consumed by Finger of Death (−10% adrenaline cost
 * per stack, up to 6) and the Death Grasp special (+40% damage per stack,
 * consumes all).
 */
export const NECROSIS_CAP = 12;
export const TOUCH_OF_DEATH_NECROSIS = 4;
export const FINGER_OF_DEATH_MAX_STACKS = 6;
export const FINGER_OF_DEATH_COST_REDUCTION_PER_STACK_PCT = 10;
export const DEATH_GRASP_DAMAGE_PER_STACK_PCT = 40;

export interface NecrosisState {
  stacks: number;
}

export const newNecrosis = (): NecrosisState => ({ stacks: 0 });

export function gainNecrosis(state: NecrosisState, base: number): NecrosisState {
  return { stacks: Math.min(NECROSIS_CAP, state.stacks + base) };
}

export function fingerOfDeathDiscountPct(state: NecrosisState): number {
  return Math.min(state.stacks, FINGER_OF_DEATH_MAX_STACKS) * FINGER_OF_DEATH_COST_REDUCTION_PER_STACK_PCT;
}

/** Finger of Death spends exactly the stacks its discount used. */
export function consumeFingerOfDeath(state: NecrosisState): NecrosisState {
  return { stacks: Math.max(0, state.stacks - FINGER_OF_DEATH_MAX_STACKS) };
}

export function deathGraspBonusPct(state: NecrosisState): number {
  return state.stacks * DEATH_GRASP_DAMAGE_PER_STACK_PCT;
}

export function consumeAllNecrosis(): NecrosisState {
  return { stacks: 0 };
}

export const NECROSIS_SOURCE: SourceReference = NECROSIS_WIKI;
