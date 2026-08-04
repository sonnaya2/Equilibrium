import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { castRejection } from "../cast/rules";
import {
  combineExactness,
  materializeCastPlans,
  mergeAndCapBranches,
  planCastOutcomes,
  type Branch,
  type BranchExactness,
  type CastOutcomePlan,
} from "./branch";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTick } from "../runtime/state";
import type { CastRecord, RotationSummary, SimulateInput, SimulateOptions } from "./simulate";
import { combineBranchSummaries } from "./summary";

export interface RevolutionInput extends Omit<SimulateInput, "rotation" | "autoWeave"> {
  bar: readonly AbilitySpec[];
  style: AbilitySpec["style"];
  durationTicks: number;
}

/**
 * Revolution driver: the bar is scanned in priority order on every branch;
 * branches diverge at state-changing RNG points and merge when their futures
 * realign. Revolution completes channels - occupancy advances past the full
 * channel before the next scan.

 * Casts are planned across the whole live set first, then only the heaviest
 * RNG outcomes are materialized (snapshot+commit). That applies the live-branch
 * cap before the expensive work, which matters when Impatient/Relentless/Avernic
 * would otherwise expand 64 parents into hundreds of full commits per GCD.
 * Discarded cap mass accumulates as residual; it is never folded into a survivor.
 */
export function simulateRevolution(
  input: RevolutionInput,
  options?: SimulateOptions,
): RotationSummary {
  let branches: Branch[] = [
    { weight: 1, rt: createRuntime({ ...input, horizonTicks: input.durationTicks }) },
  ];
  let sawBranching = false;
  let residualWeight = 0;
  let exactness: BranchExactness = "exact";
  const offGcd = input.bar.find((ability) => ability.offGcd);
  if (offGcd) {
    branches[0]!.error = `${offGcd.name} is off-GCD and cannot be placed on a Revolution bar; trigger it manually`;
    return combineBranchSummaries(branches, input.durationTicks, options, false, 0, "exact");
  }
  const selectedGroups = new Map<string, string>();
  for (const ability of input.bar) {
    if (!ability.replacementGroup) continue;
    const existing = selectedGroups.get(ability.replacementGroup);
    if (existing && existing !== ability.id) {
      branches[0]!.error = `${existing} and ${ability.id} are mutually exclusive variants`;
      return combineBranchSummaries(branches, input.durationTicks, options, false, 0, "exact");
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
      residualWeight += planned.residualWeight;
      exactness = combineExactness(exactness, planned.exactness);
      if (planned.plans.length > 1) sawBranching = true;
      carried.push(...planned.errors);
      plans.push(...planned.plans);
    }

    const advanced = materializeCastPlans(plans);
    residualWeight += advanced.residualWeight;
    exactness = combineExactness(exactness, advanced.exactness);
    sawBranching ||= advanced.branches.length > 1;
    const capped = mergeAndCapBranches([...carried, ...advanced.branches]);
    residualWeight += capped.residualWeight;
    exactness = combineExactness(exactness, capped.exactness);
    branches = capped.branches;
  }

  return combineBranchSummaries(
    branches,
    input.durationTicks,
    options,
    sawBranching,
    residualWeight,
    exactness,
  );
}

export const STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION =
  "Bar policy spent the additional resource differently; not a passive damage penalty." as const;

/** First tick where Vigour-on vs Vigour-off selected different bar abilities. */
export interface StrictPriorityResourceDivergence {
  kind: "strict-priority-resource-divergence";
  tick: number;
  abilityOff: string;
  abilityOn: string;
  adrenBeforeOff: number;
  adrenBeforeOn: number;
  explanation: typeof STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION;
}

function castStartingAt(casts: readonly CastRecord[], tick: number): CastRecord | undefined {
  return casts.find((c) => c.tick === tick);
}

function adrenBeforeAtTick(casts: readonly CastRecord[], tick: number): number {
  const at = castStartingAt(casts, tick);
  if (at) return at.adrenalineBefore;
  let prev: CastRecord | undefined;
  for (const c of casts) {
    if (c.tick < tick && (prev === undefined || c.tick > prev.tick)) prev = c;
  }
  return prev?.adrenalineAfter ?? 0;
}

/** First tick with differing selected ability; null when sequences match. */
export function diagnoseStrictPriorityResourceDivergence(
  off: Pick<RotationSummary, "casts">,
  on: Pick<RotationSummary, "casts">,
): StrictPriorityResourceDivergence | null {
  const ticks = new Set<number>();
  for (const c of off.casts) ticks.add(c.tick);
  for (const c of on.casts) ticks.add(c.tick);
  const ordered = [...ticks].sort((a, b) => a - b);
  for (const tick of ordered) {
    const castOff = castStartingAt(off.casts, tick);
    const castOn = castStartingAt(on.casts, tick);
    const abilityOff = castOff?.abilityId ?? "(none)";
    const abilityOn = castOn?.abilityId ?? "(none)";
    if (abilityOff === abilityOn) continue;
    return {
      kind: "strict-priority-resource-divergence",
      tick,
      abilityOff,
      abilityOn,
      adrenBeforeOff: adrenBeforeAtTick(off.casts, tick),
      adrenBeforeOn: adrenBeforeAtTick(on.casts, tick),
      explanation: STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION,
    };
  }
  return null;
}

/** Same bar with ringOfVigour forced off vs on; first selection divergence. */
export function compareRevolutionWithVigour(
  input: RevolutionInput,
  options?: SimulateOptions,
): {
  off: RotationSummary;
  on: RotationSummary;
  divergence: StrictPriorityResourceDivergence | null;
} {
  const adren = input.adrenaline;
  const off = simulateRevolution(
    {
      ...input,
      adrenaline: adren ? { ...adren, ringOfVigour: false } : { ringOfVigour: false },
    },
    options,
  );
  const on = simulateRevolution(
    {
      ...input,
      adrenaline: adren ? { ...adren, ringOfVigour: true } : { ringOfVigour: true },
    },
    options,
  );
  return {
    off,
    on,
    divergence: diagnoseStrictPriorityResourceDivergence(off, on),
  };
}
