import type { SourceReference } from "../../types";

/**
 * Haunted (Command Vengeful Ghost). Wiki effective duration 3.6s = 6 ticks
 * (tooltip 4.8 is wrong). Bonus up to 10% of the source hit, capped at 20% of
 * commanding player Necromancy ability damage. Extra damage ignores accuracy.
 * https://runescape.wiki/w/Command_Vengeful_Ghost (verified 2026-08-04).
 */
export const HAUNTED_DURATION_TICKS = 6;
export const HAUNTED_BONUS_PCT = 10;
export const HAUNTED_CAP_PCT_OF_AD = 20;

export interface HauntedState {
  /** Exclusive end tick; active while tick < untilTick. 0 = inactive. */
  readonly untilTick: number;
  /** Commanding player's ability damage used for the 20% cap. */
  readonly capAbilityDamage: number;
}

export const newHaunted = (): HauntedState => ({ untilTick: 0, capAbilityDamage: 0 });

export function hauntedActive(state: HauntedState, tick: number): boolean {
  return state.untilTick > 0 && tick < state.untilTick;
}

/** Apply or refresh Haunted from an empowered ghost auto at landTick. */
export function applyHaunted(
  landTick: number,
  capAbilityDamage: number,
): HauntedState {
  return {
    untilTick: landTick + HAUNTED_DURATION_TICKS,
    capAbilityDamage: Math.max(0, capAbilityDamage),
  };
}

/**
 * Attached Haunted bonus for one parent hit component (min/max/expected).
 * floor(parent * 10%) then min with floor(capAD * 20%). Parent is post-resolve.
 */
export function hauntedBonusDamage(
  parentDamage: number,
  capAbilityDamage: number,
): number {
  if (parentDamage <= 0 || capAbilityDamage <= 0) return 0;
  const pct = Math.floor((parentDamage * HAUNTED_BONUS_PCT) / 100);
  const cap = Math.floor((capAbilityDamage * HAUNTED_CAP_PCT_OF_AD) / 100);
  return Math.min(pct, cap);
}

export const HAUNTED_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Command_Vengeful_Ghost",
  title: "Command Vengeful Ghost",
  verifiedAt: "2026-08-04",
};
