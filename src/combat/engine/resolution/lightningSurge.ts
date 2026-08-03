import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { calculateHit } from "../../pipeline/calculateHit";
import {
  LIGHTNING_SURGE_BAND,
  lightningSurgeExpected,
  tumekensSunshineCritChance,
} from "../../styles/magic/effects";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";
import { landTimeModifiers } from "./modifiers";
import { NO_DAMAGE, type EventResolution } from "./types";

/**
 * Resolve an Instability Lightning Surge proc at its own land tick: EV = the
 * source hit's crit chance (from its landed detail) × the surge hit's expected,
 * recomputed against land-time state. min/max stay 0 - the surge is EV-only,
 * and it is never itself proc-eligible, so it cannot chain another surge.

 * Modifiers match parent hits via landTimeModifiers (Am-Zi, Am-Hej, Sunshine
 * self-exclusion, Chaos Roar, etc.) - never a hand-copied subset.
 */
export function resolveLightningSurge(
  rt: SimulationRuntime,
  at: number,
  sourceSeq: number,
  ability: AbilitySpec,
  snap: CastSnapshot,
  hitIndex = 0,
): EventResolution {
  const { input, state } = rt;
  const sourceCritChance = rt.hitDetails.get(sourceSeq)?.critChance ?? 0;
  if (sourceCritChance <= 0) return NO_DAMAGE;
  const modifiers = landTimeModifiers(rt, at, ability, snap, hitIndex, false);
  const { critLayers } = snap;
  // Equipment proc: never onHitGear (Slayer/Salve). Not recursive proc-eligible.
  const provenance = { kind: "equipment_proc" as const, detail: "lightning_surge" };
  const surgeHit = calculateHit({
    base: input.base,
    band: LIGHTNING_SURGE_BAND,
    level: input.level,
    accuracy: input.accuracy,
    crit: {
      ...critLayers,
      chance:
        critLayers.chance +
        (input.tumekensCritEnabled === false
          ? 0
          : tumekensSunshineCritChance(
              input.tumekensPieces ?? 0,
              state.magic.sunshine,
              at,
              snap.castSeq,
            )),
      eligible: true,
    },
    modifiers,
    provenance,
    context: {
      ...input.context,
      style: input.context?.style ?? ability.style,
      damageSource: "proc",
      provenance,
    },
    cap: input.cap,
  });
  return {
    damage: {
      min: 0,
      max: 0,
      expected: lightningSurgeExpected(sourceCritChance, surgeHit.expected),
      capLoss: lightningSurgeExpected(sourceCritChance, surgeHit.capLoss),
    },
  };
}
