import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { castRejection } from "../cast/rules";
import {
  materializeCastPlans,
  mergeAndCapBranches,
  planCastOutcomes,
  type Branch,
  type CastOutcomePlan,
} from "./branch";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTick } from "../runtime/state";
import type { RotationSummary, SimulateInput, SimulateOptions } from "./simulate";
import { combineBranchSummaries } from "./summary";

export interface RevolutionInput extends Omit<SimulateInput, "rotation" | "autoWeave"> {
  bar: readonly AbilitySpec[];
  style: AbilitySpec["style"];
  durationTicks: number;
}

/**
 * Revolution driver: the bar is scanned in priority order on every branch;
 * branches diverge at state-changing RNG points and merge when their futures
 * realign. Revolution completes channels — occupancy advances past the full
 * channel before the next scan.
 *
 * Casts are planned across the whole live set first, then only the heaviest
 * RNG outcomes are materialized (snapshot+commit). That applies the live-branch
 * cap before the expensive work, which matters when Impatient/Relentless/Avernic
 * would otherwise expand 64 parents into hundreds of full commits per GCD.
 */
export function simulateRevolution(
  input: RevolutionInput,
  options?: SimulateOptions,
): RotationSummary {
  let branches: Branch[] = [
    { weight: 1, rt: createRuntime({ ...input, horizonTicks: input.durationTicks }) },
  ];
  let sawBranching = false;
  const offGcd = input.bar.find((ability) => ability.offGcd);
  if (offGcd) {
    branches[0]!.error = `${offGcd.name} is off-GCD and cannot be placed on a Revolution bar; trigger it manually`;
    return combineBranchSummaries(branches, input.durationTicks, options, false);
  }
  const selectedGroups = new Map<string, string>();
  for (const ability of input.bar) {
    if (!ability.replacementGroup) continue;
    const existing = selectedGroups.get(ability.replacementGroup);
    if (existing && existing !== ability.id) {
      branches[0]!.error = `${existing} and ${ability.id} are mutually exclusive variants`;
      return combineBranchSummaries(branches, input.durationTicks, options, false);
    }
    selectedGroups.set(ability.replacementGroup, ability.id);
  }
  let guard = 0;
  const maxCasts = Math.max(input.durationTicks * 2, 64);

  for (;;) {
    const anyActive = branches.some(
      (b) => b.error === undefined && b.rt.state.tick < input.durationTicks,
    );
    if (!anyActive) break;
    if (++guard > maxCasts) {
      branches = branches.map((b) =>
        b.error !== undefined || b.rt.state.tick >= input.durationTicks
          ? b
          : { ...b, error: `revolution stalled at tick ${b.rt.state.tick}: cast guard exceeded` },
      );
      break;
    }

    const carried: Branch[] = [];
    const plans: CastOutcomePlan[] = [];
    for (const branch of branches) {
      if (branch.error !== undefined || branch.rt.state.tick >= input.durationTicks) {
        carried.push(branch);
        continue;
      }
      const state = branch.rt.state;
      const ready = input.bar.find(
        (ability) =>
          firstLegalTick(state, ability.id, ability.cooldownGroup ?? ability.replacementGroup) <=
            state.tick &&
          castRejection(
            state,
            ability,
            state.tick,
            input.weaponConfiguration,
            input.equipmentIds,
            input.equipmentEffects?.passiveIds,
          ) === null,
      );
      // Basics fill every empty GCD when the bar has nothing ready/affordable.
      const basic = ready ? undefined : branch.rt.basicByStyle.get(input.style);
      const ability = ready ?? basic;
      if (!ability) {
        carried.push({
          ...branch,
          error: `revolution stalled at tick ${state.tick}: no bar ability ready and no basic for ${input.style}`,
        });
        continue;
      }
      const planned = planCastOutcomes(branch, ability, state.tick, ready === undefined);
      if ("error" in planned) {
        carried.push(planned.error);
        continue;
      }
      if (planned.plans.length > 1) sawBranching = true;
      plans.push(...planned.plans);
    }

    const advanced = materializeCastPlans(plans);
    sawBranching ||= advanced.length > 1;
    branches = mergeAndCapBranches([...carried, ...advanced]);
  }

  return combineBranchSummaries(branches, input.durationTicks, options, sawBranching);
}
