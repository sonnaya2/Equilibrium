import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import type { SolverProgress } from "./protocol";
import type { SolverProfileSnapshot } from "../profiling/counters";

export type SolveProgressHandler = (progress: SolverProgress) => void;

export interface SolveRuntimeOptions {
  signal?: { aborted: boolean };
  onProgress?: SolveProgressHandler;
  isCancelled?: () => boolean;
  /** When true, the solve loop should await until cleared (cooperative pause). */
  isPaused?: () => boolean;
  /** Optional yield hook for main-thread fallback chunking. */
  yieldSlice?: () => Promise<void>;
  /**
   * Force profiler on/off. When omitted, env SOLVER_PROFILE=1 enables it.
   * Scoring is unchanged either way.
   */
  profile?: boolean;
  /** Invoked once after a successful solve when profiling was enabled. */
  onProfile?: (snapshot: SolverProfileSnapshot) => void;
}

export type SolveFn = (
  request: SerializableSolverRequest,
  options?: SolveRuntimeOptions,
) => Promise<SolverResultDTO>;
