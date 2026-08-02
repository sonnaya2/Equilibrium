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
  isFiniteEval,
} from "./objective";

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
export { buildSeeds, type SeedOptions } from "./seeds";
export {
  solve,
  solveAsync,
  configForTier,
  TIER_BUDGETS,
  TIER_HORIZON_SECONDS,
  preferredAgentCount,
  type SolveInput,
  type SolveAsyncHooks,
  type SolvePhaseName,
} from "./solve";
export { clearEvalMemo, evalMemoStats } from "./evalMemo";
export { solveFromRequest, resolveSolvedBar } from "./solveFromRequest";
export { packSolverRequest, packSimBase } from "./packRequest";
export {
  REVO_SOLVE_CACHE_KEY,
  MIN_SOLVER_BAR_SIZE,
  DEFAULT_MAX_BAR_SIZE,
  fingerprintSolveContext,
  loadSolveCache,
  rememberSolvedBar,
  lookupSolvedBar,
  seedBarsFromSolveCache,
  clampSolverBarSizes,
  type CachedSolveEntry,
  type SolveCacheStore,
} from "./solutionStore";
export type {
  SerializableSolverRequest,
  SolverResultDTO,
  SerializableRevolutionSimBase,
  SolverSearchTier,
} from "./worker/serializable";
export type { SolverProgress } from "./worker/protocol";
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
