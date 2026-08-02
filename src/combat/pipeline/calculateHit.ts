import { bandOf, type DamageBand } from "../core/abilityDamage";
import { baseCritDamageMultiplier, critProbability, type CritLayers } from "../core/critical";
import { applyDamagePotential, damagePotential } from "../core/damagePotential";
import { applyHitCap, normalizeHitCapRule, standardHitCap, type HitCapRule } from "../core/hitCaps";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_WIKI } from "../data/sources";
import { preciseMinHitAddition } from "../shared/perks";
import { runPipeline } from "./modifierPipeline";
import type { CombatContext, CombatModifier } from "../types";

export interface HitInput {
  /** Caller-supplied base ability damage (weapon + level composition lives outside the engine). */
  base: number;
  band: DamageBand;
  /** Style level, feeds the crit damage layer. */
  level: number;
  /** Accuracy 0..1, applied as Damage Potential. */
  accuracy: number;
  crit: CritLayers;
  context?: CombatContext;
  modifiers?: CombatModifier[];
  cap?: HitCapRule;
  /** Precise perk rank 1–6; raises min hit by 1.5% of max per rank. */
  preciseRank?: number;
}

export interface HitResult {
  potential: number;
  min: number;
  max: number;
  critMin: number;
  critMax: number;
  critChance: number;
  nonCritExpected: number;
  critExpected: number;
  /** Chance-weighted mean across crit and non-crit, Damage-Potential-scaled and capped. */
  expected: number;
  /** Same expectation before the hit cap, for analysis attribution. */
  uncappedExpected: number;
  capLoss: number;
}

export interface RawHitBandInput extends Omit<HitInput, "base" | "band"> {
  min: number;
  max: number;
}

type SharedHitInput = Omit<HitInput, "base" | "band">;

function critModifier(multiplier: number): CombatModifier {
  return {
    id: "core:critical-damage",
    stage: "critical",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source: MODERNISATION_WIKI,
  };
}

function runPass(
  damage: number,
  critMult: number | null,
  input: SharedHitInput,
  cap = true,
): number {
  const modifiers =
    critMult === null
      ? (input.modifiers ?? [])
      : [...(input.modifiers ?? []), critModifier(critMult)];
  const state = runPipeline({ damage }, modifiers, input.context ?? { style: "melee" });
  const scaled = applyDamagePotential(state.damage, input.accuracy);
  const resolved = Math.floor(scaled);
  return cap ? applyHitCap(resolved, input.cap ?? standardHitCap) : resolved;
}

const MAX_EXACT_BAND_POINTS = 100_001;

function exactMean(
  min: number,
  max: number,
  critMult: number | null,
  input: SharedHitInput,
  cap = true,
): number {
  const count = max - min + 1;
  if (count > MAX_EXACT_BAND_POINTS) {
    throw new RangeError(
      `calculateHit: exact integer band has ${count} points (limit ${MAX_EXACT_BAND_POINTS})`,
    );
  }
  let total = 0;
  for (let roll = min; roll <= max; roll++) total += runPass(roll, critMult, input, cap);
  return total / count;
}

/**
 * Single hit: band roll -> modifier pipeline -> crit layer -> Damage Potential -> cap.
 * Crit runs as a second pass with the crit damage multiplier injected at the critical
 * stage, so crit-only modifiers see exactly one code path. Expected damage enumerates
 * the inclusive uniform integer band, preserving every floor and partial cap exactly.
 */
export function calculateHit(input: HitInput): HitResult {
  const band = bandOf(input.base, input.band);
  let min = band.min;
  const max = band.max;
  const precise = input.preciseRank ?? 0;
  if (precise > 0) {
    min = Math.min(max, Math.floor(min + preciseMinHitAddition(max, precise)));
  }
  return calculateRawHitBand({ ...input, min, max });
}

function assertIntegerBandBounds(min: number, max: number): void {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new RangeError(`calculateRawHitBand: non-finite band ${min}-${max}`);
  }
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new RangeError(`calculateRawHitBand: non-integer band ${min}-${max}`);
  }
  if (min < 0) {
    throw new RangeError(`calculateRawHitBand: negative minimum ${min}`);
  }
  if (min > max) {
    throw new RangeError(`calculateRawHitBand: inverted band ${min}-${max}`);
  }
}

/** Resolve an already-composed inclusive integer band through the normal hit pipeline. */
export function calculateRawHitBand(input: RawHitBandInput): HitResult {
  assertIntegerBandBounds(input.min, input.max);
  if (input.cap) normalizeHitCapRule(input.cap);
  const p = critProbability(input.crit);
  const critMult =
    p > 0 ? baseCritDamageMultiplier(input.level, input.crit.damageBonus ?? 0) : null;

  const min = runPass(input.min, null, input);
  const max = runPass(input.max, null, input);
  const critMin = critMult === null ? min : runPass(input.min, critMult, input);
  const critMax = critMult === null ? max : runPass(input.max, critMult, input);
  const nonCritExpected = exactMean(input.min, input.max, null, input);
  const critExpected =
    critMult === null ? nonCritExpected : exactMean(input.min, input.max, critMult, input);
  const expected = (1 - p) * nonCritExpected + p * critExpected;
  const capRule = normalizeHitCapRule(input.cap ?? standardHitCap);
  const canClip =
    !capRule.bypass &&
    Math.max(runPass(input.max, null, input, false), runPass(input.max, critMult, input, false)) >
      capRule.cap;
  const uncappedExpected = canClip
    ? (1 - p) * exactMean(input.min, input.max, null, input, false) +
      p * exactMean(input.min, input.max, critMult, input, false)
    : expected;

  return {
    potential: damagePotential(input.accuracy),
    min,
    max,
    critMin,
    critMax,
    critChance: p,
    nonCritExpected,
    critExpected,
    expected,
    uncappedExpected,
    capLoss: Math.max(0, uncappedExpected - expected),
  };
}
