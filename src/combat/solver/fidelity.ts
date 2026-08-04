/**
 * Multi-fidelity search allocation (Phase 7).
 * Short explore (score-only DPM) -> medium proportional-robust -> full finalize.
 * Total budget is partitioned; TIER_BUDGETS numbers are never lowered here.
 */
import type { EvalMode } from "./contracts";
import { MIN_RANKABLE_HORIZON_TICKS } from "./objective";

/** Search-budget shares (finalize force-evals stay outside the share math). */
export const FIDELITY_BUDGET_SHARES = {
  short: 0.65,
  medium: 0.35,
} as const;

export type EvalFidelity = "short" | "medium" | "full";

export interface FidelityBudgetAllocation {
  short: number;
  medium: number;
  total: number;
}

/**
 * Partition total evaluation budget into short + medium stages.
 * Tiny budgets stay short-only so unit tests with ~20-40 evals keep full exploration.
 */
export function allocateFidelityBudget(total: number): FidelityBudgetAllocation {
  const t = Math.max(0, Math.floor(total));
  if (t <= 0) return { short: 0, medium: 0, total: 0 };
  // Below this, medium screen is not worth the split (tests / quick benches).
  if (t < 32) return { short: t, medium: 0, total: t };

  let medium = Math.round(t * FIDELITY_BUDGET_SHARES.medium);
  medium = Math.max(1, Math.min(t - 1, medium));
  const short = t - medium;
  return { short, medium, total: t };
}

/**
 * Medium horizon ticks for proportional robust windows.
 * Always rankable when returned; always strictly below fullTicks.
 * Returns null when there is no useful intermediate fidelity.
 */
export function mediumHorizonTicks(exploreTicks: number, fullTicks: number): number | null {
  const full = Math.floor(fullTicks);
  const explore = Math.max(1, Math.floor(exploreTicks));
  if (!(full > MIN_RANKABLE_HORIZON_TICKS)) return null;

  // Midpoint of explore and full, clamped into [MIN_RANKABLE, full-1].
  let mid = Math.round((explore + full) / 2);
  mid = Math.max(MIN_RANKABLE_HORIZON_TICKS, Math.min(full - 1, mid));

  // When explore is already rankable, push toward full so medium is distinct.
  if (mid <= explore) {
    mid = Math.min(full - 1, explore + Math.max(1, Math.floor((full - explore) / 2)));
  }

  if (mid <= explore || mid >= full) return null;
  if (mid < MIN_RANKABLE_HORIZON_TICKS) return null;
  return mid;
}

export function fidelityForEvalMode(mode: EvalMode | undefined): EvalFidelity {
  if (mode === "full" || mode === "finalize") return "full";
  if (mode === "medium") return "medium";
  return "short";
}

/** Whether multi-fidelity medium stage should run for this config. */
export function shouldRunMediumStage(opts: {
  mediumHorizonTicks?: number | null;
  mediumBudget: number;
}): boolean {
  const ticks = opts.mediumHorizonTicks;
  return (
    opts.mediumBudget > 0 &&
    ticks != null &&
    ticks >= MIN_RANKABLE_HORIZON_TICKS &&
    Number.isFinite(ticks)
  );
}
