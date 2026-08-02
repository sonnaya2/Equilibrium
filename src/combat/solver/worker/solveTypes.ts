import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import type { SolverProgress } from "./protocol";

export type SolveProgressHandler = (progress: SolverProgress) => void;

export interface SolveRuntimeOptions {
  signal?: { aborted: boolean };
  onProgress?: SolveProgressHandler;
  isCancelled?: () => boolean;
  /** When true, the solve loop should await until cleared (cooperative pause). */
  isPaused?: () => boolean;
  /** Optional yield hook for main-thread fallback chunking. */
  yieldSlice?: () => Promise<void>;
}

export type SolveFn = (
  request: SerializableSolverRequest,
  options?: SolveRuntimeOptions,
) => Promise<SolverResultDTO>;
