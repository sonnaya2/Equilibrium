import { secondsToTicks } from "../../core/ticks";
import { BLOOMING_BURROW_WIKI_2026_03_30 } from "../../data/sources";
import { PLANTED_FEET_DURATION_MULT } from "../../shared/perks";
import { newRunicCharge, type RunicChargeState } from "./runicCharge";
import type { SourceReference } from "../../types";

/**
 * Channelled Might (30 Mar 2026): full Asphyxiate channel → +15% magic crit damage
 * for 3.6s; Tumeken 5-piece → 9s at +35%.
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
 * Flow (Sonic Wave, 2 Mar 2026): granted when the hit lands only.
 * 15 ticks: next eligible Magic costs -10 adren (Greater 20; Runic 35/45).
 * Enhanced/ultimates consume; basics do not. Cost floors at 0.
 * https://runescape.wiki/w/Sonic_Wave (verified 2026-07-31).
 */
export const FLOW_DURATION_TICKS = 15;
export const SONIC_FLOW_REDUCTION = 10;
export const GREATER_FLOW_REDUCTION = 20;
export const RUNIC_FLOW_BONUS = 25;

/**
 * Conc Blast crit (wiki Critical strike): +5% per channelled hit (+7% Greater);
 * Runic +15%/+17%. Applies at land; next non-CB Magic attack consumes stacks.
 */
export const CONC_BLAST_CRIT_PER_HIT_PCT = 5;
export const GREATER_CONC_BLAST_CRIT_PER_HIT_PCT = 7;
export const CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT = 15;
export const GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT = 17;

/** Mutable magic between-cast state. Combust burn lives on the target, not here. */
export interface MagicRotationState {
  /** Runic Charge / Anima Charged window. */
  runicCharge: RunicChargeState;
  /** Sunshine / Greater Sunshine zone buff window (starts 1 tick after cast). */
  sunshine: SunshineState;
  /** Instability (FSOA): Lightning Surge on a Magic crit while active. */
  instability: InstabilityState;
  /** Flow window end (0 = inactive) and the stored reduction in adrenaline points. */
  flowUntilTick: number;
  flowReduction: number;
  /** Accumulated Concentrated Blast crit stacks and the granting cast's pct per stack. */
  concCritStacks: number;
  concCritPerStackPct: number;
  channelledMight: ChannelledMightState;
}

export const newMagicRotationState = (): MagicRotationState => ({
  runicCharge: newRunicCharge(),
  sunshine: newSunshine(),
  instability: newInstability(),
  flowUntilTick: 0,
  flowReduction: 0,
  concCritStacks: 0,
  concCritPerStackPct: 0,
  channelledMight: newChannelledMight(),
});

export function isConcentratedBlast(abilityId: string): boolean {
  return abilityId === "concentrated_blast" || abilityId === "greater_concentrated_blast";
}

/**
 * Sunshine zone (wiki): 1.5x Magic while inside 7x7 beam; sim assumes player stays in.
 * Base: buff [cast+1, cast+50). Greater: [cast+1, cast+65) (64 buff ticks after delay).
 * Planted Feet: base only → Math.round(50 × 1.25) = 63 ticks; also drops beam DoT (castPreparation).
 */
export const SUNSHINE_DAMAGE_MULTIPLIER = 1.5;
/** Base Sunshine beam duration in ticks (wiki: 30s / 50 ticks). */
export const SUNSHINE_DURATION_TICKS = 50;
/** Greater Sunshine active buff ticks after the 1-tick delay (wiki: 64). */
export const GREATER_SUNSHINE_BUFF_TICKS = 64;

export interface SunshineState {
  startsAtTick: number;
  expiresAtTick: number;
  /** Granting cast seq; that cast's hits never take the Sunshine mult. */
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

/** Greater Sunshine only - thin wrapper kept for existing call sites. */
export function activateGreaterSunshine(tick: number): SunshineState {
  return activateSunshine(tick, true);
}

export function sunshineActive(state: SunshineState, tick: number): boolean {
  return tick >= state.startsAtTick && tick < state.expiresAtTick;
}

/** Tumeken set(3): +1.5% Magic crit chance per piece inside another cast's Sunshine. */
export function tumekensSunshineCritChance(
  pieces: number,
  state: SunshineState,
  tick: number,
  sourceCast: number,
): number {
  const n = Math.max(0, Math.min(5, Math.floor(pieces)));
  return n >= 3 && state.grantedByCast !== sourceCast && sunshineActive(state, tick)
    ? n * 0.015
    : 0;
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
 * Instability (FSOA, wiki): 50-tick self-buff. Magic crit on primary fires Lightning
 * Surge (70-90% AD, land +1 tick); surge crits do not chain. Magic weapons only.
 * Surge EV contribution: p·T (T = expected surge hit, crit-eligible, no recurse).
 */
export const INSTABILITY_DURATION_TICKS = 50;
export const LIGHTNING_SURGE_BAND = { minPct: 70, maxPct: 90 } as const;
export const LIGHTNING_SURGE_TICK_DELAY = 1;

export interface InstabilityState {
  /** Tick the buff expires on; 0 = inactive. Active while tick < expiresAtTick. */
  expiresAtTick: number;
  /** The granting cast cannot trigger its own Lightning Surge. */
  grantedByCast: number;
}

export const newInstability = (): InstabilityState => ({ expiresAtTick: 0, grantedByCast: -1 });

export function activateInstability(tick: number, castSeq: number): InstabilityState {
  return { expiresAtTick: tick + INSTABILITY_DURATION_TICKS, grantedByCast: castSeq };
}

export function instabilityActive(state: InstabilityState, tick: number): boolean {
  return tick < state.expiresAtTick;
}

/**
 * Expected Lightning Surge contribution for one source hit.
 * `sourceCritChance` is that hit's crit probability; `surgeHitExpected` is the
 * full expected of a 70-90% ability-damage hit (including its own crit layer).
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
