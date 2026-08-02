/**
 * Evaluation session: memoized bar scoring for solveFromRequest.
 * Behavior-preserving extraction — same memo keys and counters.
 */
import type { EvaluateFn, EvalMode } from "./contracts";
import { evaluateRevolutionBar } from "./evaluate";
import { readEvalMemo, writeEvalMemo } from "./evalMemo";
import { fingerprintEvaluationKey, stableStringify } from "./fingerprint";
import { OBJECTIVE_VERSION } from "./contracts";
import type { SerializableSolverRequest } from "./worker/serializable";
import type { SolveRuntimeOptions } from "./worker/solveTypes";
import type { ProgressState } from "./progressReporter";
import { emitProgress } from "./progressReporter";

// Same structural fields as the inline simCommon object in solveFromRequest.
export type SessionSimCommon = Parameters<typeof evaluateRevolutionBar>[0]["sim"];

export function buildMemoContext(
  request: SerializableSolverRequest,
  simBase: {
    base: unknown;
    level: unknown;
    accuracy: unknown;
    crit: unknown;
    weaponConfiguration: unknown;
    equipmentIds: unknown;
    startingAdrenaline?: unknown;
    plantedFeet?: boolean;
    strengthCape99?: boolean;
    preciseRank?: number;
    league: { blessingIds: readonly string[]; ruleset: unknown };
    targetHpPercent?: number | null;
  },
): string {
  // Loadout/context slice for process-local eval memo (re-Optimize warms).
  return stableStringify({
    style: request.style,
    profileId: request.profileId,
    customWeights: request.customWeights ?? null,
    includePartial: request.includePartial === true,
    base: simBase.base,
    level: simBase.level,
    accuracy: simBase.accuracy,
    crit: simBase.crit,
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
    startingAdrenaline: simBase.startingAdrenaline,
    plantedFeet: simBase.plantedFeet === true,
    strengthCape99: simBase.strengthCape99 === true,
    preciseRank: simBase.preciseRank ?? 0,
    leagueIds: simBase.league.blessingIds,
    ruleset: simBase.league.ruleset,
    targetHp: simBase.targetHpPercent ?? null,
  });
}

export function createEvaluateFn(args: {
  request: SerializableSolverRequest;
  pool: Parameters<typeof evaluateRevolutionBar>[0]["pool"];
  simCommon: SessionSimCommon;
  exploreTicks: number;
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
    fullTicks,
    memoContext,
    state,
    seenBars,
    options,
  } = args;

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
    const durationTicks = useFull ? fullTicks : exploreTicks;
    const scoreMode = useFull ? "full" : "search";
    const memoKey = fingerprintEvaluationKey({
      bar,
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
      const key = bar.join("\0");
      if (!seenBars.has(key)) {
        seenBars.add(key);
        state.uniqueBars += 1;
      }
      if (memoHit.finite && memoHit.score > state.bestExploratoryScore && scoreMode === "search") {
        state.bestExploratoryScore = memoHit.score;
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
      // Do not flip phase to finalize on a memo hit alone — only the finalize
      // hook owns that (avoids a one-frame "scoring" flash on warm re-runs).
      // Force emit when the strip candidate changes so the UI keeps cycling.
      emitProgress(options, state, activeChanged);
      return memoHit;
    }

    state.evaluations += 1;
    if (useFull) state.fullEvaluations += 1;
    else state.searchEvaluations += 1;
    const key = bar.join("\0");
    if (!seenBars.has(key)) {
      seenBars.add(key);
      state.uniqueBars += 1;
    }

    const evaluation = evaluateRevolutionBar({
      bar,
      style: request.style,
      durationTicks,
      pool,
      sim: simCommon,
      profileId: request.profileId,
      customWeights: request.customWeights,
      includePartial: request.includePartial,
      size: { min: request.minBarSize, max: request.maxBarSize },
    });

    if (evaluation.ok) {
      if (evaluation.mode === "full" && evaluation.validForFinalRanking) {
        if (evaluation.score > state.bestFullScore) {
          state.bestFullScore = evaluation.score;
          state.topPreview = [...bar];
          state.noImprovement = 0;
        } else {
          state.noImprovement += 1;
        }
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
    } else {
      state.noImprovement += 1;
    }

    // Force paint when the under-test bar changes; else keep every-2 throttle.
    emitProgress(options, state, activeChanged);

    if (!evaluation.ok) {
      return {
        score: Number.NEGATIVE_INFINITY,
        finite: false,
        mode: evaluation.mode,
        exploratory: evaluation.exploratory,
        validForFinalRanking: false,
        horizonTicks: evaluation.horizonTicks,
        failureReason: evaluation.failureReason ?? evaluation.reasons[0]?.message,
        // Preserve failed robust objective when present (never synthesize success).
        objective: evaluation.objective,
      };
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
        // objective omitted on purpose — scalar exploratory DPM only
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
      objective: evaluation.objective,
    };
    writeEvalMemo(memoKey, out);
    return out;
  };
}
