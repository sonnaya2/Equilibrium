import { MODERNISATION_WIKI } from "../../data/sources";
import { PLANTED_FEET_DURATION_MULT } from "../../shared/perks";
import type { SourceReference } from "../../types";
import {
  newDeathspore,
  newSearingWinds,
  newShadowImbued,
  type DeathsporeState,
  type SearingWindsState,
  type ShadowImbuedState,
} from "./onHit";
import { newPuncture, type PunctureState } from "./puncture";
import { inactiveDracolichInfusion, type DracolichInfusionState } from "./dracolich";

/**
 * Death's Swiftness became a mobile self-buff on 16 Mar 2026: 1.5x ranged
 * damage for 50 active ticks (base) or 63 (Greater). Buff begins one tick
 * after cast (half-open [cast+1, cast+1+duration)).
 *
 * Planted Feet (base only): duration × PLANTED_FEET_DURATION_MULT → 63 active
 * ticks. Greater: no change. Periodic DoT removal from Planted Feet is outside
 * this model.
 */
export const DEATHS_SWIFTNESS_MULTIPLIER = 1.5;
export const DEATHS_SWIFTNESS_DURATION_TICKS = 50;
export const GREATER_DEATHS_SWIFTNESS_DURATION_TICKS = 63;

export const BALANCE_BY_FORCE_DURATION_TICKS = 50;

export interface BalanceByForceState {
  startsAtTick: number;
  expiresAtTick: number;
}

export const newBalanceByForce = (): BalanceByForceState => ({
  startsAtTick: 0,
  expiresAtTick: 0,
});

export function activateBalanceByForce(tick: number): BalanceByForceState {
  return {
    startsAtTick: tick,
    expiresAtTick: tick + BALANCE_BY_FORCE_DURATION_TICKS,
  };
}

export function balanceByForceActive(state: BalanceByForceState, tick: number): boolean {
  return tick >= state.startsAtTick && tick < state.expiresAtTick;
}

export interface DeathsSwiftnessState {
  /** Buff applies to casts on ticks [startsAtTick, expiresAtTick); both 0 = inactive. */
  startsAtTick: number;
  expiresAtTick: number;
}

export const newDeathsSwiftness = (): DeathsSwiftnessState => ({
  startsAtTick: 0,
  expiresAtTick: 0,
});

/**
 * Activate Death's Swiftness.
 * `greater` selects Greater Death's Swiftness timings.
 * `plantedFeet` extends base only (wiki: 63 active ticks); ignored for greater.
 * Expire is always starts + duration (half-open), never cast + duration alone.
 */
export function activateDeathsSwiftness(
  tick: number,
  greater = false,
  plantedFeet = false,
): DeathsSwiftnessState {
  let duration = greater
    ? GREATER_DEATHS_SWIFTNESS_DURATION_TICKS
    : DEATHS_SWIFTNESS_DURATION_TICKS;
  if (!greater && plantedFeet) {
    duration = Math.round(DEATHS_SWIFTNESS_DURATION_TICKS * PLANTED_FEET_DURATION_MULT);
  }
  return { startsAtTick: tick + 1, expiresAtTick: tick + 1 + duration };
}

export function deathsSwiftnessActive(state: DeathsSwiftnessState, tick: number): boolean {
  return tick >= state.startsAtTick && tick < state.expiresAtTick;
}

export function deathsSwiftnessMultiplier(state: DeathsSwiftnessState, tick: number): number {
  return deathsSwiftnessActive(state, tick) ? DEATHS_SWIFTNESS_MULTIPLIER : 1;
}

export const DEATHS_SWIFTNESS_SOURCE: SourceReference = MODERNISATION_WIKI;

/** Every mutable ranged state the simulation carries between casts. */
export interface RangedRotationState {
  swiftness: DeathsSwiftnessState;
  balanceByForce: BalanceByForceState;
  perfectEquilibriumStacks: number;
  searingWinds: SearingWindsState;
  shadowImbued: ShadowImbuedState;
  deathspore: DeathsporeState;
  puncture: PunctureState;
  dracolichInfusion: DracolichInfusionState;
}

export const newRangedRotationState = (): RangedRotationState => ({
  swiftness: newDeathsSwiftness(),
  balanceByForce: newBalanceByForce(),
  perfectEquilibriumStacks: 0,
  searingWinds: newSearingWinds(),
  shadowImbued: newShadowImbued(),
  deathspore: newDeathspore(),
  puncture: newPuncture(),
  dracolichInfusion: inactiveDracolichInfusion(),
});
