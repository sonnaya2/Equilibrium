import { bandOf, type DamageBand } from "../core/abilityDamage";
import { baseCritDamageMultiplier, critProbability, type CritLayers } from "../core/critical";
import { applyDamagePotential, damagePotential } from "../core/damagePotential";
import { applyHitCap, standardHitCap, type HitCapRule } from "../core/hitCaps";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_WIKI } from "../data/sources";
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
}

export interface HitResult {
  potential: number;
  min: number;
  max: number;
  critMin: number;
  critMax: number;
  critChance: number;
  /** Chance-weighted mean across crit and non-crit, Damage-Potential-scaled and capped. */
  expected: number;
}

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

function runPass(damage: number, critMult: number | null, input: HitInput): number {
  const modifiers = critMult === null ? (input.modifiers ?? []) : [...(input.modifiers ?? []), critModifier(critMult)];
  const state = runPipeline({ damage }, modifiers, input.context ?? { style: "melee" });
  const scaled = applyDamagePotential(state.damage, input.accuracy);
  return applyHitCap(Math.floor(scaled), input.cap ?? standardHitCap);
}

/**
 * Single hit: band roll -> modifier pipeline -> crit layer -> Damage Potential -> cap.
 * Crit runs as a second pass with the crit damage multiplier injected at the critical
 * stage, so crit-only modifiers see exactly one code path. The expected value treats
 * the band as uniform and modifiers as linear across it (documented approximation).
 */
export function calculateHit(input: HitInput): HitResult {
  const band = bandOf(input.base, input.band);
  const p = critProbability(input.crit);
  const critMult = p > 0 ? baseCritDamageMultiplier(input.level, input.crit.damageBonus ?? 0) : null;

  const min = runPass(band.min, null, input);
  const max = runPass(band.max, null, input);
  const critMin = critMult === null ? min : runPass(band.min, critMult, input);
  const critMax = critMult === null ? max : runPass(band.max, critMult, input);

  return {
    potential: damagePotential(input.accuracy),
    min,
    max,
    critMin,
    critMax,
    critChance: p,
    expected: (1 - p) * ((min + max) / 2) + p * ((critMin + critMax) / 2),
  };
}
