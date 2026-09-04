/**
 * Production entry: serializable request → real engine evaluations → ranked bars.
 * Orchestration only - preparation, session, progress, and result building live
 * in sibling modules. Used by worker hosts and explicit test runs.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { RevolutionBarEvaluation, SolveResult } from "./contracts";
import { configPatchForRecipe, solveAsync, type SolverAgentRecipe } from "./solve";
import type { SerializableSolverRequest, SolverResultDTO } from "./worker/serializable";
import { requireSimBase } from "./worker/revive";
import type { SolveFn, SolveRuntimeOptions } from "./worker/solveTypes";
import type { SolverPhase } from "./worker/protocol";
import type { PoolAbility } from "./contracts";
import {
  buildCandidatePoolForRequest,
  computeHorizonsAndBudget,
  fitAuthoredSeeds,
  fitIncumbentBar,
  incumbentRegionDenySet,
  poolAsSpecs,
  requiredAbilitiesForRequest,
  resolveSpecs,
} from "./requestContext";
import { emitProgress, mapPhase, type ProgressState } from "./progressReporter";
import { buildMemoContext, createEvaluateFn } from "./evaluationSession";
import { buildSolverResultDto } from "./resultBuilder";
import type { WinnerPresentation } from "./evaluate";
import { runScoreAnalysisParityGate } from "./parityGate";
import { compileEvaluationContext } from "./compiledContext";
import {
  createProfileCounters,
  isSolverProfileEnabled,
  setActiveSolverProfile,
  clearActiveSolverProfile,
  snapshotProfile,
} from "./profiling/counters";

/**
 * Production entry: serializable request → real engine evaluations → ranked bars.
 * Used by worker hosts and explicit test runs.
 */
export const solveFromRequest: SolveFn = async (
  request: SerializableSolverRequest,
  options?: SolveRuntimeOptions,
): Promise<SolverResultDTO> => {
  if (options?.isCancelled?.() || options?.signal?.aborted) {
    const err = new Error("solver cancelled");
    err.name = "AbortError";
    throw err;
  }

  const profile = createProfileCounters(isSolverProfileEnabled(options?.profile));

  const simBase = requireSimBase(request.loadout);
  const disabled = new Set(request.disabledAbilityIds ?? []);
  const incumbentDenySet = incumbentRegionDenySet(request);
  const denySet = new Set([...incumbentDenySet, ...disabled]);

  const { catalogue, pool } = buildCandidatePoolForRequest(request, simBase, denySet);
  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((a) => [a.id, a]));
  for (const a of poolSpecs) abilityMap.set(a.id, a);
  const abilities = [...abilityMap.values()];

  const { exploreTicks, mediumTicks, fullTicks, evaluationBudget } =
    computeHorizonsAndBudget(request);

  const { reviveRevolutionBase } = await import("./worker/revive");
  const revivedBase = reviveRevolutionBase(simBase);
  const simCommon = { ...revivedBase, abilities };

  const state: ProgressState = {
    currentPhase: "seed" as SolverPhase,
    evaluations: 0,
    uniqueBars: 0,
    bestExploratoryScore: Number.NEGATIVE_INFINITY,
    bestFullScore: Number.NEGATIVE_INFINITY,
    searchEvaluations: 0,
    fullEvaluations: 0,
    topPreview: [],
    activePreview: [],
    noImprovement: 0,
    evaluationBudget,
    fullMemoHits: 0,
    finalizeActive: false,
    finalizeDone: 0,
    finalizeTotal: 0,
    scoringLabel: undefined,
    scoringBarPreview: undefined,
    lastEmitEvaluations: 0,
    lastEmitMs: 0,
    lastEmittedBestExploratory: Number.NEGATIVE_INFINITY,
    lastEmittedBestFull: Number.NEGATIVE_INFINITY,
    pendingSeenKeys: [],
    currentFidelity: "short",
    ...(profile.enabled ? { profile } : {}),
  };
  const seenBars = new Set<string>();

  const throwCancelled = (): never => {
    const err = new Error("solver cancelled");
    err.name = "AbortError";
    throw err;
  };

  const memoContext = buildMemoContext(request, simBase);
  const compiled = compileEvaluationContext({
    style: request.style,
    pool,
    catalogue: simCommon.abilities as AbilitySpec[],
    strengthCape99: simCommon.strengthCape99 === true,
  });
  const fullEvaluations = new Map<string, RevolutionBarEvaluation>();
  const evaluate = createEvaluateFn({
    request,
    pool,
    simCommon,
    exploreTicks,
    mediumTicks,
    fullTicks,
    memoContext,
    state,
    seenBars,
    compiled,
    fullEvaluations,
    options,
  });

  // Pool-legal only (weapon/region denylist already applied to the pool).
  const searchPool: PoolAbility[] = pool.ids.map((id) => {
    const spec = pool.byId.get(id) as AbilitySpec;
    return { ...spec, stateful: spec.stateEffect != null && spec.hits.length === 0 };
  });
  const catalogueById = new Map(catalogue.map((a) => [a.id, a] as const));
  const requiredAbilityIds = requiredAbilitiesForRequest(request, pool);
  const authored = fitAuthoredSeeds(request, pool, denySet, catalogueById, requiredAbilityIds);
  const incumbentBar = fitIncumbentBar(request, pool, incumbentDenySet, catalogueById);

  emitProgress(options, state, true);
  if (options?.yieldSlice) await options.yieldSlice();

  const recipe: SolverAgentRecipe = request.agentRecipe ?? "default";
  const recipePatch = configPatchForRecipe(request.tier, recipe);

  setActiveSolverProfile(profile.enabled ? profile : undefined);
  let result: SolveResult;
  try {
    const coord = options?.coord;
    result = await solveAsync(
      {
        pool: searchPool,
        sizeBounds: { min: request.minBarSize, max: request.maxBarSize },
        evaluate,
        tier: request.tier,
        seed: request.seed,
        authoredSeeds: authored,
        incumbentBar,
        requiredAbilityIds,
        config: {
          profileId: request.profileId,
          ...recipePatch,
          evaluationBudget,
          searchHorizonTicks: exploreTicks,
          ...(mediumTicks != null ? { mediumHorizonTicks: mediumTicks } : {}),
          fullHorizonTicks: fullTicks,
        },
        shouldSkipFingerprint: coord ? (fp) => coord.shouldSkip(fp) : undefined,
        isSearchStopped: coord ? () => coord.stopped : undefined,
      },
      {
        onPhase: (phase) => {
          state.currentPhase = mapPhase(phase);
          if (phase === "finalize") {
            state.finalizeActive = true;
            state.currentFidelity = "full";
          } else if (phase === "medium") {
            state.currentFidelity = "medium";
          } else {
            // Stay on medium once entered; otherwise short until finalize.
            state.currentFidelity = state.currentFidelity === "medium" ? "medium" : "short";
          }
          emitProgress(options, state, true);
        },
        onFinalizeStep: (info) => {
          state.currentPhase = "finalize";
          state.finalizeActive = true;
          state.finalizeDone = info.done;
          state.finalizeTotal = Math.max(1, info.total);
          state.scoringLabel = info.label;
          state.scoringBarPreview = info.bar;
          if (info.bar?.length) state.activePreview = [...info.bar];
          emitProgress(options, state, true);
        },
        isCancelled: () => options?.isCancelled?.() === true || options?.signal?.aborted === true,
        yieldSlice: async () => {
          emitProgress(options, state, true);
          if (options?.isCancelled?.() || options?.signal?.aborted) {
            throwCancelled();
          }
          if (options?.isPaused?.()) {
            while (options.isPaused?.() && !options?.isCancelled?.()) {
              await new Promise((r) => setTimeout(r, 16));
            }
          }
          if (options?.yieldSlice) await options.yieldSlice();
          else await new Promise((r) => setTimeout(r, 0));
        },
      },
    );
  } finally {
    clearActiveSolverProfile();
  }

  if (options?.isCancelled?.() || options?.signal?.aborted) {
    throwCancelled();
  }

  // Hard gate: score-only vs full-analysis parity on top + incumbent before apply.
  state.currentPhase = "finalize";
  state.finalizeActive = true;
  emitProgress(options, state, true);

  let presentation: WinnerPresentation | null = null;
  let parityRejectCount = 0;
  const hasGateWork =
    result.top.some((t) => t.bar.length > 0) ||
    (result.best != null && result.best.bar.length > 0) ||
    (result.incumbentBar != null && result.incumbentBar.length > 0);

  if (hasGateWork) {
    if (options?.isCancelled?.() || options?.signal?.aborted) {
      throwCancelled();
    }

    const gate = await runScoreAnalysisParityGate({
      result,
      evalBase: {
        style: request.style,
        pool,
        sim: simCommon,
        compiled,
        profileId: request.profileId,
        customWeights: request.customWeights,
        includePartial: request.includePartial,
        allowExpectedDamageApproximation: (simBase.procs?.aftershockRank ?? 0) > 0,
        size: { min: request.minBarSize, max: request.maxBarSize },
      },
      fullTicks,
      scoreOnlyEvaluations: fullEvaluations,
      isCancelled: () => options?.isCancelled?.() === true || options?.signal?.aborted === true,
      yieldSlice: async () => {
        if (options?.isCancelled?.() || options?.signal?.aborted) {
          throwCancelled();
        }
        if (options?.yieldSlice) await options.yieldSlice();
      },
      onProgress: (info) => {
        state.scoringLabel = info.label;
        if (info.bar?.length) {
          state.scoringBarPreview = info.bar;
          state.activePreview = [...info.bar];
        }
        state.finalizeDone = info.done;
        state.finalizeTotal = Math.max(1, info.total);
        emitProgress(options, state, true);
      },
    });

    result = gate.result;
    presentation = gate.presentation;
    parityRejectCount = gate.parityRejectCount;
  }

  if (profile.enabled) {
    const snap = snapshotProfile(profile);
    options?.onProfile?.(snap);
  }

  return buildSolverResultDto({
    request,
    result,
    poolSize: pool.ids.length,
    uniqueBars: state.uniqueBars,
    fullTicks,
    evaluationBudget,
    blessingIds: simBase.league.blessingIds,
    aftershockRank: simBase.procs?.aftershockRank ?? 0,
    options,
    presentation,
    parityRejectCount,
  });
};

/** Host-side helper: resolve ability ids for a solved bar graphic. */
export function resolveSolvedBar(ids: readonly string[]): AbilitySpec[] {
  return resolveSpecs(ids);
}
