import { runicChargeReady } from "../../styles/magic/runicCharge";
import type { AbilitySpec } from "../../pipeline/calculateAbility";

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
import {
  appendWithIntermediateCap,
  branchCapsFromBudget,
  combineExactness,
  materializeCastPlans,
  mergeAndCapBranches,
  planCastOutcomes,
  type Branch,
  type BranchExactness,
  type CastOutcomePlan,
} from "./branch";
import {
  castRejection,
  permanentCastBlock,
  resolveCastAbility,
} from "../cast/rules";
import { performOffGcdCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTickFor } from "../runtime/state";
import { combineBranchSummaries } from "./summary";

export { createCastContext } from "./context";
export type { BranchBudget } from "./contracts";
export { defaultBranchBudget, resolveBranchBudget, branchCapsFromBudget } from "./branch";

const MAX_AUTO_WEAVE_CASTS = 400;

interface ManualStep {
  branches: Branch[];
  branched: boolean;
  residualWeight: number;
  exactness: BranchExactness;
}

/**
 * One queued action (plus auto-weave) across the live branches. Weaving and
 * the cast itself plan state-changing RNG first, then materialize only the
 * heaviest survivors so Impatient/Relentless/Avernic do not pay full commits
 * for paths the live-branch cap would discard immediately.
 * Discarded mass is residual, never folded into a non-equivalent survivor.
 */
function stepManualAction(
  branch: Branch,
  ability: AbilitySpec,
  autoWeave: boolean | undefined,
  maxLive: number,
  intermediateMax: number,
): ManualStep {
  if (branch.error !== undefined) {
    return { branches: [branch], branched: false, residualWeight: 0, exactness: "exact" };
  }
  if (ability.stateEffect === "runic_charge") {
    if (!runicChargeReady(branch.rt.state.magic.runicCharge, branch.rt.state.tick)) {
      return {
        branches: [
          { ...branch, error: `runic_charge is on cooldown at tick ${branch.rt.state.tick}` },
        ],
        branched: false,
        residualWeight: 0,
        exactness: "exact",
      };
    }
    performOffGcdCast(branch.rt, ability);
    return { branches: [branch], branched: false, residualWeight: 0, exactness: "exact" };
  }

  let work: Branch[] = [branch];
  let branched = false;
  let residualWeight = 0;
  let exactness: BranchExactness = "exact";
  if (autoWeave) {
    // Weapon/equipment mismatch and cost > adren cap cannot be fixed by weaving.
    const permanent = permanentCastBlock(
      branch.rt.state,
      ability,
      branch.rt.input.weaponConfiguration,
      branch.rt.input.equipmentIds,
      branch.rt.input.equipmentEffects?.passiveIds,
    );
    if (permanent !== null) {
      return {
        branches: [{ ...branch, error: permanent }],
        branched: false,
        residualWeight: 0,
        exactness: "exact",
      };
    }

    const done: Branch[] = [];
    let pending: Branch[] = [branch];
    for (let weaveDepth = 0; pending.length > 0; weaveDepth++) {
      const plans: CastOutcomePlan[] = [];
      for (const current of pending) {
        if (current.error !== undefined) {
          done.push(current);
          continue;
        }
        const basic = current.rt.basicByStyle.get(ability.style);
        const { ability: castAbility } = resolveCastAbility(ability, {
          byId: current.rt.byId,
          weaponConfiguration: current.rt.input.weaponConfiguration,
          equipmentIds: current.rt.input.equipmentIds,
          passiveIds: current.rt.input.equipmentEffects?.passiveIds,
        });
        const castable =
          firstLegalTickFor(current.rt.state, castAbility, current.rt.input.level) <=
            current.rt.state.tick &&
          castRejection(
            current.rt.state,
            castAbility,
            current.rt.state.tick,
            current.rt.input.weaponConfiguration,
            current.rt.input.equipmentIds,
            current.rt.input.equipmentEffects?.passiveIds,
            current.rt.byId,
          ) === null;
        if (castable || !basic) {
          done.push(current);
          continue;
        }
        if (weaveDepth >= MAX_AUTO_WEAVE_CASTS) {
          done.push({
            ...current,
            error: `${ability.id} is unaffordable at tick ${current.rt.state.tick}, even weaving basics`,
          });
          continue;
        }
        const planned = planCastOutcomes(
          current,
          basic,
          current.rt.state.tick,
          true,
          maxLive,
          intermediateMax,
        );
        residualWeight += planned.residualWeight;
        exactness = combineExactness(exactness, planned.exactness);
        if (planned.plans.length > 1) branched = true;
        done.push(...planned.errors);
        plans.push(...planned.plans);
      }
      const advanced = materializeCastPlans(plans, maxLive, intermediateMax);
      residualWeight += advanced.residualWeight;
      exactness = combineExactness(exactness, advanced.exactness);
      branched ||= advanced.branches.length > 1;
      const pendingCap = mergeAndCapBranches(advanced.branches, maxLive);
      residualWeight += pendingCap.residualWeight;
      exactness = combineExactness(exactness, pendingCap.exactness);
      pending = pendingCap.branches;
    }
    const workCap = mergeAndCapBranches(done, maxLive);
    residualWeight += workCap.residualWeight;
    exactness = combineExactness(exactness, workCap.exactness);
    work = workCap.branches;
  }

  const carried: Branch[] = [];
  const plans: CastOutcomePlan[] = [];
  for (const woven of work) {
    if (woven.error !== undefined) {
      carried.push(woven);
      continue;
    }
    const planned = planCastOutcomes(
      woven,
      ability,
      firstLegalTickFor(woven.rt.state, ability, woven.rt.input.level),
      false,
      maxLive,
      intermediateMax,
    );
    residualWeight += planned.residualWeight;
    exactness = combineExactness(exactness, planned.exactness);
    if (planned.plans.length > 1) branched = true;
    carried.push(...planned.errors);
    plans.push(...planned.plans);
  }
  const advanced = materializeCastPlans(plans, maxLive, intermediateMax);
  residualWeight += advanced.residualWeight;
  exactness = combineExactness(exactness, advanced.exactness);
  branched ||= advanced.branches.length > 1;
  const capped = mergeAndCapBranches([...carried, ...advanced.branches], maxLive);
  residualWeight += capped.residualWeight;
  exactness = combineExactness(exactness, capped.exactness);
  return { branches: capped.branches, branched, residualWeight, exactness };
}

/**
 * Deterministic expected-value run with probability-weighted branching at
 * state-changing RNG points; unpayable casts fail their branch, and the
 * summary surfaces the failed weight instead of smoothing it away.
 */
export function simulate(input: SimulateInput, options?: SimulateOptions): RotationSummary {
  const { maxLive, intermediateMax } = branchCapsFromBudget(options?.branchBudget);
  let branches: Branch[] = [
    { weight: 1, rt: createRuntime({ ...input, detailLevel: options?.detailLevel }) },
  ];
  let sawBranching = false;
  let residualWeight = 0;
  let exactness: BranchExactness = "exact";
  const selectedGroups = new Map<string, string>();
  for (const action of input.rotation) {
    const ability = branches[0]!.rt.byId.get(action.abilityId);
    if (!ability?.replacementGroup) continue;
    const existing = selectedGroups.get(ability.replacementGroup);
    if (existing && existing !== ability.id) {
      branches[0]!.error = `${existing} and ${ability.id} are mutually exclusive variants`;
      return combineBranchSummaries(branches, undefined, options, false, residualWeight);
    }
    selectedGroups.set(ability.replacementGroup, ability.id);
  }

  for (const action of input.rotation) {
    const ability = branches[0]!.rt.byId.get(action.abilityId);
    if (!ability) {
      branches = branches.map((branch) => ({
        ...branch,
        error: branch.error ?? `unknown ability: ${action.abilityId}`,
      }));
      break;
    }
    // Plan every live branch's cast, then materialize under the live-branch cap
    // once - not once per parent (which would expand 64x8 commits before cap).
    if (!input.autoWeave && ability.stateEffect !== "runic_charge") {
      const carried: Branch[] = [];
      const plans: CastOutcomePlan[] = [];
      let branched = false;
      for (const branch of branches) {
        if (branch.error !== undefined) {
          carried.push(branch);
          continue;
        }
        const planned = planCastOutcomes(
          branch,
          ability,
          firstLegalTickFor(branch.rt.state, ability, branch.rt.input.level),
          false,
          maxLive,
          intermediateMax,
        );
        residualWeight += planned.residualWeight;
        exactness = combineExactness(exactness, planned.exactness);
        if (planned.plans.length > 1) branched = true;
        carried.push(...planned.errors);
        plans.push(...planned.plans);
      }
      const advanced = materializeCastPlans(plans, maxLive, intermediateMax);
      residualWeight += advanced.residualWeight;
      exactness = combineExactness(exactness, advanced.exactness);
      sawBranching ||= branched || advanced.branches.length > 1;
      const capped = mergeAndCapBranches([...carried, ...advanced.branches], maxLive);
      residualWeight += capped.residualWeight;
      exactness = combineExactness(exactness, capped.exactness);
      branches = capped.branches;
      continue;
    }
    let next: Branch[] = [];
    for (const branch of branches) {
      const step = stepManualAction(branch, ability, input.autoWeave, maxLive, intermediateMax);
      const folded = appendWithIntermediateCap(next, step.branches, maxLive);
      residualWeight += step.residualWeight + folded.residualWeight;
      exactness = combineExactness(exactness, step.exactness);
      exactness = combineExactness(exactness, folded.exactness);
      next = folded.branches;
      sawBranching ||= step.branched;
    }
    const capped = mergeAndCapBranches(next, maxLive);
    residualWeight += capped.residualWeight;
    exactness = combineExactness(exactness, capped.exactness);
    branches = capped.branches;
  }

  return combineBranchSummaries(
    branches,
    undefined,
    options,
    sawBranching,
    residualWeight,
    exactness,
  );
}
