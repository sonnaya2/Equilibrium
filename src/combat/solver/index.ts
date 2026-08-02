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
  OBJECTIVE_WINDOWS,
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
  type SolveInput,
  type SolveAsyncHooks,
  type SolvePhaseName,
} from "./solve";
export { solveFromRequest, resolveSolvedBar } from "./solveFromRequest";
export { packSolverRequest, packSimBase } from "./packRequest";
export type {
  SerializableSolverRequest,
  SolverResultDTO,
  SerializableRevolutionSimBase,
  SolverSearchTier,
} from "./worker/serializable";
export type { SolverProgress } from "./worker/protocol";
export { runSolverInWorker, runSolverOnMainThread } from "./worker/host";

export {
  createSearchState,
  compareScored,
  type SearchState,
  type SearchConfig,
} from "./search/types";
export {
  estimateFeasibleCount,
  shouldRunExhaustive,
  runExhaustive,
} from "./search/exhaustive";
export { runConstructiveBeam } from "./search/constructiveBeam";
export { runLocalSearch, generateNeighbors } from "./search/localSearch";
export { runLargeNeighborhood } from "./search/largeNeighborhood";
export { runEvolutionary, orderCrossover } from "./search/evolutionary";
export { runAnnealing } from "./search/annealing";
export { finalizeSearch } from "./search/finalize";
