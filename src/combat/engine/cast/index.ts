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
import { rngProc } from "../simulation/contracts";

function emptyAbilityResult(): AbilityResult {
  return { hits: [], min: 0, max: 0, expected: 0, adrenalineDelta: 0 };
}

export { costOf, spendOf } from "./rules";
export type { PreparedCast } from "./prepare";

export type CastPreparation = { ok: true; prepared: PreparedCast } | { ok: false; error: string };

/**
 * Advance to candidate tick, then validate + prepare. Rejection only advances time;
 * prepareCast is read-only. Shared by drivers and the branch layer.
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
    rt.input.equipmentEffects?.passiveIds,
  );
  if (rejection) return { ok: false, error: rejection };
  return { ok: true, prepared: prepareCast(rt, ability, candidate) };
}

/**
 * Commit a prepared cast: schedule damage, cast-start effects, advance occupancy
 * (channel hits + passive gen), completion effects, then record.
 */
export function commitCast(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  auto: boolean,
  rng?: CastRng,
): void {
  const record = scheduleCastEvents(rt, prepared, auto);
  const adrenBefore = rt.state.adrenaline;
  applyCastEffects(rt, prepared, rng);
  // Ability-economy snapshot after resources (FotS / spend / CoE / RoV / Relentless).
  const adrenAfterResources = rt.state.adrenaline;
  const completesAt = prepared.candidate + prepared.occupancyTicks;
  rt.endTick = Math.max(rt.endTick, completesAt);
  advanceTo(rt, completesAt);
  applyCompletionEffects(castEffectContext(rt, prepared, rng));
  record.adrenalineAfter = rt.state.adrenaline;
  // Relentless: spend skipped when proc + rank + off lockout (resources already applied).
  const relentlessRefund =
    rngProc(rng, "relentless") &&
    prepared.spend > 0 &&
    (rt.input.adrenaline?.relentlessRank ?? 0) > 0
      ? prepared.spend
      : 0;
  // Ultimate retain (CoE + RoV) is a post-spend grant, not Relentless.
  const ultimateRefund = Math.max(0, adrenAfterResources - (adrenBefore - prepared.spend + (relentlessRefund > 0 ? prepared.spend : 0)));
  // Prefer explicit fields when Relentless fired (spend not taken).
  record.refund = relentlessRefund;
  record.adrenalineGained =
    record.adrenalineAfter - record.adrenalineBefore + record.actualSpend - record.refund;
  // Listed delta ignored economy; overwrite with measured ability-phase change.
  record.result = {
    ...record.result,
    adrenalineDelta: adrenAfterResources - adrenBefore,
  };
  void ultimateRefund; // measured via adrenalineDelta / after state
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
    result: emptyAbilityResult(),
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
