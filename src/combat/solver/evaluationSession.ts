/**
 * Evaluation session: memoized bar scoring for solveFromRequest.
 * Memo context is derived from canonicalEvaluationContext (identity.ts) so
 * process-local caches cannot reuse scores across materially different requests.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { EvaluateFn, EvalMode, ScoreableSummary } from "./contracts";
import { evaluateRevolutionBar } from "./evaluate";
import { createEligibilityMemo } from "./eligibility";
import { readEvalMemo, writeEvalMemo } from "./evalMemo";
import { barKey, fingerprintEvaluationKey, stableStringify } from "./fingerprint";
import { OBJECTIVE_VERSION } from "./contracts";
import { canonicalEvaluationContext } from "./identity";
import type { SerializableSolverRequest } from "./worker/serializable";
import type { SolveRuntimeOptions } from "./worker/solveTypes";
import type { ProgressState } from "./progressReporter";
import { emitProgress } from "./progressReporter";
import { noteEval, noteUniqueBar } from "./profiling/counters";
import { compileEvaluationContext } from "./compiledContext";
import {
  summaryEligibleForObjectiveScore,
  summaryObjectiveIneligibilityReason,
} from "./objective";

// Same structural fields as the inline simCommon object in solveFromRequest.
export type SessionSimCommon = Parameters<typeof evaluateRevolutionBar>[0]["sim"];

/**
 * Stable evaluation-context string for process-local eval memo.
 * Uses the canonical evaluation identity (simulation + objective + pool filters).
 * Second arg kept for call-site compatibility; identity is taken from `request`.
 */
export function buildMemoContext(
  request: SerializableSolverRequest,
  _simBase?: unknown,
): string {
  return stableStringify(canonicalEvaluationContext(request));
}

export function createEvaluateFn(args: {
  request: SerializableSolverRequest;
  pool: Parameters<typeof evaluateRevolutionBar>[0]["pool"];
  simCommon: SessionSimCommon;
  exploreTicks: number;
  mediumTicks?: number | null;
  fullTicks: number;
  memoContext: string;
  state: ProgressState;
  seenBars: Set<string>;
  options?: SolveRuntimeOptions;
}): EvaluateFn {
  const {
    request,
    pool,
    simCommon,
    exploreTicks,
    mediumTicks,
    fullTicks,
    memoContext,
    state,
    seenBars,
    options,
  } = args;

  // Once per solve session: catalogue merge + Strength Cape + byId maps.
  const compiled = compileEvaluationContext({
    style: request.style,
    pool,
    catalogue: simCommon.abilities as AbilitySpec[],
    strengthCape99: (simCommon as { strengthCape99?: boolean }).strengthCape99 === true,
  });
  const simWithCatalogue = {
    ...simCommon,
    abilities: compiled.catalogue,
  };

  const weaponConfiguration = simCommon.weaponConfiguration;
  const equipmentIds = simCommon.equipmentIds;
  const passiveIds = (
    simCommon as { equipmentEffects?: { passiveIds?: readonly string[] } }
  ).equipmentEffects?.passiveIds;
  const eligibilityOpts = {
    includePartial: request.includePartial,
    size: { min: request.minBarSize, max: request.maxBarSize },
    weaponConfiguration,
    equipmentIds,
    passiveIds,
  };
  // One eligibility LRU per solve; pool + options fixed for search + full rescoring.
  const eligibilityMemo = createEligibilityMemo(pool, eligibilityOpts);

  return ({ bar, mode }: { bar: readonly string[]; mode?: EvalMode }) => {
    if (options?.isCancelled?.() || options?.signal?.aborted) {
      return { score: Number.NEGATIVE_INFINITY, finite: false };
    }
    // Track the bar under test so the UI strip can cycle. Best-so-far
    // (topPreview) only moves when a candidate beats the incumbent.
    const nextActive = [...bar];
    const activeChanged =
      nextActive.length !== state.activePreview.length ||
      nextActive.some((id, i) => id !== state.activePreview[i]);
    state.activePreview = nextActive;
    const useFull = mode === "full" || mode === "finalize";
    const useMedium = mode === "medium" && !useFull;
    const durationTicks = useFull
      ? fullTicks
      : useMedium && mediumTicks != null && mediumTicks > 0
        ? mediumTicks
        : exploreTicks;
    const scoreMode = useFull ? "full" : useMedium ? "medium" : "search";
    const kind = useFull ? ("full" as const) : ("search" as const);
    const fidelity = useFull ? ("full" as const) : useMedium ? ("medium" as const) : ("short" as const);
    // One join for seenBars + evaluation memo key (no second bar.join).
    const key = barKey(bar);
    const peer = options?.coord?.getIncumbent();
    if (peer && peer.score > state.bestExploratoryScore) {
      state.bestExploratoryScore = peer.score;
      if (!state.finalizeActive && peer.bar.length) state.topPreview = [...peer.bar];
    }
    if (peer?.fullScore != null && peer.fullScore > state.bestFullScore) {
      state.bestFullScore = peer.fullScore;
    }
    const memoKey = fingerprintEvaluationKey({
      bar,
      barKey: key,
      mode: scoreMode,
      horizonTicks: durationTicks,
      profileId: request.profileId,
      customWeights: request.customWeights,
      context: memoContext,
      objectiveVersion: OBJECTIVE_VERSION,
    });
    const memoHit = readEvalMemo(memoKey);
    if (memoHit) {
      // Count as evaluation for progress honesty but skip the heavy sim.
      state.evaluations += 1;
      if (useFull) {
        state.fullEvaluations += 1;
        state.fullMemoHits += 1;
      } else {
        state.searchEvaluations += 1;
      }
      noteEval(state.profile, kind, true);
      if (!seenBars.has(key)) {
        seenBars.add(key);
        state.uniqueBars += 1;
        noteUniqueBar(state.profile);
        if (options?.coord) options.coord.noteLocalSeen(key);
        else (state.pendingSeenKeys ??= []).push(key);
      }
      if (memoHit.finite && memoHit.score > state.bestExploratoryScore && scoreMode === "search") {
        state.bestExploratoryScore = memoHit.score;
        if (!state.finalizeActive) state.topPreview = [...bar];
      }
      if (
        memoHit.finite &&
        scoreMode === "medium" &&
        memoHit.validForFinalRanking !== true &&
        Number.isFinite(memoHit.score)
      ) {
        // Medium is guidance only; progress bestScore stays exploratory scale.
        if (!state.finalizeActive) state.topPreview = [...bar];
      }
      if (
        memoHit.finite &&
        memoHit.validForFinalRanking &&
        scoreMode === "full" &&
        memoHit.score > state.bestFullScore
      ) {
        state.bestFullScore = memoHit.score;
        state.topPreview = [...bar];
      }
      // Do not flip phase to finalize on a memo hit alone - only the finalize
      // hook owns that (avoids a one-frame "scoring" flash on warm re-runs).
      // Throttled strip updates via activeChanged (not force).
      emitProgress(options, state, false, activeChanged);
      return memoHit;
    }

    state.evaluations += 1;
    if (useFull) state.fullEvaluations += 1;
    else state.searchEvaluations += 1;
    noteEval(state.profile, kind, false);
    if (!seenBars.has(key)) {
      seenBars.add(key);
      state.uniqueBars += 1;
      noteUniqueBar(state.profile);
      if (options?.coord) options.coord.noteLocalSeen(key);
      else (state.pendingSeenKeys ??= []).push(key);
    }

    // Search + full ranking only need ScoreableSummary metrics.
    // Winner UI breakdown is a separate full-analysis re-sim (not done here).
    const evaluation = evaluateRevolutionBar({
      bar,
      style: request.style,
      durationTicks,
      pool,
      sim: simWithCatalogue,
      compiled,
      eligibilityMemo,
      profileId: request.profileId,
      customWeights: request.customWeights,
      includePartial: request.includePartial,
      size: { min: request.minBarSize, max: request.maxBarSize },
      detailLevel: "score-only",
    });

    // Residual / known-mass / non-exact short evals must not promote (finite:false).
    // evaluate returns ok:false for those; re-check summary so search archive stays honest.
    const summary = evaluation.summary as ScoreableSummary | undefined;
    const nonRankableSummary =
      summary !== undefined && !summaryEligibleForObjectiveScore(summary);
    if (!evaluation.ok || nonRankableSummary) {
      state.noImprovement += 1;
      emitProgress(options, state, false, activeChanged);
      const failureReason =
        evaluation.failureReason ??
        evaluation.reasons[0]?.message ??
        (summary ? summaryObjectiveIneligibilityReason(summary) : null) ??
        "evaluation failed";
      return {
        score: Number.NEGATIVE_INFINITY,
        finite: false,
        mode: useMedium ? ("medium" as const) : evaluation.mode,
        exploratory: evaluation.exploratory,
        validForFinalRanking: false,
        horizonTicks: evaluation.horizonTicks,
        fidelity,
        failureReason,
        // Preserve failed robust objective when present (never synthesize success).
        objective: evaluation.objective,
      };
    }

    // Only true full-horizon path updates bestFull (medium never final-ranks).
    if (useFull && evaluation.validForFinalRanking) {
      if (evaluation.score > state.bestFullScore) {
        state.bestFullScore = evaluation.score;
        state.topPreview = [...bar];
        state.noImprovement = 0;
      } else {
        state.noImprovement += 1;
      }
    } else if (useMedium) {
      if (!state.finalizeActive) state.topPreview = [...bar];
      state.noImprovement += 1;
    } else if (evaluation.exploratory) {
      if (evaluation.score > state.bestExploratoryScore) {
        state.bestExploratoryScore = evaluation.score;
        if (!state.finalizeActive) state.topPreview = [...bar];
        state.noImprovement = 0;
      } else {
        state.noImprovement += 1;
      }
    } else {
      state.noImprovement += 1;
    }

    // Throttled strip updates via activeChanged (not force).
    emitProgress(options, state, false, activeChanged);

    // Medium fidelity: robust-shaped score allowed, never validForFinalRanking.
    if (useMedium) {
      const out = {
        score: evaluation.score,
        finite: true as const,
        mode: "medium" as const,
        exploratory: evaluation.exploratory === true,
        validForFinalRanking: false as const,
        horizonTicks: evaluation.horizonTicks,
        fidelity: "medium" as const,
        ...(evaluation.objective?.ok ? { objective: evaluation.objective } : {}),
      };
      writeEvalMemo(memoKey, out);
      return out;
    }

    // Exploratory successes carry no synthetic robust objective windows.
    if (evaluation.exploratory || !evaluation.objective?.ok) {
      const out = {
        score: evaluation.score,
        finite: true as const,
        mode: evaluation.mode,
        exploratory: true as const,
        validForFinalRanking: false as const,
        horizonTicks: evaluation.horizonTicks,
        fidelity: "short" as const,
        // objective omitted on purpose - scalar exploratory DPM only
      };
      writeEvalMemo(memoKey, out);
      return out;
    }

    const out = {
      score: evaluation.score,
      finite: true as const,
      mode: "full" as const,
      exploratory: false as const,
      validForFinalRanking: true as const,
      horizonTicks: evaluation.horizonTicks,
      fidelity: "full" as const,
      objective: evaluation.objective,
    };
    writeEvalMemo(memoKey, out);
    return out;
  };
}
