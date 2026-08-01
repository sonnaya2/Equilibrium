import type { AbilitySpec } from "../pipeline/calculateAbility";
import { isMagicAbility } from "../styles/magic/abilities";
import { animaCharged } from "../styles/magic/runicCharge";
import { necroCanCast } from "../styles/necromancy/effects";
import { castOutcomes, mergeBranches, type Branch } from "./branch";
import { costOf } from "./cast";
import { createRuntime } from "./runtime";
import { firstLegalTick } from "./state";
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
 */
export function simulateRevolution(
  input: RevolutionInput,
  options?: SimulateOptions,
): RotationSummary {
  let branches: Branch[] = [
    { weight: 1, rt: createRuntime({ ...input, horizonTicks: input.durationTicks }) },
  ];
  let sawBranching = false;
  let guard = 0;
  const maxCasts = Math.max(input.durationTicks * 2, 64);

  for (;;) {
    const anyActive = branches.some((b) => b.error === undefined && b.rt.state.tick < input.durationTicks);
    if (!anyActive) break;
    if (++guard > maxCasts) {
      branches = branches.map((b) =>
        b.error !== undefined || b.rt.state.tick >= input.durationTicks
          ? b
          : { ...b, error: `revolution stalled at tick ${b.rt.state.tick}: cast guard exceeded` },
      );
      break;
    }

    const next: Branch[] = [];
    for (const branch of branches) {
      if (branch.error !== undefined || branch.rt.state.tick >= input.durationTicks) {
        next.push(branch);
        continue;
      }
      const state = branch.rt.state;
      const ready = input.bar.find((ability) => {
        if (
          isMagicAbility(ability) &&
          ability.requiresAnima &&
          !animaCharged(state.magic, state.tick)
        )
          return false;
        if (!necroCanCast(ability, state.necro, state.conjures, state.tick)) return false;
        return (
          firstLegalTick(state, ability.id) <= state.tick &&
          costOf(branch.rt, ability) <= state.adrenaline
        );
      });
      // Basics fill every empty GCD when the bar has nothing ready/affordable.
      const basic = ready ? undefined : branch.rt.basicByStyle.get(input.style);
      const ability = ready ?? basic;
      if (!ability) {
        next.push({
          ...branch,
          error: `revolution stalled at tick ${state.tick}: no bar ability ready and no basic for ${input.style}`,
        });
        continue;
      }
      next.push(...castOutcomes(branch, ability, state.tick, ready === undefined));
    }
    sawBranching ||= next.length > 1;
    branches = mergeBranches(next);
  }

  return combineBranchSummaries(branches, input.durationTicks, options, sawBranching);
}
