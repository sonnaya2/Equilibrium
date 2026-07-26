import { secondsToTicks } from "../../rotation/timeline";
import { MODERNISATION_WIKI } from "../../data/sources";
import { PLANTED_FEET_DURATION_MULT } from "../../shared/perks";
import type { SourceReference } from "../../types";

/**
 * Death's Swiftness: reworked 16 Mar 2026 (changelog §7) from a ground-targeted
 * area into a mobile self-buff — 1.5x ranged damage, 50 ticks base, 63 Greater.
 * The wiki ability pages pin one more fact: the damage buff begins 1 tick after
 * cast, so the window opens on cast+1, not on the cast tick.
 *
 * Planted Feet (base only): duration × PLANTED_FEET_DURATION_MULT → 63 ticks
 * (Math.round(50 × 1.25)); same [cast+1, cast+duration) shape as base. Greater:
 * no change. Planted Feet also removes periodic DoT hits in-game — not modelled.
 */
export const DEATHS_SWIFTNESS_MULTIPLIER = 1.5;
export const DEATHS_SWIFTNESS_DURATION_TICKS = 50;
export const GREATER_DEATHS_SWIFTNESS_DURATION_TICKS = 63;

export interface DeathsSwiftnessState {
  /** Buff applies to casts on ticks [startsAtTick, expiresAtTick); both 0 = inactive. */
  startsAtTick: number;
  expiresAtTick: number;
}

export const newDeathsSwiftness = (): DeathsSwiftnessState => ({ startsAtTick: 0, expiresAtTick: 0 });

/**
 * Activate Death's Swiftness.
 * `greater` selects Greater Death's Swiftness timings.
 * `plantedFeet` extends base only (wiki: 63 ticks); ignored for greater.
 */
export function activateDeathsSwiftness(
  tick: number,
  greater = false,
  plantedFeet = false,
): DeathsSwiftnessState {
  let duration = greater ? GREATER_DEATHS_SWIFTNESS_DURATION_TICKS : DEATHS_SWIFTNESS_DURATION_TICKS;
  if (!greater && plantedFeet) {
    duration = Math.round(DEATHS_SWIFTNESS_DURATION_TICKS * PLANTED_FEET_DURATION_MULT);
  }
  return { startsAtTick: tick + 1, expiresAtTick: tick + duration };
}

export function deathsSwiftnessActive(state: DeathsSwiftnessState, tick: number): boolean {
  return tick >= state.startsAtTick && tick < state.expiresAtTick;
}

export function deathsSwiftnessMultiplier(state: DeathsSwiftnessState, tick: number): number {
  return deathsSwiftnessActive(state, tick) ? DEATHS_SWIFTNESS_MULTIPLIER : 1;
}

export const DEATHS_SWIFTNESS_SOURCE: SourceReference = MODERNISATION_WIKI;
