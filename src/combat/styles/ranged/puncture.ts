import { percentFloor } from "../../core/rounding";
import { secondsToTicks } from "../../core/ticks";
import { MODERNISATION_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Splintering arrows / Punctured (post-2 Mar 2026).
 * https://runescape.wiki/w/Punctured
 * https://runescape.wiki/w/Splintering_arrows
 *
 * Eligible landed Ranged hits apply stacks (cap 250). Each under-cap stack
 * stores floor(1% of current ability damage). Damage is a 5-hit sequence of
 * fixed percents of the cumulative stored amount (percentFloor each splat);
 * stacks are not consumed. Tiny stored can yield 0 on the last hit(s).
 * Reapplication refreshes duration and restarts the sequence via generation.
 * Stored damage is snapshotted per stack add - future buffs never rewrite it.
 */
export const PUNCTURE_CAP = 250;
export const PUNCTURE_DURATION_SECONDS = 30;
export const PUNCTURE_DURATION_TICKS = secondsToTicks(PUNCTURE_DURATION_SECONDS);
export const PUNCTURE_STORE_PCT = 1;
/** Hit percents of snapshotted stored damage: 50+20+15+10+5 = 100. */
export const PUNCTURE_HIT_PERCENTS = [50, 20, 15, 10, 5] as const;
/** First damage lands 1 tick after the applying ability finishes. */
export const PUNCTURE_FIRST_OFFSET_AFTER_FINISH = 1;
/** Subsequent hits every 3 ticks after the first. */
export const PUNCTURE_HIT_INTERVAL_TICKS = 3;

export interface PunctureState {
  stacks: number;
  expiresAtTick: number;
  /** Cumulative stored ability damage (integer). */
  storedDamage: number;
  /**
   * Monotonic generation. Scheduled events close over the gen at schedule
   * time; resolve is a no-op when state.generation differs (refresh / branch).
   */
  generation: number;
  /**
   * Cast seq that must complete before (re)scheduling the sequence.
   * -1 = no pending finish wait (schedule from land immediately).
   */
  pendingOwnerCast: number;
  /**
   * Highest castSeq that has already finished occupancy.
   * Lands with sourceCast <= this are post-finish; schedule from land tick
   * instead of waiting for a completion that will never re-fire.
   */
  lastCompletedCastSeq: number;
}

export const newPuncture = (): PunctureState => ({
  stacks: 0,
  expiresAtTick: 0,
  storedDamage: 0,
  generation: 0,
  pendingOwnerCast: -1,
  lastCompletedCastSeq: -1,
});

export function activePuncture(state: PunctureState, tick: number): PunctureState {
  return tick < state.expiresAtTick
    ? state
    : {
        stacks: 0,
        expiresAtTick: 0,
        storedDamage: 0,
        generation: state.generation,
        pendingOwnerCast: -1,
        lastCompletedCastSeq: state.lastCompletedCastSeq,
      };
}

/** Ability damage stored by one under-cap stack application. */
export function punctureStoreAmount(abilityDamage: number): number {
  if (!Number.isFinite(abilityDamage) || abilityDamage < 0) return 0;
  return percentFloor(abilityDamage, PUNCTURE_STORE_PCT);
}

/**
 * Apply one Punctured stack from an eligible landed hit.
 * At cap: refresh duration + generation only (no extra stored damage).
 * `ownerCast` is the cast that will schedule the sequence on completion; use -1
 * when the cast has already finished so the caller schedules immediately.
 */
export function applyPunctureStack(
  state: PunctureState,
  tick: number,
  abilityDamage: number,
  ownerCast: number,
): PunctureState {
  const current = activePuncture(state, tick);
  const atCap = current.stacks >= PUNCTURE_CAP;
  const add = atCap ? 0 : punctureStoreAmount(abilityDamage);
  return {
    stacks: Math.min(PUNCTURE_CAP, current.stacks + 1),
    expiresAtTick: tick + PUNCTURE_DURATION_TICKS,
    storedDamage: current.storedDamage + add,
    generation: current.generation + 1,
    pendingOwnerCast: ownerCast,
    lastCompletedCastSeq: current.lastCompletedCastSeq,
  };
}

/** Fixed damage for one sequence hit: percentFloor(stored, percent). May be 0. */
export function punctureHitDamage(storedDamage: number, percent: number): number {
  if (storedDamage <= 0 || percent <= 0) return 0;
  return percentFloor(storedDamage, percent);
}

/** Land ticks for a sequence starting at firstTick (finish+1). */
export function punctureSequenceTicks(firstTick: number): readonly number[] {
  return PUNCTURE_HIT_PERCENTS.map((_, i) => firstTick + i * PUNCTURE_HIT_INTERVAL_TICKS);
}

export const PUNCTURE_SOURCE: SourceReference = MODERNISATION_WIKI;
export const PUNCTURE_ABILITY_ID = "puncture";
