import type { BleedId, SourceReference } from "../../types";
import { newBloodlust, type BloodlustState } from "./bloodlust";
import type { PrimordialIceDistribution } from "./primordialIce";

const wiki = (title: string, path: string, verifiedAt = "2026-07-26"): SourceReference => ({
  source: "runescape-wiki",
  url: `https://runescape.wiki/w/${path}`,
  title,
  verifiedAt,
});

/** Next melee attack (crit-eligible) gains this much critical strike chance. */
export const FURY_CRIT_CHANCE_BONUS = 0.25;
export const FURY_SOURCE = wiki("Fury", "Fury");

/** Each Greater Flurry hit extends an active Berserk window by this many seconds. */
export const GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS = 0.6;
export const GREATER_FLURRY_SOURCE = wiki("Greater Flurry", "Greater_Flurry");

/** Melee basic abilities generate this multiple of listed adrenaline while buffed. */
export const METEOR_STRIKE_BASIC_ADREN_MULTIPLIER = 1.5;
/** Passive adrenaline per game tick (0.6s) while a melee weapon is equipped. */
export const METEOR_STRIKE_PASSIVE_ADREN_PER_TICK = 4.5;
export const METEOR_STRIKE_DURATION_SECONDS = 30;
export const METEOR_STRIKE_SOURCE = wiki("Meteor Strike", "Meteor_Strike");

/**
 * Wiki tooltip: +5-7% ability damage per idle tick, cap 6s (10 ticks).
 * Analysis table matches +5 min / +7 max per tick.

 * Sim idle clock: ticks since the last damaging cast against this target.
 * Generic-target simulation has no position, so off-target movement is unmodelled.
 * After >= 8 idle ticks, Greater Barge also grants Endless Assault for 6s
 * (next channelled melee consumes the window; hits already multi-tick).
 */
export const GREATER_BARGE_IDLE_MIN_PCT_PER_TICK = 5;
export const GREATER_BARGE_IDLE_MAX_PCT_PER_TICK = 7;
export const GREATER_BARGE_IDLE_CAP_TICKS = 10;
/** Idle ticks required before casting Greater Barge grants Endless Assault. */
export const GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS = 8;
export const GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS = 6;
export const GREATER_BARGE_SOURCE = wiki("Greater Barge", "Greater_Barge");

export const PULVERISE_DEBUFF_DAMAGE_REDUCTION = 0.25;
export const PULVERISE_DEBUFF_DURATION_SECONDS = 30;
export const PULVERISE_KILL_ADRENALINE = 50;
export const PULVERISE_SOURCE = wiki("Pulverise", "Pulverise");

export const ABYSSAL_PARASITE_MAX_STACKS = 50;
export const ABYSSAL_PARASITE_DURATION_TICKS = 15;
export const ABYSSAL_PARASITE_INTERVAL_TICKS = 3;

/** Dark Shard of Leng - Endless Frost (wiki, post 4 Mar 2024). */
export const LENG_ENDLESS_FROST_CHANCE = 0.1;
/** Dark Sliver of Leng - Boundless Chill. */
export const LENG_BOUNDLESS_CHILL_CHANCE = 0.02;
export const PRIMORDIAL_ICE_CAP = 10;
/** Frostblades from Boundless Chill stack generation. */
export const FROSTBLADES_DURATION_SECONDS = 9;
/** Flat damage = 24% of player ability damage (AD). */
export const FROSTBLADES_AD_FRACTION = 0.24;
export const ICY_TEMPEST_COST_PCT = 30;
export const ICY_TEMPEST_COST_REDUCTION_PER_STACK = 12;
export const ICY_TEMPEST_COOLDOWN_SECONDS = 15;
export const ICY_TEMPEST_PRIMARY_BAND = { minPct: 115, maxPct: 135 } as const;
export const ICY_TEMPEST_SECONDARY_BAND = { minPct: 175, maxPct: 205 } as const;
/** Per stack: +18-22% ability damage on each Icy Tempest hit. */
export const ICY_TEMPEST_STACK_BAND = { minPct: 18, maxPct: 22 } as const;
export const LENG_SOURCE = wiki("Dark Shard of Leng", "Dark_Shard_of_Leng", "2026-08-02");

export interface AbyssalParasiteState {
  stacks: number;
  expiresAtTick: number;
  nextDamageTick: number;
  scheduledThroughTick: number;
}

export interface MeleeTargetEffects {
  bleeds: Partial<Record<BleedId, number>>;
  abyssalParasite: AbyssalParasiteState;
  enduringRuin: { bleedVulnerability: number; untilTick: number };
}

export const newMeleeTargetEffects = (): MeleeTargetEffects => ({
  bleeds: {},
  abyssalParasite: { stacks: 0, expiresAtTick: 0, nextDamageTick: 0, scheduledThroughTick: 0 },
  enduringRuin: { bleedVulnerability: 0, untilTick: 0 },
});

export function activeBleedCount(target: MeleeTargetEffects, at: number): number {
  let count = Object.values(target.bleeds).filter((until) => until != null && at < until).length;
  if (target.abyssalParasite.stacks > 0 && at < target.abyssalParasite.expiresAtTick) count++;
  return count;
}

export function abyssalParasiteDamage(stacks: number): { min: number; max: number } {
  const n = Math.max(0, Math.min(ABYSSAL_PARASITE_MAX_STACKS, Math.floor(stacks)));
  return { min: Math.floor(18.74 * n), max: Math.floor(31.24 * n) };
}

/** Every mutable melee state the simulation carries between casts. */
export interface MeleeRotationState {
  bloodlust: BloodlustState;
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
   * Wiki states no window - it persists until a non-bleed melee hit consumes it.
   */
  furyCritBonus: boolean;
  /**
   * Meteor Strike: melee basics generate 1.5x adren + 4.5% passive per tick
   * until this tick (0 = inactive). Wiki duration 30s (50 ticks).
   */
  meteorStrikeUntilTick: number;
  /**
   * Endless Assault window end tick (0 = inactive). Set when Greater Barge is
   * cast after >= 8 idle ticks; next channelled melee inside it consumes it.
   */
  endlessAssaultUntilTick: number;
  /**
   * Dismember recast chain (wiki: "Can be recast within 24s (40 ticks) of the
   * previous cast"): the unlocked follow-up stage and its window end.
   * null/0 = no live chain.
   */
  bleedChainNext: "slaughter" | "massacre" | null;
  bleedChainUntilTick: number;
  enduringRuin: { nextAttackBonus: number; untilTick: number; grantedByCast: number };
  /**
   * Compact Primordial Ice distribution (11 bins + expiry).
   * Never store a fractional E[stacks] scalar for cast-time spend/bands.
   */
  primordialIce: PrimordialIceDistribution;
  /** Frostblades window end (0 = inactive). Active while tick < until. */
  frostbladesUntilTick: number;
  /**
   * Probability mass that Frostblades is active (0..1). Damage flat scales by this.
   */
  frostbladesOpenMass: number;
}

export const newMeleeRotationState = (): MeleeRotationState => ({
  bloodlust: newBloodlust(),
  berserkUntilTick: 0,
  chaosRoarUntilTick: 0,
  greaterFuryUntilTick: 0,
  furyCritBonus: false,
  meteorStrikeUntilTick: 0,
  endlessAssaultUntilTick: 0,
  bleedChainNext: null,
  bleedChainUntilTick: 0,
  enduringRuin: { nextAttackBonus: 0, untilTick: 0, grantedByCast: -1 },
  primordialIce: {
    stackMass: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    expiresAtTick: 0,
  },
  frostbladesUntilTick: 0,
  frostbladesOpenMass: 0,
});

/** Integer-stack spend (floors). Prefer resolveIcyTempest for distributions. */
export function icyTempestSpend(stacks: number): number {
  const n = Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(stacks)));
  return Math.max(0, ICY_TEMPEST_COST_PCT - ICY_TEMPEST_COST_REDUCTION_PER_STACK * n);
}

/** Integer-stack hit bands (floors). Prefer resolveIcyTempest / icyTempestHitsLinear. */
export function icyTempestHits(stacks: number): { band: { minPct: number; maxPct: number } }[] {
  const n = Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(stacks)));
  const addMin = ICY_TEMPEST_STACK_BAND.minPct * n;
  const addMax = ICY_TEMPEST_STACK_BAND.maxPct * n;
  return [
    {
      band: {
        minPct: ICY_TEMPEST_PRIMARY_BAND.minPct + addMin,
        maxPct: ICY_TEMPEST_PRIMARY_BAND.maxPct + addMax,
      },
    },
    {
      band: {
        minPct: ICY_TEMPEST_SECONDARY_BAND.minPct + addMin,
        maxPct: ICY_TEMPEST_SECONDARY_BAND.maxPct + addMax,
      },
    },
  ];
}

export function greaterBargeIdleBand(
  baseMinPct: number,
  baseMaxPct: number,
  idleTicks: number,
): { minPct: number; maxPct: number } {
  const t = Math.max(0, Math.min(GREATER_BARGE_IDLE_CAP_TICKS, Math.floor(idleTicks)));
  return {
    minPct: baseMinPct + GREATER_BARGE_IDLE_MIN_PCT_PER_TICK * t,
    maxPct: baseMaxPct + GREATER_BARGE_IDLE_MAX_PCT_PER_TICK * t,
  };
}

export type { PrimordialIceDistribution };
