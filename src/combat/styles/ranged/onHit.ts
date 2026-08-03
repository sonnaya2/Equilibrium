import { secondsToTicks } from "../../core/ticks";
import { MODERNISATION_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Splintering arrows / Puncture: +1% ability damage per stack, cap 250, 30s
 * (modernisation-2026, wiki). Stacks tracked as data; damage integration pending confirmed wording.
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

export function applyPuncture(state: PunctureState, tick: number, stacks = 1): PunctureState {
  const current = activePuncture(state, tick);
  return {
    stacks: Math.min(PUNCTURE_CAP, current.stacks + stacks),
    expiresAtTick: tick + secondsToTicks(PUNCTURE_DURATION_SECONDS),
  };
}

/** Bonus ability-damage percent from active stacks - data, not an applied modifier. */
export function punctureBonusPct(state: PunctureState, tick: number): number {
  return activePuncture(state, tick).stacks * PUNCTURE_ABILITY_DAMAGE_PER_STACK_PCT;
}

export const PUNCTURE_SOURCE: SourceReference = MODERNISATION_WIKI;

/**
 * Deathspore arrows (post-2 Mar 2026): landed Ranged hit -> Feasting Spores stack;
 * at 12: consume for 9s (15 tick) free-cast + 30s (50 tick) CD starting with buff
 * (no stacks during CD). Free cast zeroes adrenaline spend, not the requirement.
 * https://runescape.wiki/w/Deathspore_arrows (verified 2026-07-31).
 */
export const DEATHSPORE_FREE_ABILITY_STACKS = 12;
export const DEATHSPORE_FREE_CAST_WINDOW_TICKS = 15;
export const DEATHSPORE_COOLDOWN_TICKS = 50;

export interface DeathsporeState {
  stacks: number;
  /** Free-cast buff expiry; active while tick < freeCastUntilTick (0 = inactive). */
  freeCastUntilTick: number;
  /** Stack-generation lockout; active while tick < cooldownUntilTick (0 = inactive). */
  cooldownUntilTick: number;
}

export const newDeathspore = (): DeathsporeState => ({
  stacks: 0,
  freeCastUntilTick: 0,
  cooldownUntilTick: 0,
});

/** Landed ranged hit: no stacks during CD; 12th opens free-cast + starts shared CD. */
export function onRangedHit(state: DeathsporeState, tick: number): DeathsporeState {
  if (tick < state.cooldownUntilTick) return state;
  const stacks = state.stacks + 1;
  if (stacks < DEATHSPORE_FREE_ABILITY_STACKS) return { ...state, stacks };
  return {
    stacks: 0,
    freeCastUntilTick: tick + DEATHSPORE_FREE_CAST_WINDOW_TICKS,
    cooldownUntilTick: tick + DEATHSPORE_COOLDOWN_TICKS,
  };
}

/** Free-cast buff active at `tick` (half-open window). */
export function deathsporeFreeCastActive(state: DeathsporeState, tick: number): boolean {
  return tick < state.freeCastUntilTick;
}

/** A free cast consumes the buff; the cooldown keeps running either way. */
export function spendDeathspore(state: DeathsporeState, tick: number): DeathsporeState {
  return deathsporeFreeCastActive(state, tick) ? { ...state, freeCastUntilTick: 0 } : state;
}

export const DEATHSPORE_SOURCE: SourceReference = MODERNISATION_WIKI;

/**
 * Searing Winds: 10 ticks (6s), +20% ability damage as attached bonus per ranged
 * ability hit; +1 tick per Rapid Fire hit. Eligibility AT CAST (wiki: "calculated on cast").
 * https://runescape.wiki/w/Searing_Winds (verified 2026-07-31).
 */
export const SEARING_WINDS_DURATION_TICKS = 10;
export const SEARING_WINDS_BONUS_HIT_PCT = 20;
export const RAPID_FIRE_SEARING_WINDS_TICKS_PER_HIT = 1;

export interface SearingWindsState {
  expiresAtTick: number;
  /** Cast seq that applied the buff; that cast's own hits never take the attached bonus. */
  grantedByCast?: number;
}

export const newSearingWinds = (): SearingWindsState => ({ expiresAtTick: 0 });

export function activateSearingWinds(tick: number, grantedByCast?: number): SearingWindsState {
  return {
    expiresAtTick: tick + SEARING_WINDS_DURATION_TICKS,
    ...(grantedByCast !== undefined ? { grantedByCast } : {}),
  };
}

export function extendSearingWinds(state: SearingWindsState, hits: number): SearingWindsState {
  return {
    ...state,
    expiresAtTick: state.expiresAtTick + hits * RAPID_FIRE_SEARING_WINDS_TICKS_PER_HIT,
  };
}

/** Bonus-hit percent while the window is open; 0 outside it. */
export function searingWindsBonusPct(state: SearingWindsState, tick: number): number {
  return tick < state.expiresAtTick ? SEARING_WINDS_BONUS_HIT_PCT : 0;
}

/**
 * Shadow Imbued lasts 50 ticks and grants 5% adrenaline per ranged hit.
 * Shadow Tendrils extends the active window by 6 ticks.
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
