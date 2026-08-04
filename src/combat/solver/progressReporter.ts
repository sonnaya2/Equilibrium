/**
 * Progress emission for solveFromRequest - phase mapping, ratios, throttling.
 *
 * Throttle policy (hot path):
 * - force / phase / finalize / yield: always
 * - best exploratory or full score improves: always
 * - else every PROGRESS_EVAL_INTERVAL evals OR every PROGRESS_WALL_MS wall
 * - active under-test strip: at most every ACTIVE_STRIP_EVAL_INTERVAL evals
 *
 * Payload stays a slim SolverProgress DTO - never re-embeds the request.
 */
import type { SolvePhaseName } from "./solve";
import type { SolverPhase, SolverProgress } from "./worker/protocol";
import type { SolveRuntimeOptions } from "./worker/solveTypes";
import type { SolverProfileCounters } from "./profiling/counters";
import { noteProgressEmit } from "./profiling/counters";

/** Cadence when scores are flat and caller did not force. */
export const PROGRESS_EVAL_INTERVAL = 16;
/** Wall-clock arm so slow evals still paint without waiting for N more evals. */
export const PROGRESS_WALL_MS = 50;
/** Active under-test bar strip: moderate refresh, not every eval. */
export const ACTIVE_STRIP_EVAL_INTERVAL = 8;

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
  /** Present when profiling is enabled for this solve. */
  profile?: SolverProfileCounters;
  /** Throttle: evaluations at last actual emit (0 = never). */
  lastEmitEvaluations: number;
  /** Throttle: wall clock (performance.now / Date.now) at last emit (0 = never). */
  lastEmitMs: number;
  /** Last best scores that were actually pushed to onProgress. */
  lastEmittedBestExploratory: number;
  lastEmittedBestFull: number;
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

function wallNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** Whether this call should push an onProgress / profile emit. */
export function shouldEmitProgress(
  state: ProgressState,
  force = false,
  activeChanged = false,
): boolean {
  if (force) return true;

  if (state.bestExploratoryScore > state.lastEmittedBestExploratory) return true;
  if (state.bestFullScore > state.lastEmittedBestFull) return true;

  const evalsSince = state.evaluations - state.lastEmitEvaluations;
  if (evalsSince <= 0) return false;

  if (evalsSince >= PROGRESS_EVAL_INTERVAL) return true;
  if (activeChanged && evalsSince >= ACTIVE_STRIP_EVAL_INTERVAL) return true;

  const now = wallNow();
  if (state.lastEmitMs <= 0 || now - state.lastEmitMs >= PROGRESS_WALL_MS) return true;

  return false;
}

function markEmitted(state: ProgressState): void {
  state.lastEmitEvaluations = state.evaluations;
  state.lastEmitMs = wallNow();
  if (Number.isFinite(state.bestExploratoryScore)) {
    state.lastEmittedBestExploratory = state.bestExploratoryScore;
  }
  if (Number.isFinite(state.bestFullScore)) {
    state.lastEmittedBestFull = state.bestFullScore;
  }
}

/**
 * Emit slim progress DTO. Scores are always current state values when emitted
 * (honest - no stale bestScore). Throttle suppresses intermediate paints only.
 */
export function emitProgress(
  options: SolveRuntimeOptions | undefined,
  state: ProgressState,
  force = false,
  activeChanged = false,
): void {
  const profileOn = state.profile?.enabled === true;
  if (!options?.onProgress && !profileOn) return;
  if (!shouldEmitProgress(state, force, activeChanged)) return;
  noteProgressEmit(state.profile);
  markEmitted(state);
  if (!options?.onProgress) return;
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
