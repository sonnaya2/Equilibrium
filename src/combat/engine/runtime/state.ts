import { gainBloodlust } from "../../styles/melee/bloodlust";
import {
  newMeleeRotationState,
  newMeleeTargetEffects,
  type MeleeRotationState,
  type MeleeTargetEffects,
} from "../../styles/melee/effects";
import { newMagicRotationState, type MagicRotationState } from "../../styles/magic/effects";
import { newBurns, type BurnState } from "../../styles/magic/burn";
import { newRangedRotationState, type RangedRotationState } from "../../styles/ranged/effects";
import {
  newNecromancyRotationState,
  type NecroRotationState,
  type NecromancyRotationState,
} from "../../styles/necromancy/effects";
import type { ConjureState } from "../../styles/necromancy/conjures";

export type { MeleeRotationState, RangedRotationState, MagicRotationState };
export type { NecroRotationState, NecromancyRotationState, ConjureState };
export const ADRENALINE_CAP = 100;

/** Ability id -> first tick it can be cast again. Absent = no individual cooldown. */
export type CooldownState = Readonly<Record<string, number>>;

/** Dynamic effects the simulation has put on the target, not on the player. */
export interface TargetRuntimeState {
  /** Tick of the latest damaging cast against this target; -1 before combat. */
  lastAttackTick: number;
  /** Burn debuffs applied to the target (Combust). */
  burns: BurnState;
  /**
   * Cast sequence of the active Bloated debuff (-1 = none). Recasting Bloat
   * overwrites the previous debuff: its pending tails are cancelled by owner
   * (wiki: the duration resets on recast).
   */
  bloatedByCast: number;
  melee: MeleeTargetEffects;
}

/**
 * The complete simulation state. Everything mutable lives here — never in
 * module globals or captured closure state — and every field is replaced rather
 * than mutated in place, so a branch can share the object safely.
 *
 * Genuinely global clocks stay at the top level; everything else belongs to the
 * style that owns its mechanics, or to the target it was applied to.
 */
export interface RotationState {
  /** Next tick free for a cast — the global cooldown is encoded here. */
  tick: number;
  adrenaline: number;
  adrenalineCap: number;
  /** Vestments set(2): exclusive end of the 15%-over-18s regeneration. */
  vestmentsAdrenalineUntilTick: number;
  cooldowns: CooldownState;
  /**
   * Relentless perk lockout: after a proc the perk cannot activate again until
   * this tick (wiki: 30s internal cooldown; 0 = ready). Style-agnostic.
   */
  relentlessUntilTick: number;
  invention: {
    /** Crackling starts ready and triggers on the next eligible attack. */
    cracklingReadyTick: number;
    /** Expected damage accumulated toward the 50,000 Aftershock threshold. */
    aftershockCharge: number;
    /** Earliest tick another Aftershock blast may land. */
    aftershockReadyTick: number;
    /** A threshold-crossing blast is already queued, possibly behind its cooldown. */
    aftershockPending: boolean;
  };
  naturalInstinctUntilTick: number;
  melee: MeleeRotationState;
  ranged: RangedRotationState;
  magic: MagicRotationState;
  necromancy: NecromancyRotationState;
  target: TargetRuntimeState;
}

export function newRotationState(
  opts: {
    lantern?: boolean;
    adrenaline?: number;
    adrenalineCap?: number;
    naturalInstinctUntilTick?: number;
  } = {},
): RotationState {
  const adrenalineCap = opts.adrenalineCap ?? ADRENALINE_CAP;
  return {
    tick: 0,
    adrenaline: Math.min(adrenalineCap, opts.adrenaline ?? 0),
    adrenalineCap,
    vestmentsAdrenalineUntilTick: 0,
    cooldowns: {},
    relentlessUntilTick: 0,
    invention: {
      cracklingReadyTick: 0,
      aftershockCharge: 0,
      aftershockReadyTick: 0,
      aftershockPending: false,
    },
    naturalInstinctUntilTick: opts.naturalInstinctUntilTick ?? 0,
    melee: newMeleeRotationState(),
    ranged: newRangedRotationState(),
    magic: newMagicRotationState(),
    necromancy: newNecromancyRotationState({ lantern: opts.lantern }),
    target: {
      lastAttackTick: -1,
      burns: newBurns(),
      bloatedByCast: -1,
      melee: newMeleeTargetEffects(),
    },
  };
}

export function gainAdrenaline(state: RotationState, amount: number): RotationState {
  return { ...state, adrenaline: Math.min(state.adrenalineCap, state.adrenaline + amount) };
}

export function spendAdrenaline(state: RotationState, amount: number): RotationState {
  return { ...state, adrenaline: Math.max(0, state.adrenaline - amount) };
}

/** GCD-free tick and any per-ability cooldown combined. */
export function firstLegalTick(
  state: RotationState,
  abilityId: string,
  cooldownGroup?: string,
): number {
  return Math.max(
    state.tick,
    state.cooldowns[abilityId] ?? 0,
    cooldownGroup ? (state.cooldowns[cooldownGroup] ?? 0) : 0,
  );
}

export function startCooldown(
  state: RotationState,
  abilityId: string,
  ticks: number,
): RotationState {
  return { ...state, cooldowns: { ...state.cooldowns, [abilityId]: state.tick + ticks } };
}

export function clearCooldowns(state: RotationState, ids: readonly string[]): RotationState {
  if (ids.length === 0) return state;
  const cooldowns = { ...state.cooldowns };
  for (const id of ids) delete cooldowns[id];
  return { ...state, cooldowns };
}

export function patchMelee(
  state: RotationState,
  patch: Partial<MeleeRotationState>,
): RotationState {
  return { ...state, melee: { ...state.melee, ...patch } };
}

export function patchRanged(
  state: RotationState,
  patch: Partial<RangedRotationState>,
): RotationState {
  return { ...state, ranged: { ...state.ranged, ...patch } };
}

export function patchMagic(
  state: RotationState,
  patch: Partial<MagicRotationState>,
): RotationState {
  return { ...state, magic: { ...state.magic, ...patch } };
}

/** Necro resource fields only — prefer applyNecroOnCast for cast transitions. */
export function patchNecro(
  state: RotationState,
  patch: Partial<NecroRotationState>,
): RotationState {
  return {
    ...state,
    necromancy: { ...state.necromancy, resources: { ...state.necromancy.resources, ...patch } },
  };
}

export function patchConjures(state: RotationState, conjures: ConjureState): RotationState {
  return { ...state, necromancy: { ...state.necromancy, conjures } };
}

export function patchTarget(
  state: RotationState,
  patch: Partial<TargetRuntimeState>,
): RotationState {
  return { ...state, target: { ...state.target, ...patch } };
}

export function gainMeleeBloodlust(state: RotationState, base: number): RotationState {
  return patchMelee(state, { bloodlust: gainBloodlust(state.melee.bloodlust, base) });
}
