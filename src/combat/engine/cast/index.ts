import type { AbilityResult, AbilitySpec } from "../../pipeline/calculateAbility";
import { activateRunicCharge } from "../../styles/magic/runicCharge";
import { castRejection, candidateTick } from "./rules";
import { scheduleCastEvents } from "./schedule";
import { applyCastEffects, applyCompletionEffects, castEffectContext } from "./effects";
import { prepareCast, type PreparedCast } from "./prepare";
import { advanceTo } from "../runtime/clock";
import { firstLegalTick } from "../runtime/state";
import type { CastAttempt, CastRng } from "../simulation/contracts";
import type { CastRecord } from "../simulation/contracts";
import type { SimulationRuntime } from "../runtime/runtime";
import { patchMagic } from "../runtime/state";

const EMPTY_RESULT: AbilityResult = { hits: [], min: 0, max: 0, expected: 0, adrenalineDelta: 0 };

export { costOf, spendOf } from "./rules";
export type { PreparedCast } from "./prepare";

export type CastPreparation = { ok: true; prepared: PreparedCast } | { ok: false; error: string };

/**
 * Advance to the candidate tick and validate + prepare the cast there. A
 * rejection mutates nothing beyond the canonical time advance; preparation
 * itself is read-only. Drivers and the branch layer share this boundary so
 * readiness and affordability rules exist exactly once.
 */
export function prepareSimulationCast(
  rt: SimulationRuntime,
  ability: AbilitySpec,
  readyTick: number,
): CastPreparation {
  const candidate = Math.max(
    candidateTick(rt.state, readyTick),
    firstLegalTick(rt.state, ability.id, ability.cooldownGroup ?? ability.replacementGroup),
  );
  advanceTo(rt, candidate);
  const rejection = castRejection(
    rt.state,
    ability,
    candidate,
    rt.input.weaponConfiguration,
    rt.input.equipmentIds,
  );
  if (rejection) return { ok: false, error: rejection };
  return { ok: true, prepared: prepareCast(rt, ability, candidate) };
}

/**
 * Commit one prepared cast on a runtime: schedule its damage events, apply the
 * cast-start transitions, advance through occupancy (landing the channel's due
 * hits and passive generation), apply the transitions that needed a completed
 * channel, then record the cast.
 */
export function commitCast(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  auto: boolean,
  rng?: CastRng,
): void {
  const record = scheduleCastEvents(rt, prepared, auto);
  applyCastEffects(rt, prepared, rng);
  const completesAt = prepared.candidate + prepared.occupancyTicks;
  rt.endTick = Math.max(rt.endTick, completesAt);
  advanceTo(rt, completesAt);
  applyCompletionEffects(castEffectContext(rt, prepared, rng));
  record.adrenalineAfter = rt.state.adrenaline;
  record.refund = rng?.relentlessProc ? prepared.spend : 0;
  record.adrenalineGained =
    record.adrenalineAfter - record.adrenalineBefore + record.actualSpend - record.refund;
  rt.casts.push(record);
}

/** One atomic cast transition: prepare at the candidate tick, then commit. */
export function performCast(
  rt: SimulationRuntime,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
  rng?: CastRng,
): CastAttempt {
  const preparation = prepareSimulationCast(rt, ability, readyTick);
  if (!preparation.ok) return { ok: false, error: preparation.error };
  commitCast(rt, preparation.prepared, auto, rng);
  return { ok: true };
}

/** Off-GCD utility casts (Runic Charge): state-machine update and a cast record
 *  without consuming or advancing the global cooldown. */
export function performOffGcdCast(rt: SimulationRuntime, ability: AbilitySpec): void {
  rt.nextCastSeq++;
  if (ability.stateEffect === "runic_charge") {
    rt.state = patchMagic(rt.state, {
      runicCharge: activateRunicCharge(rt.state.magic.runicCharge, rt.state.tick),
    });
  }
  const record: CastRecord = {
    tick: rt.state.tick,
    abilityId: ability.id,
    result: EMPTY_RESULT,
    adrenalineAfter: rt.state.adrenaline,
    adrenalineBefore: rt.state.adrenaline,
    listedCost: ability.adrenaline?.cost ?? 0,
    effectiveCost: ability.adrenaline?.cost ?? 0,
    actualSpend: 0,
    refund: 0,
    adrenalineGained: 0,
  };
  rt.casts.push(record);
  rt.endTick = Math.max(rt.endTick, rt.state.tick + 1);
}
