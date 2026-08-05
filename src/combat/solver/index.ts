/** Pure solver foundation + search orchestrator. */

export {
  SOLVER_SCHEMA_VERSION,
  type Bar,
  type SearchTier,
  type ProofLabel,
  type ObjectiveProfileId,
  type ObjectiveWindowId,
  type SizeBounds,
  type SeedBar,
  type ObjectiveWindowWeights,
  type RobustMixWeights,
  type ObjectiveWeights,
  type ObjectiveWindowSpec,
  type ScoreableSummary,
  type SolverBranchExactness,
  type ObjectiveWindowDpms,
  type ObjectiveScoreOk,
  type ObjectiveScoreFail,
  type ObjectiveScore,
  type ScoredBar,
  type SearchStats,
  type SolverRequest,
  type SolverResult,
  type EvalResult,
  type EvalMode,
  type SolveTier,
  type AbilityCategory,
  type PoolAbility,
  type EvaluateFn,
  type SolveResult,
  type ExclusionCode,
  type ExclusionReason,
  type CandidatePoolOptions,
  type CandidatePool,
  type BarSizeBounds,
  type RevolutionEvalRequest,
  type RevolutionBarEvaluation,
} from "./contracts";

export { createRng, type Rng } from "./rng";

export {
  barKey,
  fingerprintBar,
  stableStringify,
  fingerprintEvaluationKey,
  type EvaluationKeyParts,
} from "./fingerprint";

export {
  enableSolverProfiling,
  resetSolverProfileCounters,
  beginSolverProfileWindow,
  getSolverDuplicateCounters,
} from "./profiling";

export { EvalCache, createEvalCache } from "./cache";

export {
  OBJECTIVE_HORIZON_SECONDS,
  OBJECTIVE_HORIZON_TICKS,
  MIN_RANKABLE_HORIZON_TICKS,
  OBJECTIVE_WINDOWS,
  objectiveWindowsForHorizon,
  OBJECTIVE_PRESETS,
  resolveObjectiveWeights,
  validateObjectiveWeights,
  sumDamageInTickRange,
  windowDpmFromDamageByTick,
  scoreFromDamageByTick,
  scoreSummary,
  isFiniteEval,
  NON_EXACT_BRANCH_EXACTNESS,
  isNonExactBranchExactness,
  summaryEligibleForObjectiveScore,
  exactnessEligibleForExactProof,
} from "./objective";

export {
  reevaluateIncumbentBar,
  compareVigourSearch,
  type VigourEvalContext,
  type CompareVigourSearchInput,
  type CompareVigourSearchResult,
} from "./vigourIncumbent";

export {
  validateBarEligibility,
  isBarEligible,
  normalizeSizeBounds,
  exclusiveKey,
  canAdd,
  remainingCandidates,
  createEligibilityMemo,
  eligibilityOptionKey,
  type EligibilityOptions,
  type EligibilityMemo,
} from "./eligibility";

export { buildCandidatePool, indexPool, poolAbilityFromSpec } from "./candidatePool";
export { evaluateRevolutionBar } from "./evaluate";
export {
  compileEvaluationContext,
  compileEvaluationContextFromEvalRequest,
  type CompiledEvaluationContext,
  type CompiledAbilityRegistry,
  type CompileEvaluationContextInput,
} from "./compiledContext";

export { barDistance, diverseSelect } from "./diversity";
export { buildSeeds, normalizeAuthoredSeed, type SeedOptions } from "./seeds";
export {
  solve,
  solveAsync,
  configForTier,
  agentSearchRecipe,
  configPatchForRecipe,
  TIER_BUDGETS,
  TIER_HORIZON_SECONDS,
  preferredAgentCount,
  type SolveInput,
  type SolveAsyncHooks,
  type SolvePhaseName,
  type SolverAgentRecipe,
} from "./solve";
export { clearEvalMemo, evalMemoStats } from "./evalMemo";
export {
  allocateFidelityBudget,
  mediumHorizonTicks,
  fidelityForEvalMode,
  FIDELITY_BUDGET_SHARES,
  type EvalFidelity,
  type FidelityBudgetAllocation,
} from "./fidelity";
export {
  DEFAULT_BRANCH_FIDELITY_LADDERS,
  UI_RUN_BRANCH_FIDELITY_LADDER,
  RESIDUAL_FREE_TOLERANCE,
  resolveBranchFidelityLadder,
  meetsBranchCompleteness,
  shouldStopAdaptiveAttempt,
  simulateWithAdaptiveBranchFidelity,
  simulateRevolutionForUi,
  budgetForLiveCap,
  branchFidelityModeForEval,
  type BranchFidelityMode,
  type BranchFidelityLadder,
  type BranchExactnessRequirement,
  type BranchFidelityAttemptMeta,
  type AdaptiveBranchFidelityResult,
} from "./branchFidelity";
export {
  pickBestUiRunProbe,
  preferredUiRunWorkerCount,
  simulateRevolutionForUiHybrid,
  type UiRunProbeResult,
} from "./uiRunCore";
export {
  runUiRevolution,
  cancelUiRevolutionWorkers,
  resetUiRunHostForTests,
  type UiRunProgress,
  type UiRunHostOptions,
} from "./worker/uiRunHost";
export type { SerializableUiRunRequest } from "./worker/uiRunTypes";
export { runMediumScreen, collectMediumIncumbents } from "./search/mediumScreen";
export { solveFromRequest, resolveSolvedBar } from "./solveFromRequest";
export {
  createProfileCounters,
  isSolverProfileEnabled,
  setActiveSolverProfile,
  clearActiveSolverProfile,
  getActiveSolverProfile,
  noteEval,
  noteUniqueBar,
  noteProgressEmit,
  noteWorkerWait,
  noteFingerprintJoin,
  noteBarKeySeen,
  noteDuplicateEvalAttempt,
  noteNeighborBatch,
  noteBeamChild,
  snapshotProfile,
  type SolverProfileCounters,
  type SolverProfileSnapshot,
} from "./profiling/counters";
export {
  packSolverRequest,
  packSimBase,
  packSimBaseFromModel,
  resolvePackSimBase,
  type SolverPackSnapshot,
  type PackSolverRequestInput,
} from "./packRequest";
export { serializeLeague } from "./worker/revive";
export {
  MIN_SOLVER_BAR_SIZE,
  DEFAULT_MAX_BAR_SIZE,
  ABSOLUTE_MAX_BAR_SIZE,
  BAR_LENGTH_COUNT,
  clampSolverBarSizes,
  agentBarLength,
  agentBarSizeBounds,
  barLengthSpan,
} from "./barPolicy";
export {
  planWorkers,
  TIER_MAX_AGENTS,
  SAFE_GLOBAL_AGENT_CEILING,
  RESERVES_UI_CORE,
  shouldReserveUiCore,
  detectHardwareCores,
  recipesForTier,
  planRecipe,
  type WorkerAssignment,
  type WorkerPlan,
  type WorkerPlanInput,
  type WorkerRecipe,
} from "./workerPlan";
export {
  compareSolverResultDTO,
  pickBestSolverResult,
  isRankableSolverResult,
  isEffectivelyEqualScore,
  compareTopEntry,
} from "./rankResults";
export {
  REVO_SOLVE_CACHE_KEY,
  TIER_BAR_SIZE_BOUNDS,
  fingerprintSolveContext,
  solveContextPayload,
  loadSolveCache,
  rememberSolvedBar,
  lookupSolvedBar,
  seedBarsFromSolveCache,
  type CachedSolveEntry,
  type SolveCacheStore,
} from "./solutionStore";
export {
  SEARCH_POLICY_VERSION,
  canonicalNormalizedIdentity,
  canonicalSolveContext,
  canonicalEvaluationContext,
  canonicalSimulationIdentity,
  solveIdentityFromRequest,
  resultMatchesRequestIdentity,
  isVerifiedCacheableResult,
  VERIFIED_CACHEABLE_PROOFS,
  NON_CACHEABLE_PROOFS,
} from "./identity";
export type {
  SerializableSolverRequest,
  SolverResultDTO,
  SolverResultHonestyDTO,
  SerializableRevolutionSimBase,
  SolverSearchTier,
} from "./worker/serializable";
export {
  buildSolverResultHonesty,
  dtoAllowsApply,
  residualMassOfDto,
  branchExactnessOfDto,
  type SolverResultHonesty,
} from "./solverDtoHonesty";
export {
  branchFidelityLadderMemoToken,
  branchFidelityCacheToken,
} from "./branchFidelity";
export type { SolverProgress, SolverAgentSnapshot } from "./worker/protocol";
export {
  runOptimize,
  cancelOptimize,
  runSolverOnMainThread,
  solverPoolSize,
  type RunOptimizeOptions,
} from "./worker/host";

export {
  createSearchState,
  compareScored,
  type SearchState,
  type SearchConfig,
} from "./search/types";
export { estimateFeasibleCount, shouldRunExhaustive, runExhaustive } from "./search/exhaustive";
export { runConstructiveBeam } from "./search/constructiveBeam";
export { runLocalSearch, generateNeighbors } from "./search/localSearch";
export { runLargeNeighborhood } from "./search/largeNeighborhood";
export { runEvolutionary, orderCrossover } from "./search/evolutionary";
export { runAnnealing } from "./search/annealing";
export { finalizeSearch, finalizeSearchAsync } from "./search/finalize";
