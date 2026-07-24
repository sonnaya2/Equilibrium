import { gainBloodlust, newBloodlust, type BloodlustState } from "../styles/melee/bloodlust";
import {
  newDeathspore,
  newSearingWinds,
  newShadowImbued,
  type DeathsporeState,
  type SearingWindsState,
  type ShadowImbuedState,
} from "../styles/ranged/onHit";
import { newDeathsSwiftness, type DeathsSwiftnessState } from "../styles/ranged/effects";
import { newRunicCharge, type RunicChargeState } from "../styles/magic/runicCharge";

export const ADRENALINE_CAP = 100;

export interface RangedRotationState {
  swiftness: DeathsSwiftnessState;
  searingWinds: SearingWindsState;
  shadowImbued: ShadowImbuedState;
  deathspore: DeathsporeState;
}

export interface RotationState {
  /** Next tick free for a cast — the global cooldown is encoded here. */
  tick: number;
  adrenaline: number;
  /** Ability id -> first tick it can be cast again. Absent = no individual cooldown. */
  cooldowns: Record<string, number>;
  melee: BloodlustState;
  /** Tick Berserk's damage window closes; 0 = inactive. */
  berserkUntilTick: number;
  ranged: RangedRotationState;
  magic: RunicChargeState;
}

export function newRotationState(): RotationState {
  return {
    tick: 0,
    adrenaline: 0,
    cooldowns: {},
    melee: newBloodlust(),
    berserkUntilTick: 0,
    ranged: {
      swiftness: newDeathsSwiftness(),
      searingWinds: newSearingWinds(),
      shadowImbued: newShadowImbued(),
      deathspore: newDeathspore(),
    },
    magic: newRunicCharge(),
  };
}

export function gainAdrenaline(state: RotationState, amount: number): RotationState {
  return { ...state, adrenaline: Math.min(ADRENALINE_CAP, state.adrenaline + amount) };
}

export function spendAdrenaline(state: RotationState, amount: number): RotationState {
  return { ...state, adrenaline: Math.max(0, state.adrenaline - amount) };
}

/** GCD-free tick and any per-ability cooldown combined. */
export function firstLegalTick(state: RotationState, abilityId: string): number {
  return Math.max(state.tick, state.cooldowns[abilityId] ?? 0);
}

export function startCooldown(
  state: RotationState,
  abilityId: string,
  ticks: number,
): RotationState {
  return { ...state, cooldowns: { ...state.cooldowns, [abilityId]: state.tick + ticks } };
}

export function gainMeleeBloodlust(state: RotationState, base: number): RotationState {
  return { ...state, melee: gainBloodlust(state.melee, base) };
}

export function patchRanged(
  state: RotationState,
  patch: Partial<RangedRotationState>,
): RotationState {
  return { ...state, ranged: { ...state.ranged, ...patch } };
}
