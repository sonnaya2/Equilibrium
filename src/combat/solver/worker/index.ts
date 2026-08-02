export {
  SOLVER_SCHEMA_VERSION,
  defaultSerializableRequest,
  emptyModifierSources,
  isSerializableSimBase,
  type AbilityCategory,
  type AuthoredSeedBar,
  type SerializableLeagueRules,
  type SerializableLoadoutPlain,
  type SerializableModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverLoadoutPayload,
  type SolverProofDTO,
  type SolverResultDTO,
  type SolverSearchTier,
} from "./serializable";

export {
  isHostToWorkerMessage,
  isWorkerToHostMessage,
  type CancelledSolverMessage,
  type CancelSolverMessage,
  type ErrorSolverMessage,
  type HostToWorkerMessage,
  type PauseSolverMessage,
  type ProgressSolverMessage,
  type ResultSolverMessage,
  type ResumeSolverMessage,
  type StartedSolverMessage,
  type SolverPhase,
  type SolverProgress,
  type StartSolverMessage,
  type WorkerToHostMessage,
} from "./protocol";

export {
  buildRevolutionInput,
  requireSimBase,
  reviveLeague,
  reviveModifiers,
  reviveRevolutionBase,
  serializeLeague,
  type RevivedRevolutionBase,
} from "./revive";

/** Product + low-level host. Client/test hooks: deep-import ./host. */
export {
  runOptimize,
  cancelOptimize,
  runSolverOnMainThread,
  solverPoolSize,
  type RunOptimizeOptions,
  type PauseResumeResult,
} from "./host";

export { SolverAgentPool, getSolverAgentPool, solverPoolSize as poolSize } from "./pool";

export type { SolveFn, SolveProgressHandler, SolveRuntimeOptions } from "./solveTypes";

export {
  deleteCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
  type SolverCheckpoint,
} from "./checkpoint";
