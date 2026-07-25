import { secondsToTicks } from "../../rotation/timeline";
import { MODERNISATION_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Splintering arrows: ranged abilities apply Puncture — each stack contributes 1%
 * ability damage, up to 250, on a 30-second duration model (modernisation-2026
 * corpus, wiki-confirmed). The corpus does not pin how the bonus applies to a hit,
 * so the machine tracks stacks and duration and exposes the contribution as data;
 * damage integration waits on confirmed wording.
 */
export const PUNCTURE_CAP = 250;
export const PUNCTURE_DURATION_SECONDS = 30;
export const PUNCTURE_ABILITY_DAMAGE_PER_STACK_PCT = 1;

export interface PunctureState {
  stacks: number;
  /** Tick the current window expires on; expired stacks drop to zero. */
  expiresAtTick: number;
}

export const newPuncture = (): PunctureState => ({ stacks: 0, expiresAtTick: 0 });

export function activePuncture(state: PunctureState, tick: number): PunctureState {
  return tick < state.expiresAtTick ? state : { stacks: 0, expiresAtTick: 0 };
}

/** ponytail: applying a stack refreshes the 30s window (standard RS3 duration
 *  behaviour); the corpus confirms the duration but not the refresh rule.
 *  Upgrade trigger: wiki-confirmed expiry semantics. */
export function applyPuncture(state: PunctureState, tick: number, stacks = 1): PunctureState {
  const current = activePuncture(state, tick);
  return {
    stacks: Math.min(PUNCTURE_CAP, current.stacks + stacks),
    expiresAtTick: tick + secondsToTicks(PUNCTURE_DURATION_SECONDS),
  };
}

/** Bonus ability-damage percent from active stacks — data, not an applied modifier. */
export function punctureBonusPct(state: PunctureState, tick: number): number {
  return activePuncture(state, tick).stacks * PUNCTURE_ABILITY_DAMAGE_PER_STACK_PCT;
}

export const PUNCTURE_SOURCE: SourceReference = MODERNISATION_WIKI;

/**
 * Deathspore arrows: stacks build per hit under the redesign (the old rule built
 * on critical strikes); at 12 they enable a free ability.
 */
export const DEATHSPORE_FREE_ABILITY_STACKS = 12;

export interface DeathsporeState {
  stacks: number;
}

export const newDeathspore = (): DeathsporeState => ({ stacks: 0 });

export function onRangedHit(state: DeathsporeState, hits = 1): DeathsporeState {
  return { stacks: Math.min(DEATHSPORE_FREE_ABILITY_STACKS, state.stacks + hits) };
}

export function deathsporeReady(state: DeathsporeState): boolean {
  return state.stacks >= DEATHSPORE_FREE_ABILITY_STACKS;
}

/** The free cast consumes the ready counter. */
export function spendDeathspore(state: DeathsporeState): DeathsporeState {
  return deathsporeReady(state) ? { stacks: 0 } : state;
}

export const DEATHSPORE_SOURCE: SourceReference = MODERNISATION_WIKI;

/**
 * Searing Winds (from Galeshot, changelog §5.9): 10-tick window in which every
 * ranged hit deals a bonus +20% ability-damage hit. Rapid Fire extends the
 * window by 1 tick per hit.
 */
export const SEARING_WINDS_DURATION_TICKS = 10;
export const SEARING_WINDS_BONUS_HIT_PCT = 20;
export const RAPID_FIRE_SEARING_WINDS_TICKS_PER_HIT = 1;

export interface SearingWindsState {
  expiresAtTick: number;
}

export const newSearingWinds = (): SearingWindsState => ({ expiresAtTick: 0 });

export function activateSearingWinds(tick: number): SearingWindsState {
  return { expiresAtTick: tick + SEARING_WINDS_DURATION_TICKS };
}

export function extendSearingWinds(state: SearingWindsState, hits: number): SearingWindsState {
  return { expiresAtTick: state.expiresAtTick + hits * RAPID_FIRE_SEARING_WINDS_TICKS_PER_HIT };
}

/** Bonus-hit percent while the window is open; 0 outside it. */
export function searingWindsBonusPct(state: SearingWindsState, tick: number): number {
  return tick < state.expiresAtTick ? SEARING_WINDS_BONUS_HIT_PCT : 0;
}

/**
 * Shadow Imbued (from Imbue: Shadows, §5.9): 50-tick window in which ranged hits
 * on your target generate +5% adrenaline per hit. Shadow Tendrils extends it by
 * 6 ticks.
 */
export const SHADOW_IMBUED_DURATION_TICKS = 50;
export const SHADOW_IMBUED_ADRENALINE_PER_HIT_PCT = 5;
export const SHADOW_TENDRILS_IMBUED_EXTENSION_TICKS = 6;

export interface ShadowImbuedState {
  expiresAtTick: number;
}

export const newShadowImbued = (): ShadowImbuedState => ({ expiresAtTick: 0 });

export function activateShadowImbued(tick: number): ShadowImbuedState {
  return { expiresAtTick: tick + SHADOW_IMBUED_DURATION_TICKS };
}

/** Tendrils extends an active window only — never creates one. */
export function extendShadowImbued(state: ShadowImbuedState, tick: number): ShadowImbuedState {
  if (tick >= state.expiresAtTick) return state;
  return { expiresAtTick: state.expiresAtTick + SHADOW_TENDRILS_IMBUED_EXTENSION_TICKS };
}

/** Adrenaline percent granted per ranged hit while imbued; 0 outside the window. */
export function shadowImbuedAdrenalinePerHit(state: ShadowImbuedState, tick: number): number {
  return tick < state.expiresAtTick ? SHADOW_IMBUED_ADRENALINE_PER_HIT_PCT : 0;
}

export const SEARING_WINDS_SOURCE: SourceReference = MODERNISATION_WIKI;
export const SHADOW_IMBUED_SOURCE: SourceReference = MODERNISATION_WIKI;
