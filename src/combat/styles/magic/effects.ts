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

export const CHANNELLED_MIGHT_SOURCE: SourceReference = BLOOMING_BURROW_WIKI_2026_03_30;
