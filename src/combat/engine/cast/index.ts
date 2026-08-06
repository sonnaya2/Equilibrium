import type { AbilityResult, AbilitySpec } from "../../pipeline/calculateAbility";
import { activateRunicCharge } from "../../styles/magic/runicCharge";
import { castRejection, candidateTick, resolveCastAbility } from "./rules";
import { scheduleCastEvents } from "./schedule";
import { applyCastEffects, applyCompletionEffects, castEffectContext } from "./effects";
import { prepareCast, type PreparedCast } from "./prepare";
import { advanceToBranches } from "../simulation/landBranch";
import { firstLegalTickFor } from "../runtime/state";
import type { CastAttempt, CastRng } from "../simulation/contracts";
import type { CastRecord } from "../simulation/contracts";
import type { SimulationRuntime } from "../runtime/runtime";
import { patchMagic } from "../runtime/state";
import { noteCastsGrowth } from "../../profiling/allocation";
import { planCastOutcomes, type BranchSet } from "../simulation/branch";
import { resolveIcyTempest } from "../../styles/melee/icyTempest";

function emptyAbilityResult(): AbilityResult {
  return { hits: [], min: 0, max: 0, expected: 0, listedAdrenalineDelta: 0, adrenalineDelta: 0 };
}

export { costOf, spendOf } from "./rules";
export type { PreparedCast } from "./prepare";

export type CastPreparation = { ok: true; prepared: PreparedCast } | { ok: false; error: string };

/**
 * Single-runtime spine: after non-Leng stochastic forks, keep the heaviest
 * arm on the caller's `rt` reference. Leng atoms stay coupled on that runtime;
 * mixed Icy Tempest spends use the branched context.
 */
function adoptHeaviestBranch(rt: SimulationRuntime, set: BranchSet): void {
  if (set.branches.length === 0) return;
  const heaviest = set.branches.reduce((a, b) => (a.weight >= b.weight ? a : b));
  if (heaviest.rt === rt) return;
  const src = heaviest.rt as unknown as Record<string, unknown>;
  const dst = rt as unknown as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    dst[key] = src[key];
  }
}

/**
 * Advance to candidate tick, then validate + prepare. Rejection only advances time;
 * prepareCast is read-only. Pre-cast uses advanceToBranches (sparse Leng atoms).
 *
 * Mixed Icy Tempest spend groups require the branched cast context.
 */
export function prepareSimulationCast(
  rt: SimulationRuntime,
  ability: AbilitySpec,
  readyTick: number,
): CastPreparation {
  const { ability: castAbility } = resolveCastAbility(ability, {
    byId: rt.byId,
    weaponConfiguration: rt.input.weaponConfiguration,
    equipmentIds: rt.input.equipmentIds,
    passiveIds: rt.input.equipmentEffects?.passiveIds,
  });
  const candidate = Math.max(
    candidateTick(rt.state, readyTick),
    firstLegalTickFor(rt.state, castAbility, rt.input.level),
  );
  const advanced = advanceToBranches({ weight: 1, rt }, candidate);
  adoptHeaviestBranch(rt, advanced);
  const rejection = castRejection(
    rt.state,
    castAbility,
    candidate,
    rt.input.weaponConfiguration,
    rt.input.equipmentIds,
    rt.input.equipmentEffects?.passiveIds,
    rt.byId,
  );
  if (rejection) return { ok: false, error: rejection };
  if (castAbility.id === "icy_tempest") {
    const resolved = resolveIcyTempest(
      rt.state.melee.primordialIce,
      candidate,
      rt.state.ringOfVigour,
    );
    if (resolved.outcomes.length > 1) {
      return { ok: false, error: "Icy Tempest mixed stack state requires a branched cast context" };
    }
  }
  return { ok: true, prepared: prepareCast(rt, castAbility, candidate) };
}

/**
 * Commit on one runtime; occupancy advances via advanceToBranches so Leng atoms
 * update on lands. Mixed Icy Tempest casts are handled by the branch planner.
 */
export function commitCast(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  auto: boolean,
  rng?: CastRng,
): void {
  const record = scheduleCastEvents(rt, prepared, auto);
  applyCastEffects(rt, prepared, rng);
  const tx = rt.lastCastAdrenalineTransaction;
  rt.lastCastAdrenalineTransaction = null;
  const completesAt = prepared.candidate + prepared.occupancyTicks;
  rt.endTick = Math.max(rt.endTick, completesAt);
  const advanced = advanceToBranches({ weight: 1, rt }, completesAt);
  adoptHeaviestBranch(rt, advanced);
  applyCompletionEffects(castEffectContext(rt, prepared, rng));
  record.adrenalineAfter = rt.state.adrenaline;

  if (tx) {
    record.adrenalineTransaction = tx;
    record.adrenalineAfterResources = tx.afterResources;
    record.effectiveCost = tx.effectiveCost;
    record.actualSpend = tx.actualSpend;
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

  noteCastsGrowth();
  if (!rt.casts.includes(record)) rt.casts.push(record);
}

/**
 * One atomic cast on a single runtime.
 *
 * A single runtime cannot represent mixed Icy Tempest spend groups without
 * inventing a representative arm; branched callers use planCastOutcomes.
 */
export function performCast(
  rt: SimulationRuntime,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
  rng?: CastRng,
): CastAttempt {
  const planned = planCastOutcomes({ weight: 1, rt }, ability, readyTick, auto);
  if (planned.plans.length === 0) {
    return {
      ok: false,
      error: planned.errors[0]?.error ?? `unable to cast ${ability.id}`,
    };
  }
  if (ability.id === "icy_tempest") {
    const outcomes = new Set(
      planned.plans.map((plan) =>
        JSON.stringify({
          spend: plan.prepared.spend,
          hits: plan.prepared.working.hits,
          next: plan.prepared.transitions.find(
            (transition) => transition.kind === "consumePrimordialIce",
          ),
        }),
      ),
    );
    if (outcomes.size > 1) {
      return { ok: false, error: "Icy Tempest mixed stack state requires a branched cast context" };
    }
  }
  // This single-runtime API has already rejected mixed Icy outcomes.
  const heaviest = planned.plans.reduce((a, b) => (a.weight >= b.weight ? a : b));
  // planCastOutcomes may have forked parent rts; adopt the heaviest parent first.
  if (heaviest.parent.rt !== rt) {
    adoptHeaviestBranch(rt, {
      branches: [heaviest.parent],
      residualWeight: 0,
      exactness: "exact",
    });
  }
  commitCast(rt, heaviest.prepared, auto, rng ?? heaviest.rng);
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
  noteCastsGrowth();
  rt.casts.push(record);
  rt.endTick = Math.max(rt.endTick, rt.state.tick + 1);
}
