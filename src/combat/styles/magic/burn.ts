import { MODERNISATION_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Burns are magic's damage-over-time identity. Combust: 10 hits of 27–33% every
 * 3 ticks, no movement requirement post-modernisation; Dragon Breath deals +25%
 * against combusted targets. Burn tails are crit-ineligible damage-over-time.
 */
export const COMBUST_HITS = 10;
export const COMBUST_INTERVAL_TICKS = 3;
export const COMBUST_BAND = { minPct: 27, maxPct: 33 } as const;
export const DRAGON_BREATH_COMBUST_BONUS_PCT = 25;

export interface BurnState {
  /** Burn id -> tick the last scheduled hit lands. Absent = not burning. */
  readonly active: Record<string, number>;
}

export const newBurns = (): BurnState => ({ active: {} });

export function combustDurationTicks(): number {
  return COMBUST_HITS * COMBUST_INTERVAL_TICKS;
}

export function applyBurn(
  state: BurnState,
  id: string,
  tick: number,
  durationTicks: number,
): BurnState {
  return { active: { ...state.active, [id]: tick + durationTicks } };
}

export function applyCombust(state: BurnState, tick: number): BurnState {
  return applyBurn(state, "combust", tick, combustDurationTicks());
}

export function burnActive(state: BurnState, id: string, tick: number): boolean {
  const until = state.active[id];
  return until !== undefined && tick < until;
}

/** Ticks with a scheduled Combust hit, relative to application (3, 6, …, 30). */
export function combustHitTicks(fromTick: number): number[] {
  return Array.from(
    { length: COMBUST_HITS },
    (_, i) => fromTick + (i + 1) * COMBUST_INTERVAL_TICKS,
  );
}

export const BURN_SOURCE: SourceReference = MODERNISATION_WIKI;

/** Rune consumption: any magic ability can consume runes, 15% per cast since 9 Mar (was 20%). */
export const RUNE_CONSUMPTION_CHANCE = 0.15;

export function rollRuneConsumption(roll: number): boolean {
  return roll < RUNE_CONSUMPTION_CHANCE;
}

export const RUNE_CONSUMPTION_SOURCE: SourceReference = MODERNISATION_WIKI;
