import type { SourceReference } from "../../types";
import { newBloodlust, type BloodlustState } from "./bloodlust";

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
 *
 * Sim idle clock (last-attack model): ticks since last melee damaging cast
 * (`readyTick - melee.lastCastTick`). Pure revo / generic target has no position
 * — off-target movement (Surge / Escape / Bladed Dive) is unmodelled.
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
   * Wiki states no window — it persists until a non-bleed melee hit consumes it.
   */
  furyCritBonus: boolean;
  /**
   * Meteor Strike: melee basics generate 1.5x adren + 4.5% passive per tick
   * until this tick (0 = inactive). Wiki duration 30s (50 ticks).
   */
  meteorStrikeUntilTick: number;
  /**
   * Last-attack idle clock for Greater Barge (generic target / pure revo).
   * Tick of the previous melee damaging cast; -1 = none yet. Off-target
   * movement (Surge / Escape / Bladed Dive) is unmodelled.
   */
  lastCastTick: number;
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
}

export const newMeleeRotationState = (): MeleeRotationState => ({
  bloodlust: newBloodlust(),
  berserkUntilTick: 0,
  chaosRoarUntilTick: 0,
  greaterFuryUntilTick: 0,
  furyCritBonus: false,
  meteorStrikeUntilTick: 0,
  lastCastTick: -1,
  endlessAssaultUntilTick: 0,
  bleedChainNext: null,
  bleedChainUntilTick: 0,
});

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
