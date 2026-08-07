/**
 * Adaptive branch-width fidelity (Phase 3).
 * Horizon multi-fidelity (short/medium/full ticks) is separate - see fidelity.ts.
 * Progressive live caps; residual thresholds gate completeness; never launder residual.
 */
import type { BranchBudget } from "../engine/simulation/contracts";
import {
  isBranchProfilingEnabled,
  noteFidelityRetry,
  resolveBranchBudget,
} from "../engine/simulation/branch";
import { simulateRevolution, type RevolutionInput } from "../engine/simulation/revolution";
import type { RotationSummary, SimulateOptions } from "../engine/simulation/simulate";
import type { ScoreableSummary } from "./contracts";
import { exactnessEligibleForExactProof, RESIDUAL_FREE_TOLERANCE } from "./objective";
import { simulateRevolutionForUiHybrid } from "./uiRunCore";

export { RESIDUAL_FREE_TOLERANCE };

export type BranchFidelityMode = "exploratory" | "medium" | "full";

/** Residual threshold only vs residual + exact/merged-exactly for full ranking. */
export type BranchExactnessRequirement = "any" | "exact-or-merged";

export interface BranchFidelityLadder {
  mode: BranchFidelityMode;
  /** Progressive maxLive values; intermediate defaults to 2x live. */
  liveCaps: readonly number[];
  maximumResidualWeight: number;
  exactness: BranchExactnessRequirement;
}

/** Starting policy; profile-adjustable via overrides. */
export const DEFAULT_BRANCH_FIDELITY_LADDERS: Record<BranchFidelityMode, BranchFidelityLadder> = {
  exploratory: {
    mode: "exploratory",
    liveCaps: [64, 128, 256, 512],
    maximumResidualWeight: 1e-3,
    exactness: "any",
  },
  medium: {
    mode: "medium",
    liveCaps: [256, 512, 1024],
    maximumResidualWeight: 1e-4,
    exactness: "any",
  },
  full: {
    mode: "full",
    liveCaps: [512, 1024, 2048, 4096, 8192],
    maximumResidualWeight: 1e-12,
    exactness: "exact-or-merged",
  },
};

export interface BranchFidelityAttemptMeta {
  mode: BranchFidelityMode;
  attempts: number;
  finalBudget: BranchBudget;
  complete: boolean;
  residualWeight: number;
  exactness?: string;
}

export interface AdaptiveBranchFidelityResult {
  summary: RotationSummary;
  meta: BranchFidelityAttemptMeta;
}

export function resolveBranchFidelityLadder(
  mode: BranchFidelityMode,
  overrides?: Partial<Record<BranchFidelityMode, Partial<BranchFidelityLadder>>>,
): BranchFidelityLadder {
  const base = DEFAULT_BRANCH_FIDELITY_LADDERS[mode];
  const o = overrides?.[mode];
  if (o == null) return { ...base, liveCaps: [...base.liveCaps] };
  const liveCaps = o.liveCaps != null ? [...o.liveCaps] : [...base.liveCaps];
  if (liveCaps.length === 0) {
    throw new RangeError(`resolveBranchFidelityLadder: liveCaps must be non-empty for ${mode}`);
  }
  for (const c of liveCaps) {
    if (!Number.isInteger(c) || c < 1) {
      throw new RangeError(
        `resolveBranchFidelityLadder: liveCap must be a positive integer, got ${c}`,
      );
    }
  }
  const maximumResidualWeight =
    o.maximumResidualWeight !== undefined ? o.maximumResidualWeight : base.maximumResidualWeight;
  if (!(Number.isFinite(maximumResidualWeight) && maximumResidualWeight >= 0)) {
    throw new RangeError(
      `resolveBranchFidelityLadder: maximumResidualWeight must be non-negative finite, got ${maximumResidualWeight}`,
    );
  }
  return {
    mode,
    liveCaps,
    maximumResidualWeight,
    exactness: o.exactness ?? base.exactness,
  };
}

export function budgetForLiveCap(
  live: number,
  maximumResidualWeight: number,
  intermediateMax?: number,
): BranchBudget {
  return resolveBranchBudget({
    maxLiveBranches: live,
    maxIntermediateBranches: intermediateMax ?? live * 2,
    maximumResidualWeight,
  });
}

/**
 * True when residual and exactness meet the ladder requirement.
 * Ranking gates stay separate (objective.ts); this only ends adaptive retry.
 * residual in (0, threshold] is "guidance complete" but still unrankable under OBJECTIVE v4.
 */
export function meetsBranchCompleteness(
  summary: Pick<ScoreableSummary, "ok" | "rng"> | RotationSummary,
  ladder: BranchFidelityLadder,
): boolean {
  if (!summary.ok) return false;
  const residual = typeof summary.rng?.residualWeight === "number" ? summary.rng.residualWeight : 0;
  if (residual > ladder.maximumResidualWeight) return false;
  if (ladder.exactness === "exact-or-merged") {
    const ex = typeof summary.rng?.exactness === "string" ? summary.rng.exactness : undefined;
    // Missing exactness treated as exact (legacy). Non-exact lattice fails.
    if (!exactnessEligibleForExactProof(ex)) return false;
  }
  return true;
}

function residualWeightOf(summary: Pick<ScoreableSummary, "rng"> | RotationSummary): number {
  return typeof summary.rng?.residualWeight === "number" ? summary.rng.residualWeight : 0;
}

/**
 * Whether to stop the ladder now.
 * residual-free (or full exact rung) stops immediately.
 * residual in (0, threshold] is guidance-complete: keep escalating while rungs remain
 * so unit-mass ranking can still succeed; on the last rung, accept as complete.
 */
export function shouldStopAdaptiveAttempt(
  summary: Pick<ScoreableSummary, "ok" | "rng"> | RotationSummary,
  ladder: BranchFidelityLadder,
  attemptIndex: number,
): boolean {
  if (!meetsBranchCompleteness(summary, ladder)) return false;
  const residual = residualWeightOf(summary);
  const isLast = attemptIndex >= ladder.liveCaps.length - 1;
  if (residual <= RESIDUAL_FREE_TOLERANCE) return true;
  return isLast;
}

/**
 * Run revolution at progressive live caps until completeness or ladder end.
 * Incomplete: returns last attempt (known-mass under residual); caller must not rank.
 */
export function simulateWithAdaptiveBranchFidelity(
  input: RevolutionInput,
  options: SimulateOptions | undefined,
  ladder: BranchFidelityLadder,
): AdaptiveBranchFidelityResult {
  let lastSummary: RotationSummary | undefined;
  let lastBudget: BranchBudget | undefined;
  let attempts = 0;

  for (let i = 0; i < ladder.liveCaps.length; i++) {
    const live = ladder.liveCaps[i]!;
    attempts += 1;
    const budget = budgetForLiveCap(live, ladder.maximumResidualWeight);
    const t0 = isBranchProfilingEnabled() ? performance.now() : 0;
    const summary = simulateRevolution(input, {
      ...options,
      branchBudget: budget,
    });
    if (isBranchProfilingEnabled()) {
      noteFidelityRetry(performance.now() - t0);
    }
    lastSummary = summary;
    lastBudget = budget;
    if (shouldStopAdaptiveAttempt(summary, ladder, i)) {
      const complete = meetsBranchCompleteness(summary, ladder);
      return {
        summary,
        meta: {
          mode: ladder.mode,
          attempts,
          finalBudget: budget,
          complete,
          residualWeight: residualWeightOf(summary),
          exactness: typeof summary.rng?.exactness === "string" ? summary.rng.exactness : undefined,
        },
      };
    }
  }

  if (lastSummary == null || lastBudget == null) {
    throw new Error("simulateWithAdaptiveBranchFidelity: empty liveCaps");
  }
  return {
    summary: lastSummary,
    meta: {
      mode: ladder.mode,
      attempts,
      finalBudget: lastBudget,
      complete: meetsBranchCompleteness(lastSummary, ladder),
      residualWeight: residualWeightOf(lastSummary),
      exactness:
        typeof lastSummary.rng?.exactness === "string" ? lastSummary.rng.exactness : undefined,
    },
  };
}

/** Map horizon eval mode to branch ladder mode. */
export function branchFidelityModeForEval(
  mode: "search" | "medium" | "full" | "finalize" | undefined,
): BranchFidelityMode {
  if (mode === "full" || mode === "finalize") return "full";
  if (mode === "medium") return "medium";
  return "exploratory";
}

/** Fingerprint fragment so memo never mixes 64 vs 512 branch widths. */
export function branchFidelityCacheToken(meta: BranchFidelityAttemptMeta | undefined): string {
  if (meta == null) return "bf=default";
  return `bf=${meta.mode}:L${meta.finalBudget.maxLiveBranches}:c${meta.complete ? 1 : 0}`;
}

/**
 * Memo key fragment for a planned ladder (before adaptive run).
 * Distinct live-cap ladders never share memo entries.
 */
export function branchFidelityLadderMemoToken(ladder: BranchFidelityLadder): string {
  return `bfL=${ladder.mode}:caps=${ladder.liveCaps.join(",")}:r${ladder.maximumResidualWeight}:x${ladder.exactness}`;
}

export const UI_RUN_INITIAL_LIVE_BRANCH_CAP = 128;
export const UI_RUN_MAX_LIVE_BRANCH_CAP = 4096;

/** Interactive UI Run branch budget. */
export const UI_RUN_BRANCH_FIDELITY_LADDER: BranchFidelityLadder = {
  mode: "medium",
  liveCaps: [128, 256, 512, 1024, 2048, UI_RUN_MAX_LIVE_BRANCH_CAP],
  maximumResidualWeight: 1e-12,
  exactness: "any",
};

export const UI_MAIN_THREAD_BRANCH_FIDELITY_LADDER: BranchFidelityLadder = {
  ...UI_RUN_BRANCH_FIDELITY_LADDER,
  liveCaps: [UI_RUN_INITIAL_LIVE_BRANCH_CAP, 256],
};

/**
 * Explicit synchronous UI Run: score-only ladder climb + one full-analysis.
 * Product UI uses the worker multi-probe host.
 */
export function simulateRevolutionForUi(
  input: RevolutionInput,
  options?: SimulateOptions,
): AdaptiveBranchFidelityResult {
  return simulateRevolutionForUiHybrid(input, options, UI_MAIN_THREAD_BRANCH_FIDELITY_LADDER);
}
