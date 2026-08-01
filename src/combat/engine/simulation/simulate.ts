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

/**
 * One queued action (plus auto-weave) across the live branches. Weaving and
 * the cast itself go through castOutcomes, so state-changing RNG (Impatient /
 * Relentless) splits the branch set instead of spending impossible averages.
 */
function stepManualAction(
  branch: Branch,
  ability: AbilitySpec,
  autoWeave: boolean | undefined,
): Branch[] {
  if (branch.error !== undefined) return [branch];
  if (ability.stateEffect === "runic_charge") {
    if (!runicChargeReady(branch.rt.state.magic, branch.rt.state.tick)) {
      return [{ ...branch, error: `runic_charge is on cooldown at tick ${branch.rt.state.tick}` }];
    }
    performOffGcdCast(branch.rt, ability);
    return [branch];
  }

  let work: Branch[] = [branch];
  if (autoWeave) {
    const done: Branch[] = [];
    const pending: Branch[] = [branch];
    let guard = 0;
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current.error !== undefined) {
        done.push(current);
        continue;
      }
      const basic = current.rt.basicByStyle.get(ability.style);
      const castable =
        firstLegalTick(current.rt.state, ability.id) <= current.rt.state.tick &&
        castRejection(current.rt.state, ability, current.rt.state.tick) === null;
      if (castable || !basic) {
        done.push(current);
        continue;
      }
      if (++guard > 400) {
        done.push({
          ...current,
          error: `${ability.id} is unaffordable at tick ${current.rt.state.tick}, even weaving basics`,
        });
        continue;
      }
      pending.push(...castOutcomes(current, basic, current.rt.state.tick, true));
    }
    work = mergeBranches(done);
  }

  const out: Branch[] = [];
  for (const woven of work) {
    if (woven.error !== undefined) {
      out.push(woven);
      continue;
    }
    out.push(...castOutcomes(woven, ability, firstLegalTick(woven.rt.state, ability.id), false));
  }
  return out;
}

/**
 * Deterministic expected-value run with probability-weighted branching at
 * state-changing RNG points; unpayable casts fail their branch, and the
 * summary surfaces the failed weight instead of smoothing it away.
 */
export function simulate(input: SimulateInput, options?: SimulateOptions): RotationSummary {
  let branches: Branch[] = [{ weight: 1, rt: createRuntime(input) }];
  let sawBranching = false;

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
      next.push(...stepManualAction(branch, ability, input.autoWeave));
    }
    sawBranching ||= next.length > 1;
    branches = mergeBranches(next);
  }

  return combineBranchSummaries(branches, undefined, options, sawBranching);
}
