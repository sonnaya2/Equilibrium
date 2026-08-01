import type { CritLayers } from "../../core/critical";
import { calculateHit } from "../../pipeline/calculateHit";
import {
  LIGHTNING_SURGE_BAND,
  lightningSurgeExpected,
  sunshineActive,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_SOURCE,
} from "../../styles/magic/effects";
import type { CombatModifier } from "../../types";
import type { SimulationRuntime } from "../runtime/runtime";
import { buffMultiplier } from "./modifiers";
import { NO_DAMAGE, type EventResolution } from "./types";

/**
 * Resolve an Instability Lightning Surge proc at its own land tick: EV = the
 * source hit's crit chance (from its landed detail) × the surge hit's expected,
 * recomputed against land-time state. min/max stay 0 — the surge is EV-only,
 * and it is never itself proc-eligible, so it cannot chain another surge.
 */
export function resolveLightningSurge(
  rt: SimulationRuntime,
  at: number,
  sourceSeq: number,
  castSeq: number,
  critLayers: CritLayers,
  baseMods: CombatModifier[],
): EventResolution {
  const { input, state } = rt;
  const sourceCritChance = rt.hitDetails.get(sourceSeq)?.critChance ?? 0;
  if (sourceCritChance <= 0) return NO_DAMAGE;
  const modifiers = [...baseMods];
  if (state.magic.sunshine.grantedByCast !== castSeq && sunshineActive(state.magic.sunshine, at)) {
    modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
  }
  const surgeHit = calculateHit({
    base: input.base,
    band: LIGHTNING_SURGE_BAND,
    level: input.level,
    accuracy: input.accuracy,
    crit: { ...critLayers, eligible: true },
    modifiers,
    context: input.context,
    cap: input.cap,
  });
  return {
    damage: {
      min: 0,
      max: 0,
      expected: lightningSurgeExpected(sourceCritChance, surgeHit.expected),
    },
  };
}
