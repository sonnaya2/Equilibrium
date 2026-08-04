/**
 * Stage budget helpers for multi-fidelity solve/solveAsync.
 * Unused short budget rolls into medium; total never exceeds evaluationBudget.
 */
import {
  allocateFidelityBudget,
  shouldRunMediumStage,
  type FidelityBudgetAllocation,
} from "../fidelity";
import type { SearchConfig, SearchState } from "./types";

export interface FidelityStagePlan {
  allocation: FidelityBudgetAllocation;
  mediumTicks: number | null;
  runMedium: boolean;
}

export function planFidelityStages(config: SearchConfig): FidelityStagePlan {
  const mediumTicks =
    config.mediumHorizonTicks != null && config.mediumHorizonTicks > 0
      ? config.mediumHorizonTicks
      : null;
  if (mediumTicks == null) {
    return {
      allocation: {
        short: config.evaluationBudget,
        medium: 0,
        total: config.evaluationBudget,
      },
      mediumTicks: null,
      runMedium: false,
    };
  }
  const allocation = allocateFidelityBudget(config.evaluationBudget);
  const runMedium = shouldRunMediumStage({
    mediumHorizonTicks: mediumTicks,
    mediumBudget: allocation.medium,
  });
  if (!runMedium) {
    return {
      allocation: {
        short: config.evaluationBudget,
        medium: 0,
        total: config.evaluationBudget,
      },
      mediumTicks,
      runMedium: false,
    };
  }
  return { allocation, mediumTicks, runMedium: true };
}

/** Cap remaining for the short stage without changing budget.total. */
export function beginShortStage(state: SearchState, plan: FidelityStagePlan): void {
  if (!plan.runMedium) {
    state.budget.remaining = Math.max(0, state.budget.total - state.budget.used);
    return;
  }
  const grant = plan.allocation.short;
  state.budget.remaining = Math.min(grant, Math.max(0, state.budget.total - state.budget.used));
}

/**
 * Open medium stage: unused short remainder + medium share, still capped by total.
 */
export function beginMediumStage(state: SearchState, plan: FidelityStagePlan): void {
  if (!plan.runMedium) {
    state.budget.remaining = 0;
    return;
  }
  const unusedShort = Math.max(0, state.budget.remaining);
  const grant = plan.allocation.medium + unusedShort;
  state.budget.remaining = Math.min(grant, Math.max(0, state.budget.total - state.budget.used));
}
