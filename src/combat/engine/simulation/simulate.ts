import { runicChargeReady } from "../../styles/magic/runicCharge";
import type { AbilitySpec } from "../../pipeline/calculateAbility";

export type {
  AdrenalineRules,
  ProcRules,
  SimulateInput,
  SimulateOptions,
  CastRecord,
  RotationSummary,
  CastAttempt,
  CastContext,
  CastContextInput,
  CastRng,
} from "./contracts";
import type { RotationSummary, SimulateInput, SimulateOptions } from "./contracts";
import {
  materializeCastPlans,
  mergeAndCapBranches,
  planCastOutcomes,
  type Branch,
  type CastOutcomePlan,
} from "./branch";
import { castRejection, permanentCastBlock } from "../cast/rules";
import { performOffGcdCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTick } from "../runtime/state";
import { combineBranchSummaries } from "./summary";

export { createCastContext } from "./context";

const MAX_AUTO_WEAVE_CASTS = 400;

interface ManualStep {
  branches: Branch[];
  branched: boolean;
}

/**
 * One queued action (plus auto-weave) across the live branches. Weaving and
 * the cast itself plan state-changing RNG first, then materialize only the
 * heaviest survivors so Impatient/Relentless/Avernic do not pay full commits
 * for paths the live-branch cap would discard immediately.
 */
function stepManualAction(
  branch: Branch,
  ability: AbilitySpec,
  autoWeave: boolean | undefined,
): ManualStep {
  if (branch.error !== undefined) return { branches: [branch], branched: false };
  if (ability.stateEffect === "runic_charge") {
    if (!runicChargeReady(branch.rt.state.magic.runicCharge, branch.rt.state.tick)) {
      return {
        branches: [
          { ...branch, error: `runic_charge is on cooldown at tick ${branch.rt.state.tick}` },
        ],
        branched: false,
      };
    }
    performOffGcdCast(branch.rt, ability);
    return { branches: [branch], branched: false };
  }

  let work: Branch[] = [branch];
  let branched = false;
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
        const castable =
          firstLegalTick(
            current.rt.state,
            ability.id,
            ability.cooldownGroup ?? ability.replacementGroup,
          ) <= current.rt.state.tick &&
          castRejection(
            current.rt.state,
            ability,
            current.rt.state.tick,
            current.rt.input.weaponConfiguration,
            current.rt.input.equipmentIds,
            current.rt.input.equipmentEffects?.passiveIds,
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
        const planned = planCastOutcomes(current, basic, current.rt.state.tick, true);
        if ("error" in planned) {
          done.push(planned.error);
          continue;
        }
        if (planned.plans.length > 1) branched = true;
        plans.push(...planned.plans);
      }
      const advanced = materializeCastPlans(plans);
      branched ||= advanced.length > 1;
      pending = mergeAndCapBranches(advanced);
    }
    work = mergeAndCapBranches(done);
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
      firstLegalTick(woven.rt.state, ability.id, ability.cooldownGroup ?? ability.replacementGroup),
      false,
    );
    if ("error" in planned) {
      carried.push(planned.error);
      continue;
    }
    if (planned.plans.length > 1) branched = true;
    plans.push(...planned.plans);
  }
  const advanced = materializeCastPlans(plans);
  branched ||= advanced.length > 1;
  return { branches: mergeAndCapBranches([...carried, ...advanced]), branched };
}

/**
 * Deterministic expected-value run with probability-weighted branching at
 * state-changing RNG points; unpayable casts fail their branch, and the
 * summary surfaces the failed weight instead of smoothing it away.
 */
export function simulate(input: SimulateInput, options?: SimulateOptions): RotationSummary {
  let branches: Branch[] = [{ weight: 1, rt: createRuntime(input) }];
  let sawBranching = false;
  const selectedGroups = new Map<string, string>();
  for (const action of input.rotation) {
    const ability = branches[0]!.rt.byId.get(action.abilityId);
    if (!ability?.replacementGroup) continue;
    const existing = selectedGroups.get(ability.replacementGroup);
    if (existing && existing !== ability.id) {
      branches[0]!.error = `${existing} and ${ability.id} are mutually exclusive variants`;
      return combineBranchSummaries(branches, undefined, options, false);
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
    // once - not once per parent (which would expand 64×8 commits before cap).
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
          firstLegalTick(
            branch.rt.state,
            ability.id,
            ability.cooldownGroup ?? ability.replacementGroup,
          ),
          false,
        );
        if ("error" in planned) {
          carried.push(planned.error);
          continue;
        }
        if (planned.plans.length > 1) branched = true;
        plans.push(...planned.plans);
      }
      const advanced = materializeCastPlans(plans);
      sawBranching ||= branched || advanced.length > 1;
      branches = mergeAndCapBranches([...carried, ...advanced]);
      continue;
    }
    const next: Branch[] = [];
    for (const branch of branches) {
      const step = stepManualAction(branch, ability, input.autoWeave);
      next.push(...step.branches);
      sawBranching ||= step.branched;
    }
    branches = mergeAndCapBranches(next);
  }

  return combineBranchSummaries(branches, undefined, options, sawBranching);
}
