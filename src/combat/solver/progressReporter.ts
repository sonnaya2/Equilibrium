/**
 * Progress emission for solveFromRequest - phase mapping, ratios, throttling. */
import type { SolvePhaseName } from "./solve";
import type { SolverPhase, SolverProgress } from "./worker/protocol";
import type { SolveRuntimeOptions } from "./worker/solveTypes";

export type ProgressState = {
  currentPhase: SolverPhase;
  evaluations: number;
  uniqueBars: number;
  bestExploratoryScore: number;
  bestFullScore: number;
  searchEvaluations: number;
  fullEvaluations: number;
  topPreview: string[];
  activePreview: string[];
  noImprovement: number;
  evaluationBudget: number;
  fullMemoHits: number;
  finalizeActive: boolean;
  finalizeDone: number;
  finalizeTotal: number;
  scoringLabel: string | undefined;
  scoringBarPreview: readonly string[] | undefined;
};

/** Search fill stops short of full so "Final scoring" still has track room. */
export const SEARCH_SHARE = 0.82;

export function mapPhase(name: SolvePhaseName): SolverPhase {
  switch (name) {
    case "seed":
      return "seed";
    case "finalize":
      return "finalize";
    case "local":
    case "anneal":
    case "lns":
    case "evolutionary":
      return "exploit";
    default:
      return "explore";
  }
}

export function progressRatioNow(state: ProgressState): number {
  if (state.finalizeActive) {
    // Hold at search ceiling until the first finalize step reports a real total.
    if (state.finalizeTotal <= 0) return SEARCH_SHARE;
    // 0.82 → 0.995 across finalize steps; 1.0 only when the run completes.
    return Math.min(
      0.995,
      SEARCH_SHARE + (0.995 - SEARCH_SHARE) * (state.finalizeDone / state.finalizeTotal),
    );
  }
  // Leave a visible tail even when the search budget is spent.
  const searchT = Math.min(1, state.evaluations / Math.max(1, state.evaluationBudget));
  return Math.min(SEARCH_SHARE * 0.98, SEARCH_SHARE * searchT);
}

export function emitProgress(
  options: SolveRuntimeOptions | undefined,
  state: ProgressState,
  force = false,
): void {
  if (!options?.onProgress) return;
  if (!force && state.evaluations % 2 !== 0) return;
  // bestScore is ALWAYS exploratory DPM - never unit-switch to full robust mid-run.
  const exploratory = Number.isFinite(state.bestExploratoryScore)
    ? state.bestExploratoryScore
    : Number.NEGATIVE_INFINITY;
  const full = Number.isFinite(state.bestFullScore)
    ? state.bestFullScore
    : Number.NEGATIVE_INFINITY;
  const progress: SolverProgress = {
    phase: state.currentPhase,
    evaluations: state.evaluations,
    uniqueCandidates: state.uniqueBars,
    bestScore: Number.isFinite(exploratory) ? exploratory : 0,
    ...(Number.isFinite(exploratory) ? { bestExploratoryScore: exploratory } : {}),
    ...(Number.isFinite(full) ? { bestFullScore: full } : {}),
    searchEvaluations: state.searchEvaluations,
    fullEvaluations: state.fullEvaluations,
    evaluationMode: state.currentPhase === "finalize" ? "finalize" : "search",
    // Never stuff robust score into windowDpms - real windows live on the result DTO.
    windowDpms: 0,
    topBarPreview: state.topPreview,
    ...(state.activePreview.length ? { activeBarPreview: state.activePreview } : {}),
    noImprovementCount: state.noImprovement,
    evaluationBudget: state.evaluationBudget,
    progressRatio: progressRatioNow(state),
    proof: {
      notes: [
        `bestExploratory=${Number.isFinite(exploratory) ? exploratory : "none"}`,
        `bestFull=${Number.isFinite(full) ? full : "none"}`,
        `phase=${state.currentPhase}`,
        `searchEvaluations=${state.searchEvaluations}`,
        `fullEvaluations=${state.fullEvaluations}`,
      ],
    },
    ...(state.fullMemoHits > 0 ? { fullMemoHits: state.fullMemoHits } : {}),
    ...(state.finalizeActive && state.finalizeTotal > 0
      ? {
          finalizeStep: state.finalizeDone,
          finalizeTotal: state.finalizeTotal,
          ...(state.scoringLabel ? { scoringLabel: state.scoringLabel } : {}),
          ...(state.scoringBarPreview?.length
            ? { scoringBarPreview: state.scoringBarPreview }
            : {}),
        }
      : {}),
  };
  options.onProgress(progress);
}
