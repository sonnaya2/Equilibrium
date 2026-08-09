import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { runicChargeReady } from "../../styles/magic/runicCharge";
import { performCast, performOffGcdCast } from "../cast";
import { castRejection, permanentCastBlock, resolveCastAbility } from "../cast/rules";
import { runWithHitReuseScope } from "../resolution/hitReuse";
import {
  createRuntime,
  createRuntimeSharedCaches,
  prepareRuntimeInput,
  type RuntimeSharedCaches,
} from "../runtime/runtime";
import { stochasticLaneCount } from "../runtime/stochastic";
import { firstLegalTickFor } from "../runtime/state";
import { combineStochasticSummaries, type StochasticLane } from "./summary";

export type {
  AdrenalineRules,
  ProcRules,
  SimulateInput,
  SimulateOptions,
  SimulationDetailLevel,
  CastRecord,
  RotationSummary,
  CastAttempt,
  CastContext,
  CastContextInput,
  CastRng,
} from "./contracts";
export {
  resolveDetailLevel,
  keepsPresentationHistory,
  keepsAnalysisLedgers,
  keepsPerAbilityMap,
  DEFAULT_SIMULATION_DETAIL_LEVEL,
} from "./contracts";
import type { RotationSummary, SimulateInput, SimulateOptions } from "./contracts";

export { createCastContext } from "./context";

const MAX_AUTO_WEAVE_CASTS = 400;

function castableNow(rt: StochasticLane["rt"], ability: AbilitySpec): boolean {
  const { ability: castAbility } = resolveCastAbility(ability, {
    byId: rt.byId,
    weaponConfiguration: rt.input.weaponConfiguration,
    equipmentIds: rt.input.equipmentIds,
    passiveIds: rt.input.equipmentEffects?.passiveIds,
    league: rt.input.league,
    activeWeapon: rt.input.equipmentEffects?.activeWeapon,
  });
  return (
    firstLegalTickFor(rt.state, castAbility, rt.input.level) <= rt.state.tick &&
    castRejection(
      rt.state,
      castAbility,
      rt.state.tick,
      rt.input.weaponConfiguration,
      rt.input.equipmentIds,
      rt.input.equipmentEffects?.passiveIds,
      rt.byId,
      rt.input.league,
      rt.input.equipmentEffects?.activeWeapon,
    ) === null
  );
}

function runManualLane(
  input: SimulateInput,
  options: SimulateOptions | undefined,
  laneIndex: number,
  laneCount: number,
  sharedCaches: RuntimeSharedCaches,
): StochasticLane {
  const rt = createRuntime(
    input,
    { laneIndex, laneCount, seed: options?.stochasticSeed },
    sharedCaches,
  );
  const lane: StochasticLane = { weight: 1 / laneCount, rt };
  const selectedGroups = new Map<string, string>();
  for (const action of input.rotation) {
    const ability = rt.byId.get(action.abilityId);
    if (!ability?.replacementGroup) continue;
    const existing = selectedGroups.get(ability.replacementGroup);
    if (existing && existing !== ability.id) {
      lane.error = `${existing} and ${ability.id} are mutually exclusive variants`;
      return lane;
    }
    selectedGroups.set(ability.replacementGroup, ability.id);
  }

  for (const action of input.rotation) {
    if (rt.horizon !== undefined && rt.state.tick >= rt.horizon) break;
    const ability = rt.byId.get(action.abilityId);
    if (!ability) {
      lane.error = `unknown ability: ${action.abilityId}`;
      break;
    }
    if (ability.stateEffect === "runic_charge") {
      if (!runicChargeReady(rt.state.magic.runicCharge, rt.state.tick)) {
        lane.error = `runic_charge is on cooldown at tick ${rt.state.tick}`;
        break;
      }
      performOffGcdCast(rt, ability);
      continue;
    }

    if (input.autoWeave) {
      const permanent = permanentCastBlock(
        rt.state,
        ability,
        rt.input.weaponConfiguration,
        rt.input.equipmentIds,
        rt.input.equipmentEffects?.passiveIds,
        rt.byId,
        rt.input.league,
        rt.input.equipmentEffects?.activeWeapon,
      );
      if (permanent !== null) {
        lane.error = permanent;
        break;
      }
      let weaveCount = 0;
      while (!castableNow(rt, ability)) {
        if (rt.horizon !== undefined && rt.state.tick >= rt.horizon) break;
        if (++weaveCount > MAX_AUTO_WEAVE_CASTS) {
          lane.error = `${ability.id} is unaffordable at tick ${rt.state.tick}, even weaving basics`;
          break;
        }
        const basic = rt.basicByStyle.get(ability.style);
        if (!basic) break;
        const basicAttempt = performCast(rt, basic, rt.state.tick, true);
        if (!basicAttempt.ok) {
          lane.error = basicAttempt.error;
          break;
        }
      }
      if (lane.error || (rt.horizon !== undefined && rt.state.tick >= rt.horizon)) break;
    }

    const castTick = firstLegalTickFor(rt.state, ability, rt.input.level);
    if (rt.horizon !== undefined && castTick >= rt.horizon) break;
    const attempt = performCast(rt, ability, castTick, false);
    if (!attempt.ok) {
      lane.error = attempt.error;
      break;
    }
  }
  return lane;
}

export function simulate(input: SimulateInput, options?: SimulateOptions): RotationSummary {
  const laneCount = stochasticLaneCount(
    input,
    input.rotation.map((action) => action.abilityId),
    options?.stochasticLanes,
  );
  const runtimeInput = prepareRuntimeInput({ ...input, detailLevel: options?.detailLevel });
  const sharedCaches = createRuntimeSharedCaches();
  return runWithHitReuseScope(() => {
    const lanes = Array.from({ length: laneCount }, (_, laneIndex) =>
      runManualLane(runtimeInput, options, laneIndex, laneCount, sharedCaches),
    );
    return combineStochasticSummaries(lanes, input.horizonTicks, options);
  });
}
