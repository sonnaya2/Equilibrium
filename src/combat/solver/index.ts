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
  fingerprintBar,
  stableStringify,
  fingerprintEvaluationKey,
  type EvaluationKeyParts,
} from "./fingerprint";

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
  scoreSimulation,
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
  type EligibilityOptions,
} from "./eligibility";

export { buildCandidatePool, indexPool, poolAbilityFromSpec } from "./candidatePool";
export { evaluateRevolutionBar } from "./evaluate";

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
  TIER_AGENT_COUNT,
  AGENTS_PER_RECIPE,
  type SolveInput,
  type SolveAsyncHooks,
  type SolvePhaseName,
  type SolverAgentRecipe,
} from "./solve";
export { clearEvalMemo, evalMemoStats } from "./evalMemo";
export { solveFromRequest, resolveSolvedBar } from "./solveFromRequest";
export {
  packSolverRequest,
  packSimBase,
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
  normalizeSolverBarBounds,
  agentBarLength,
  agentBarSizeBounds,
  agentCountForBarSizes,
  barLengthSpan,
} from "./barPolicy";
export {
  planWorkers,
  tierAgentCount,
  TIER_MAX_AGENTS,
  SAFE_GLOBAL_AGENT_CEILING,
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
  isVerifiedCacheableResult,
  VERIFIED_CACHEABLE_PROOFS,
  NON_CACHEABLE_PROOFS,
} from "./identity";
export type {
  SerializableSolverRequest,
  SolverResultDTO,
  SerializableRevolutionSimBase,
  SolverSearchTier,
} from "./worker/serializable";
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
