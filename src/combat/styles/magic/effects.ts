import { secondsToTicks } from "../../rotation/timing";
import { BLOOMING_BURROW_WIKI_2026_03_30 } from "../../data/sources";
import { PLANTED_FEET_DURATION_MULT } from "../../shared/perks";
import { newBurns, type BurnState } from "./burn";
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
  /** Tick the buff starts (end of the completed Asphyxiate channel). */
  startsAtTick: number;
  /** Tick the buff expires on; 0 = inactive. */
  expiresAtTick: number;
  critDamageBonus: number;
}

export const newChannelledMight = (): ChannelledMightState => ({
  startsAtTick: 0,
  expiresAtTick: 0,
  critDamageBonus: CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS,
});

export function grantChannelledMight(
  startTick: number,
  tumekensFivePiece = false,
): ChannelledMightState {
  const duration = tumekensFivePiece
    ? TUMEKENS_CHANNELLED_MIGHT.durationSeconds
    : CHANNELLED_MIGHT_DURATION_SECONDS;
  return {
    startsAtTick: startTick,
    expiresAtTick: startTick + secondsToTicks(duration),
    critDamageBonus: tumekensFivePiece
      ? TUMEKENS_CHANNELLED_MIGHT.critDamageBonus
      : CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS,
  };
}

/** Extra crit damage while active (half-open window); 0 outside it. Feeds the crit damageBonus layer. */
export function channelledMightCritBonus(state: ChannelledMightState, tick: number): number {
  return tick >= state.startsAtTick && tick < state.expiresAtTick ? state.critDamageBonus : 0;
}

/**
 * Flow (Sonic Wave, 2 Mar 2026): the next Magic ability costs 10% less
 * adrenaline for 9s (15 ticks); Greater Sonic Wave's Greater Flow is 20%.
 * Empowered by Runic Charge: +25% (totals 35%/45%). Enhanced/ultimate Magic
 * casts consume it; Defence/Constitution/specials never touch it.
 * https://runescape.wiki/w/Sonic_Wave (verified 2026-07-31).
 */
export const FLOW_DURATION_TICKS = 15;
export const SONIC_FLOW_REDUCTION_PCT = 10;
export const GREATER_FLOW_REDUCTION_PCT = 20;
export const RUNIC_FLOW_BONUS_PCT = 25;

/**
 * Concentrated Blast crit progression (wiki Critical strike): each channelled
 * hit grants +5% crit chance for the next Magic attack, including the
 * channel's own later hits; Greater Concentrated Blast +7%. Runic-empowered:
 * +15%/+17% per hit. Stacks apply at land time and the next non-CB magic
 * attack consumes them.
 */
export const CONC_BLAST_CRIT_PER_HIT_PCT = 5;
export const GREATER_CONC_BLAST_CRIT_PER_HIT_PCT = 7;
export const CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT = 15;
export const GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT = 17;

/** Magic rotation state beyond Runic Charge. */
export interface MagicFxState {
  /** Flow window end (0 = inactive) and the stored reduction pct. */
  flowUntilTick: number;
  flowReductionPct: number;
  /** Accumulated Concentrated Blast crit stacks and the granting cast's pct per stack. */
  concCritStacks: number;
  concCritPerStackPct: number;
  channelledMight: ChannelledMightState;
  burns: BurnState;
}

export const newMagicFx = (): MagicFxState => ({
  flowUntilTick: 0,
  flowReductionPct: 0,
  concCritStacks: 0,
  concCritPerStackPct: 0,
  channelledMight: newChannelledMight(),
  burns: newBurns(),
});

export function isConcentratedBlast(abilityId: string): boolean {
  return abilityId === "concentrated_blast" || abilityId === "greater_concentrated_blast";
}

/**
 * Sunshine / Greater Sunshine zone buff (wiki): Magic attacks deal 1.5x while
 * the player is inside the 7x7 beam. Sim assumes the player stays inside
 * (generic target; no position model).
 *
 * Base Sunshine: 50-tick (30s) beam; damage buff begins 1 tick (0.6s) after cast
 * → active on [cast+1, cast+50).
 * Greater Sunshine: 65-tick total duration; buff begins 1 tick after cast and
 * lasts 64 ticks → active on [cast+1, cast+65).
 *
 * Planted Feet (base only): duration × PLANTED_FEET_DURATION_MULT → 63 ticks
 * (Math.round(50 × 1.25)); same [cast+1, cast+duration) shape. Greater: no change.
 * Planted Feet also removes the periodic beam DoT — implemented in
 * castPreparation (the cast schedules no DoT events at all).
 */
export const SUNSHINE_DAMAGE_MULTIPLIER = 1.5;
/** Base Sunshine beam duration in ticks (wiki: 30s / 50 ticks). */
export const SUNSHINE_DURATION_TICKS = 50;
/** Greater Sunshine active buff ticks after the 1-tick delay (wiki: 64). */
export const GREATER_SUNSHINE_BUFF_TICKS = 64;

export interface SunshineState {
  startsAtTick: number;
  expiresAtTick: number;
  /**
   * Cast sequence that created the beam (sim provenance). The granting cast's
   * own hits predate the buff and never take its multiplier.
   */
  grantedByCast?: number;
}

export const newSunshine = (): SunshineState => ({ startsAtTick: 0, expiresAtTick: 0 });

/**
 * Activate the Sunshine zone buff.
 * `greater` selects Greater Sunshine timings.
 * `plantedFeet` extends base Sunshine only (wiki: 63 ticks); ignored for greater.
 */
export function activateSunshine(
  tick: number,
  greater = false,
  plantedFeet = false,
  grantedByCast?: number,
): SunshineState {
  if (greater) {
    return {
      startsAtTick: tick + 1,
      expiresAtTick: tick + 1 + GREATER_SUNSHINE_BUFF_TICKS,
      ...(grantedByCast !== undefined ? { grantedByCast } : {}),
    };
  }
  const duration = plantedFeet
    ? Math.round(SUNSHINE_DURATION_TICKS * PLANTED_FEET_DURATION_MULT)
    : SUNSHINE_DURATION_TICKS;
  return {
    startsAtTick: tick + 1,
    expiresAtTick: tick + duration,
    ...(grantedByCast !== undefined ? { grantedByCast } : {}),
  };
}

/** Greater Sunshine only — thin wrapper kept for existing call sites. */
export function activateGreaterSunshine(tick: number): SunshineState {
  return activateSunshine(tick, true);
}

export function sunshineActive(state: SunshineState, tick: number): boolean {
  return tick >= state.startsAtTick && tick < state.expiresAtTick;
}

export const SUNSHINE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Sunshine",
  title: "Sunshine",
  verifiedAt: "2026-07-26",
};

export const GREATER_SUNSHINE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Greater_Sunshine",
  title: "Greater Sunshine",
  verifiedAt: "2026-07-26",
};

/**
 * Instability (FSOA special, wiki): grants a 30s (50-tick) self-buff. While active,
 * a Magic critical strike on the primary target fires Lightning Surge dealing
 * 70–90% ability damage, landing 1 tick after the source hit. Lightning Surge
 * crits do not chain further surges. Magic weapons only.
 * PvP: no crit effect and no cooldown — out of scope for this PvM EV sim.
 *
 * Wiki EV for one source hit under Instability:
 *   E = (1−p)·S_non-crit + p·(S_crit + T)
 * so the surge contribution is p·T, where T is the expected Lightning Surge hit
 * (crit-eligible for its own damage, no recursive proc).
 */
export const INSTABILITY_DURATION_TICKS = 50;
export const LIGHTNING_SURGE_BAND = { minPct: 70, maxPct: 90 } as const;
export const LIGHTNING_SURGE_TICK_DELAY = 1;

export interface InstabilityState {
  /** Tick the buff expires on; 0 = inactive. Active while tick < expiresAtTick. */
  expiresAtTick: number;
}

export const newInstability = (): InstabilityState => ({ expiresAtTick: 0 });

export function activateInstability(tick: number): InstabilityState {
  return { expiresAtTick: tick + INSTABILITY_DURATION_TICKS };
}

export function instabilityActive(state: InstabilityState, tick: number): boolean {
  return tick < state.expiresAtTick;
}

/**
 * Expected Lightning Surge contribution for one source hit.
 * `sourceCritChance` is that hit's crit probability; `surgeHitExpected` is the
 * full expected of a 70–90% ability-damage hit (including its own crit layer).
 */
export function lightningSurgeExpected(sourceCritChance: number, surgeHitExpected: number): number {
  if (sourceCritChance <= 0 || surgeHitExpected <= 0) return 0;
  return Math.min(1, sourceCritChance) * surgeHitExpected;
}

export const INSTABILITY_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Instability",
  title: "Instability",
  verifiedAt: "2026-07-26",
};

export const CHANNELLED_MIGHT_SOURCE: SourceReference = BLOOMING_BURROW_WIKI_2026_03_30;
