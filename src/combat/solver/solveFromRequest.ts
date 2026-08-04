/**
 * Production entry: serializable request → real engine evaluations → ranked bars.
 * Orchestration only - preparation, session, progress, and result building live
 * in sibling modules. Used by the worker and main-thread fallback.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { SolveResult } from "./contracts";
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
  poolAsSpecs,
  regionDenyList,
  resolveSpecs,
} from "./requestContext";
import { emitProgress, mapPhase, type ProgressState } from "./progressReporter";
import { buildMemoContext, createEvaluateFn } from "./evaluationSession";
import { buildSolverResultDto } from "./resultBuilder";
import {
  createProfileCounters,
  isSolverProfileEnabled,
  setActiveSolverProfile,
  clearActiveSolverProfile,
  snapshotProfile,
} from "./profiling/counters";

/**
 * Production entry: serializable request → real engine evaluations → ranked bars.
 * Used by the worker and main-thread fallback.
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
  const deny = regionDenyList(
    request.style,
    request.unlockedRegions,
    request.includeUnknownAvailability === true,
    disabled,
  );
  const denySet = new Set(deny);

  const { catalogue, pool } = buildCandidatePoolForRequest(request, simBase, denySet);
  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((a) => [a.id, a]));
  for (const a of poolSpecs) abilityMap.set(a.id, a);
  const abilities = [...abilityMap.values()];

  const { exploreTicks, fullTicks, evaluationBudget } = computeHorizonsAndBudget(request);

  const { reviveModifiers, reviveLeague } = await import("./worker/revive");
  const league = reviveLeague(simBase.league);
  const modifiers = reviveModifiers(simBase.modifierSources, league);

  const simCommon = {
    base: simBase.base,
    level: simBase.level,
    accuracy: simBase.accuracy,
    crit: simBase.crit,
    abilities,
    equipmentIds: simBase.equipmentIds,
    weaponConfiguration: simBase.weaponConfiguration,
    startingAdrenaline: simBase.startingAdrenaline,
    adrenaline: simBase.adrenaline,
    procs: simBase.procs,
    plantedFeet: simBase.plantedFeet,
    strengthCape99: simBase.strengthCape99,
    preciseRank: simBase.preciseRank,
    conjureBasicDamageMult: simBase.conjureBasicDamageMult,
    conjureDurationMult: simBase.conjureDurationMult,
    tumekensPieces: simBase.tumekensPieces,
    tumekensCritEnabled: simBase.tumekensCritEnabled,
    equipmentEffects: simBase.equipmentEffects,
    league,
    context: simBase.context,
    targetHpPercent: simBase.targetHpPercent,
    cap: simBase.cap,
    modifiers,
  };

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
    ...(profile.enabled ? { profile } : {}),
  };
  const seenBars = new Set<string>();

  const throwCancelled = (): never => {
    const err = new Error("solver cancelled");
    err.name = "AbortError";
    throw err;
  };

  const memoContext = buildMemoContext(request, simBase);
  const evaluate = createEvaluateFn({
    request,
    pool,
    simCommon,
    exploreTicks,
    fullTicks,
    memoContext,
    state,
    seenBars,
    options,
  });

  // Pool-legal only (weapon/region denylist already applied to the pool).
  const searchPool: PoolAbility[] = pool.ids.map((id) => pool.byId.get(id)!);
  const authored = fitAuthoredSeeds(request, pool, denySet);

  emitProgress(options, state, true);
  if (options?.yieldSlice) await options.yieldSlice();

  const recipe: SolverAgentRecipe = request.agentRecipe ?? "default";
  const recipePatch = configPatchForRecipe(request.tier, recipe);

  setActiveSolverProfile(profile.enabled ? profile : undefined);
  let result: SolveResult;
  try {
  result = await solveAsync(
    {
      pool: searchPool,
      sizeBounds: { min: request.minBarSize, max: request.maxBarSize },
      evaluate,
      tier: request.tier,
      seed: request.seed,
      authoredSeeds: authored,
      config: {
        profileId: request.profileId,
        ...recipePatch,
        evaluationBudget,
      },
    },
    {
      onPhase: (phase) => {
        state.currentPhase = mapPhase(phase);
        if (phase === "finalize") state.finalizeActive = true;
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
        // Double rAF-style yield: setTimeout(0) alone can still starve paint.
        await options?.yieldSlice?.();
        await new Promise((r) => setTimeout(r, 0));
      },
    },
  );
  } finally {
    clearActiveSolverProfile();
  }

  if (options?.isCancelled?.() || options?.signal?.aborted) {
    throwCancelled();
  }

  // Finalize already full-rescored the shortlist - no second 300s winner sim.
  state.currentPhase = "finalize";
  emitProgress(options, state, true);

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
    options,
  });
};

/** Host-side helper: resolve ability ids for a solved bar graphic. */
export function resolveSolvedBar(ids: readonly string[]): AbilitySpec[] {
  return resolveSpecs(ids);
}
