/**
 * Melee buff constants and helpers wired into the rotation sim.
 * Wiki-verified 2026-07-26. Damage-relevant numbers only — see MELEE_EFFECTS
 * in abilities.ts for UNVERIFIED / non-outgoing notes.
 */
import type { SourceReference } from "../../types";

const wiki = (title: string, path: string, verifiedAt = "2026-07-26"): SourceReference => ({
  source: "runescape-wiki",
  url: `https://runescape.wiki/w/${path}`,
  title,
  verifiedAt,
});

// --- Fury -------------------------------------------------------------------
/** Next melee attack (crit-eligible) gains this much critical strike chance. */
export const FURY_CRIT_CHANCE_BONUS = 0.25;
export const FURY_SOURCE = wiki("Fury", "Fury");

// --- Greater Flurry ---------------------------------------------------------
/** Each Greater Flurry hit extends an active Berserk window by this many seconds. */
export const GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS = 0.6;
export const GREATER_FLURRY_SOURCE = wiki("Greater Flurry", "Greater_Flurry");

// --- Meteor Strike ----------------------------------------------------------
/** Melee basic abilities generate this multiple of listed adrenaline while buffed. */
export const METEOR_STRIKE_BASIC_ADREN_MULTIPLIER = 1.5;
/** Passive adrenaline per game tick (0.6s) while a melee weapon is equipped. */
export const METEOR_STRIKE_PASSIVE_ADREN_PER_TICK = 4.5;
export const METEOR_STRIKE_DURATION_SECONDS = 30;
export const METEOR_STRIKE_SOURCE = wiki("Meteor Strike", "Meteor_Strike");

// --- Greater Barge ------------------------------------------------------------
/**
 * Wiki tooltip: +5-7% ability damage per idle tick, cap 6s (10 ticks).
 * Analysis table matches +5 min / +7 max per tick.
 *
 * Sim idle clock (last-attack model): ticks since last melee damaging cast
 * (`readyTick - lastMeleeCastTick`). Pure revo / generic target has no position
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

// --- Pulverise (not outgoing-damage; documented only) -----------------------
export const PULVERISE_DEBUFF_DAMAGE_REDUCTION = 0.25;
export const PULVERISE_DEBUFF_DURATION_SECONDS = 30;
export const PULVERISE_KILL_ADRENALINE = 50;
export const PULVERISE_SOURCE = wiki("Pulverise", "Pulverise");

/** Band after Greater Barge idle ticks (tooltip table; wired in simulate). */
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
