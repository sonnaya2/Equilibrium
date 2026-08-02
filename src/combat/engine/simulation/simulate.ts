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
import { castOutcomes, mergeBranches, type Branch } from "./branch";
import { castRejection } from "../cast/rules";
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
 * the cast itself go through castOutcomes, so state-changing RNG (Impatient /
 * Relentless) splits the branch set instead of spending impossible averages.
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
    const done: Branch[] = [];
    let pending: Branch[] = [branch];
    for (let weaveDepth = 0; pending.length > 0; weaveDepth++) {
      const next: Branch[] = [];
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
        const outcomes = castOutcomes(current, basic, current.rt.state.tick, true);
        branched ||= outcomes.length > 1;
        next.push(...outcomes);
      }
      pending = mergeBranches(next);
    }
    work = mergeBranches(done);
  }

  const out: Branch[] = [];
  for (const woven of work) {
    if (woven.error !== undefined) {
      out.push(woven);
      continue;
    }
    const outcomes = castOutcomes(
      woven,
      ability,
      firstLegalTick(woven.rt.state, ability.id, ability.cooldownGroup ?? ability.replacementGroup),
      false,
    );
    branched ||= outcomes.length > 1;
    out.push(...outcomes);
  }
  return { branches: out, branched };
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
    const next: Branch[] = [];
    for (const branch of branches) {
      const step = stepManualAction(branch, ability, input.autoWeave);
      next.push(...step.branches);
      sawBranching ||= step.branched;
    }
    branches = mergeBranches(next);
  }

  return combineBranchSummaries(branches, undefined, options, sawBranching);
}
