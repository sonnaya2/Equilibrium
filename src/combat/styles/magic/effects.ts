import { secondsToTicks } from "../../rotation/timeline";
import { BLOOMING_BURROW_WIKI_2026_03_30 } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Channelled Might (30 Mar 2026): completing a full Asphyxiate channel grants
 * +15% magic critical strike damage for 3.6s. With 5 pieces of Tumeken's
 * resplendence it lasts 9s at +35% — the set bonus is data, not modelled state.
 */
export const CHANNELLED_MIGHT_DURATION_SECONDS = 3.6;
export const CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS = 0.15;
export const TUMEKENS_CHANNELLED_MIGHT = { durationSeconds: 9, critDamageBonus: 0.35 } as const;

export interface ChannelledMightState {
  /** Tick the buff expires on; 0 = inactive. */
  expiresAtTick: number;
  critDamageBonus: number;
}

export const newChannelledMight = (): ChannelledMightState => ({
  expiresAtTick: 0,
  critDamageBonus: CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS,
});

export function grantChannelledMight(
  tick: number,
  tumekensFivePiece = false,
): ChannelledMightState {
  const duration = tumekensFivePiece
    ? TUMEKENS_CHANNELLED_MIGHT.durationSeconds
    : CHANNELLED_MIGHT_DURATION_SECONDS;
  return {
    expiresAtTick: tick + secondsToTicks(duration),
    critDamageBonus: tumekensFivePiece
      ? TUMEKENS_CHANNELLED_MIGHT.critDamageBonus
      : CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS,
  };
}

/** Extra crit damage while active; 0 outside the window. Feeds the crit damageBonus layer. */
export function channelledMightCritBonus(state: ChannelledMightState, tick: number): number {
  return tick < state.expiresAtTick ? state.critDamageBonus : 0;
}

/** Greater Sunshine (wiki, June 2026): +50% magic damage, buff begins 1 tick after
 *  cast and lasts 64 ticks (38.4s) inside the 65-tick ability duration. Base
 *  Sunshine (50 ticks) is not yet modelled — only the greater bar variant. */
export const SUNSHINE_DAMAGE_MULTIPLIER = 1.5;
export const GREATER_SUNSHINE_BUFF_TICKS = 64;

export interface SunshineState {
  startsAtTick: number;
  expiresAtTick: number;
}

export const newSunshine = (): SunshineState => ({ startsAtTick: 0, expiresAtTick: 0 });

export function activateGreaterSunshine(tick: number): SunshineState {
  return { startsAtTick: tick + 1, expiresAtTick: tick + 1 + GREATER_SUNSHINE_BUFF_TICKS };
}

export function sunshineActive(state: SunshineState, tick: number): boolean {
  return tick >= state.startsAtTick && tick < state.expiresAtTick;
}

export const SUNSHINE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Greater_Sunshine",
  title: "Greater Sunshine",
  verifiedAt: "2026-07-25",
};

export const CHANNELLED_MIGHT_SOURCE: SourceReference = BLOOMING_BURROW_WIKI_2026_03_30;
