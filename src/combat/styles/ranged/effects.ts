import { secondsToTicks } from "../../rotation/timeline";
import { MODERNISATION_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Death's Swiftness: modernised from a ground-targeted area into a self buff —
 * 1.5x damage for 30s, 37.8s for Greater.
 */
export const DEATHS_SWIFTNESS_MULTIPLIER = 1.5;
export const DEATHS_SWIFTNESS_DURATION_SECONDS = 30;
export const GREATER_DEATHS_SWIFTNESS_DURATION_SECONDS = 37.8;

export interface DeathsSwiftnessState {
  /** Tick the buff expires on; 0 = inactive. */
  expiresAtTick: number;
}

export const newDeathsSwiftness = (): DeathsSwiftnessState => ({ expiresAtTick: 0 });

export function activateDeathsSwiftness(tick: number, greater = false): DeathsSwiftnessState {
  const seconds = greater
    ? GREATER_DEATHS_SWIFTNESS_DURATION_SECONDS
    : DEATHS_SWIFTNESS_DURATION_SECONDS;
  return { expiresAtTick: tick + secondsToTicks(seconds) };
}

export function deathsSwiftnessActive(state: DeathsSwiftnessState, tick: number): boolean {
  return tick < state.expiresAtTick;
}

export function deathsSwiftnessMultiplier(state: DeathsSwiftnessState, tick: number): number {
  return deathsSwiftnessActive(state, tick) ? DEATHS_SWIFTNESS_MULTIPLIER : 1;
}

export const DEATHS_SWIFTNESS_SOURCE: SourceReference = MODERNISATION_WIKI;
