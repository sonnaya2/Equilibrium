import { gainBloodlust, newBloodlust, type BloodlustState } from "../styles/melee/bloodlust";
import {
  newInstability,
  newSunshine,
  type InstabilityState,
  type SunshineState,
} from "../styles/magic/effects";
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
import { newNecroRotationState, type NecroRotationState } from "../styles/necromancy/effects";
import { newConjures, type ConjureState } from "../styles/necromancy/conjures";

export type { NecroRotationState, ConjureState };
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
  /**
   * Chaos Roar: next damaging melee ability is ×1.75 until this tick (0 = off).
   * Wiki window 7.2s (12 ticks) after the roar cast.
   */
  chaosRoarUntilTick: number;
  /**
   * Greater Fury: the next non-bleed melee attack used before this tick has its
   * first crit-eligible hit guaranteed crit; bleeds do not consume it.
   * Wiki window 15s (25 ticks) after the Greater Fury cast (0 = inactive).
   */
  greaterFuryUntilTick: number;
  /**
   * Fury: next crit-eligible melee hit gains +25% crit chance (consumed on use).
   * Wiki states no window — it persists until a non-bleed melee hit consumes it.
   */
  furyCritBonus: boolean;
  /**
   * Relentless perk lockout: after a proc the perk cannot activate again until
   * this tick (wiki: 30s internal cooldown; 0 = ready).
   */
  relentlessUntilTick: number;
  /**
   * Meteor Strike: melee basics generate 1.5x adren + 4.5% passive per tick
   * until this tick (0 = inactive). Wiki duration 30s (50 ticks).
   */
  meteorStrikeUntilTick: number;
  /**
   * Last-attack idle clock for Greater Barge (generic target / pure revo).
   * Tick of the previous melee damaging cast; -1 = none yet.
   * Idle = readyTick - lastMeleeCastTick when last >= 0. Off-target movement
   * (Surge / Escape / Bladed Dive) is unmodelled.
   */
  lastMeleeCastTick: number;
  /**
   * Endless Assault window end tick (0 = inactive). Set when Greater Barge is
   * cast after >= 8 idle ticks; next channelled melee inside the window consumes it.
   */
  endlessAssaultUntilTick: number;
  /** Sunshine / Greater Sunshine zone buff window (starts 1 tick after cast). */
  sunshine: SunshineState;
  /** Instability (FSOA): Lightning Surge on Magic crit while active. */
  instability: InstabilityState;
  ranged: RangedRotationState;
  magic: RunicChargeState;
  /**
   * Necromancy: residual souls, necrosis stacks, Living Death window.
   * Mutate only via styles/necromancy/effects (applyNecroOnCast / patchNecro).
   */
  necro: NecroRotationState;
  /**
   * Active conjured spirits (timers + skeleton rage). Mutate via conjures.ts
   * helpers and applyNecroOnCast summon hooks.
   */
  conjures: ConjureState;
}

export function newRotationState(opts: { lantern?: boolean } = {}): RotationState {
  return {
    tick: 0,
    adrenaline: 0,
    cooldowns: {},
    melee: newBloodlust(),
    berserkUntilTick: 0,
    chaosRoarUntilTick: 0,
    greaterFuryUntilTick: 0,
    furyCritBonus: false,
    relentlessUntilTick: 0,
    meteorStrikeUntilTick: 0,
    lastMeleeCastTick: -1,
    endlessAssaultUntilTick: 0,
    sunshine: newSunshine(),
    instability: newInstability(),
    ranged: {
      swiftness: newDeathsSwiftness(),
      searingWinds: newSearingWinds(),
      shadowImbued: newShadowImbued(),
      deathspore: newDeathspore(),
    },
    magic: newRunicCharge(),
    necro: newNecroRotationState({ lantern: opts.lantern }),
    conjures: newConjures(),
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

/** Necro fields only — prefer applyNecroOnCast for cast transitions. */
export function patchNecro(
  state: RotationState,
  patch: Partial<NecroRotationState>,
): RotationState {
  return { ...state, necro: { ...state.necro, ...patch } };
}

export function patchConjures(state: RotationState, conjures: ConjureState): RotationState {
  return { ...state, conjures };
}

export function clearCooldowns(state: RotationState, ids: readonly string[]): RotationState {
  if (ids.length === 0) return state;
  const cooldowns = { ...state.cooldowns };
  for (const id of ids) delete cooldowns[id];
  return { ...state, cooldowns };
}
