import { NECROSIS_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Conjures (unchanged by the modernisation): summoned spirits with Command
 * abilities. Phantom Guardian joined the original three 2 Sep 2024. Conjured
 * spirits cannot crit — an engine rule, not per-conjure data. Conjure durations
 * are not yet sourced, so the machine tracks presence, not timers.
 */
export const CONJURE_IDS = [
  "skeleton_warrior",
  "vengeful_ghost",
  "putrid_zombie",
  "phantom_guardian",
] as const;

export type ConjureId = (typeof CONJURE_IDS)[number];

export const CONJURES_CANNOT_CRIT = true;

export interface ConjureState {
  readonly active: readonly ConjureId[];
}

export const newConjures = (): ConjureState => ({ active: [] });

export function summonConjure(state: ConjureState, id: ConjureId): ConjureState {
  return state.active.includes(id) ? state : { active: [...state.active, id] };
}

export function dismissConjure(state: ConjureState, id: ConjureId): ConjureState {
  return { active: state.active.filter((c) => c !== id) };
}

export function conjureActive(state: ConjureState, id: ConjureId): boolean {
  return state.active.includes(id);
}

export const CONJURE_SOURCE: SourceReference = NECROSIS_WIKI;
