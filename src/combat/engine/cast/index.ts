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

function emptyAbilityResult(): AbilityResult {
  return { hits: [], min: 0, max: 0, expected: 0, listedAdrenalineDelta: 0, adrenalineDelta: 0 };
}

export { costOf, spendOf } from "./rules";
export type { PreparedCast } from "./prepare";

export type CastPreparation = { ok: true; prepared: PreparedCast } | { ok: false; error: string };

/**
 * Advance to candidate tick, then validate + prepare. Rejection only advances time;
 * prepareCast is read-only. Shared by drivers and the branch layer.
 * Advance may use plain advanceTo; Leng expands on commitCastBranches paths.
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
 * Commit on one runtime with plain advanceTo (no Leng fork). Does not invent a
 * deterministic Leng outcome and does not write float E[stacks] (floor would bias
 * Icy Tempest spend/bands). Stack EV: createCastContext / castOutcomes / simulate.
 */
export function commitCast(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  auto: boolean,
  rng?: CastRng,
): void {
  const record = scheduleCastEvents(rt, prepared, auto);
  applyCastEffects(rt, prepared, rng);
  // Capture before clear; assignment-null first would narrow tx to never under tsc.
  const tx = rt.lastCastAdrenalineTransaction;
  rt.lastCastAdrenalineTransaction = null;
  const completesAt = prepared.candidate + prepared.occupancyTicks;
  rt.endTick = Math.max(rt.endTick, completesAt);
  advanceTo(rt, completesAt);
  applyCompletionEffects(castEffectContext(rt, prepared, rng));
  record.adrenalineAfter = rt.state.adrenaline;

  if (tx) {
    record.adrenalineTransaction = tx;
    record.adrenalineAfterResources = tx.afterResources;
    record.effectiveCost = tx.effectiveCost;
    record.actualSpend = tx.actualSpend;
    // Relentless prevented-spend only; CoE/RoV are grants on the transaction.
    record.refund = tx.spendPreventedBy === "relentless" ? tx.effectiveCost : 0;
    record.adrenalineGained =
      tx.totalAbilityGain +
      tx.otherImmediateGrants +
      tx.conservationOfEnergyRefund +
      tx.ringOfVigourRefund;
    const economyDelta =
      tx.totalAbilityGain +
      tx.otherImmediateGrants -
      tx.actualSpend +
      tx.conservationOfEnergyRefund +
      tx.ringOfVigourRefund;
    record.result = {
      ...record.result,
      listedAdrenalineDelta: tx.listedGain - tx.listedCost,
      adrenalineDelta: economyDelta,
    };
  }

  rt.casts.push(record);
}

/** One atomic cast on a single runtime (no Leng land fork). */
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
