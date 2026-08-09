import type { AbilitySpec } from "../../pipeline/calculateAbility";

export const WEN_ICY_CHILL_MAX_STACKS = 10;
export const WEN_ICY_CHILL_DURATION_TICKS = 50;
export const WEN_ICY_PRECISION_DURATION_TICKS = 15;
export const WEN_ICY_PRECISION_DAMAGE_MULTIPLIER = 1.3;
export const WEN_ICY_PRECISION_DAMAGE_POTENTIAL_DELTA = 0.3;

export interface WenArrowState {
  icyChillStacks: number;
  icyChillExpiresAtTick: number;
  icyPrecisionUntilTick: number;
}

export interface WenArrowCastSnapshot {
  damageActive: boolean;
  damagePotentialActive: boolean;
}

export interface PreparedWenArrowCast {
  snapshot: WenArrowCastSnapshot;
  nextState: WenArrowState | null;
}

export const newWenArrowState = (): WenArrowState => ({
  icyChillStacks: 0,
  icyChillExpiresAtTick: 0,
  icyPrecisionUntilTick: 0,
});

export function expireWenArrowState(state: WenArrowState, tick: number): WenArrowState {
  const chillExpired = state.icyChillExpiresAtTick > 0 && tick >= state.icyChillExpiresAtTick;
  const precisionExpired = state.icyPrecisionUntilTick > 0 && tick >= state.icyPrecisionUntilTick;
  if (!chillExpired && !precisionExpired) return state;
  return {
    icyChillStacks: chillExpired ? 0 : state.icyChillStacks,
    icyChillExpiresAtTick: chillExpired ? 0 : state.icyChillExpiresAtTick,
    icyPrecisionUntilTick: precisionExpired ? 0 : state.icyPrecisionUntilTick,
  };
}

export function wenIcyPrecisionActive(state: WenArrowState, tick: number): boolean {
  return tick < state.icyPrecisionUntilTick;
}

export function wenBasicHitEligible(ability: AbilitySpec): boolean {
  return ability.style === "ranged" && ability.category === "basic" && ability.hits.length > 0;
}

export function wenConsumerEligible(ability: AbilitySpec): boolean {
  return (
    ability.style === "ranged" &&
    ability.hits.length > 0 &&
    (ability.weaponSpecial === true ||
      ability.category === "enhanced" ||
      ability.category === "ultimate")
  );
}

export function recordWenBasicHit(state: WenArrowState, tick: number): WenArrowState {
  const current = expireWenArrowState(state, tick);
  return {
    ...current,
    icyChillStacks: Math.min(WEN_ICY_CHILL_MAX_STACKS, current.icyChillStacks + 1),
    icyChillExpiresAtTick: tick + WEN_ICY_CHILL_DURATION_TICKS,
  };
}

export function prepareWenArrowCast(
  state: WenArrowState,
  tick: number,
  ability: AbilitySpec,
): PreparedWenArrowCast {
  const current = expireWenArrowState(state, tick);
  const active = wenIcyPrecisionActive(current, tick);
  const consumes =
    !active && current.icyChillStacks >= WEN_ICY_CHILL_MAX_STACKS && wenConsumerEligible(ability);
  return {
    snapshot: {
      damageActive: active || consumes,
      damagePotentialActive: active || consumes,
    },
    nextState: consumes
      ? {
          icyChillStacks: 0,
          icyChillExpiresAtTick: 0,
          icyPrecisionUntilTick: tick + WEN_ICY_PRECISION_DURATION_TICKS,
        }
      : null,
  };
}
