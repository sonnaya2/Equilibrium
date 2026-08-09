import { secondsToTicks } from "../../core/ticks";

export const BOLT_DEATHMARK_DURATION_TICKS = secondsToTicks(15);
export const BOLT_DEATHMARK_BASIC_ADRENALINE_BONUS = 1;
export const BOLT_DEATHMARK_ACTIVATION_ADRENALINE = 10;

export interface BoltDeathmarkState {
  readonly expiresAtTick: number;
}

export const inactiveBoltDeathmark = (): BoltDeathmarkState => ({ expiresAtTick: 0 });

export function activateBoltDeathmark(tick: number): BoltDeathmarkState {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new RangeError(`bolt Deathmark tick must be a non-negative integer: ${tick}`);
  }
  return { expiresAtTick: tick + BOLT_DEATHMARK_DURATION_TICKS };
}

export function boltDeathmarkActive(state: BoltDeathmarkState, tick: number): boolean {
  return tick >= 0 && tick < state.expiresAtTick;
}

export function boltDeathmarkBasicAdrenalineBonus(state: BoltDeathmarkState, tick: number): number {
  return boltDeathmarkActive(state, tick) ? BOLT_DEATHMARK_BASIC_ADRENALINE_BONUS : 0;
}
