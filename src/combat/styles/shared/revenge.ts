import { mulFloor } from "../../core/rounding";
import type { CombatModifier, SourceReference } from "../../types";

export const REVENGE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Revenge",
  title: "Revenge",
  verifiedAt: "2026-08-19",
};

export const REVENGE_BASE_DURATION_TICKS = 32;
export const REVENGE_BASE_MAXIMUM_STACKS = 10;
export const REVENGE_SHIELD_DAMAGE_PER_STACK = 0.05;
export const REVENGE_DEFENDER_DAMAGE_PER_STACK = 0.025;

export interface RevengeState {
  stacks: number;
  maximumStacks: number;
  untilTick: number;
  incomingHitIntervalTicks: number;
  nextIncomingHitTick: number;
  damagePerStack: number;
}

export function inactiveRevengeState(): RevengeState {
  return {
    stacks: 0,
    maximumStacks: REVENGE_BASE_MAXIMUM_STACKS,
    untilTick: 0,
    incomingHitIntervalTicks: 0,
    nextIncomingHitTick: 0,
    damagePerStack: REVENGE_SHIELD_DAMAGE_PER_STACK,
  };
}

export function activateRevenge(opts: {
  atTick: number;
  durationTicks: number;
  maximumStacks: number;
  incomingHitIntervalTicks: number;
  defender: boolean;
}): RevengeState {
  const interval = Math.max(0, Math.floor(opts.incomingHitIntervalTicks));
  return {
    stacks: 0,
    maximumStacks: Math.max(1, Math.floor(opts.maximumStacks)),
    untilTick: opts.atTick + Math.max(1, Math.floor(opts.durationTicks)),
    incomingHitIntervalTicks: interval,
    nextIncomingHitTick: interval > 0 ? opts.atTick + interval - 1 : 0,
    damagePerStack: opts.defender
      ? REVENGE_DEFENDER_DAMAGE_PER_STACK
      : REVENGE_SHIELD_DAMAGE_PER_STACK,
  };
}

export function nextRevengeIncomingHitTick(state: RevengeState): number | null {
  if (
    state.incomingHitIntervalTicks <= 0 ||
    state.nextIncomingHitTick >= state.untilTick ||
    state.stacks >= state.maximumStacks
  ) {
    return null;
  }
  return state.nextIncomingHitTick;
}

export function applyRevengeIncomingHit(state: RevengeState, atTick: number): RevengeState {
  if (nextRevengeIncomingHitTick(state) !== atTick) return state;
  const stacks = Math.min(state.maximumStacks, state.stacks + 1);
  return {
    ...state,
    stacks,
    nextIncomingHitTick:
      stacks >= state.maximumStacks
        ? 0
        : state.nextIncomingHitTick + state.incomingHitIntervalTicks,
  };
}

export function normalizeRevengeState(state: RevengeState, atTick: number): RevengeState {
  return state.untilTick > 0 && atTick >= state.untilTick ? inactiveRevengeState() : state;
}

export function revengeDamageMultiplier(state: RevengeState, atTick: number): number {
  if (state.stacks <= 0 || state.untilTick <= 0 || atTick >= state.untilTick) return 1;
  return 1 + state.stacks * state.damagePerStack;
}

export function revengeDamageModifier(state: RevengeState, atTick: number): CombatModifier | null {
  const multiplier = revengeDamageMultiplier(state, atTick);
  if (multiplier === 1) return null;
  return {
    id: "buff:revenge",
    stage: "postHit",
    priority: 900,
    appliesToPlayerPoison: true,
    applies: () => true,
    apply: (damage) => ({ ...damage, damage: mulFloor(damage.damage, multiplier) }),
    source: REVENGE_SOURCE,
  };
}
