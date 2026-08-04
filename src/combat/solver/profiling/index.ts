/**
 * Solver profiling surface: eval/progress counters + Phase 0 duplicate-work counters.
 * Gate: SOLVER_PROFILE=1 or createProfileCounters(true) / options.profile.
 */

export {
  isSolverProfileEnabled,
  createProfileCounters,
  setActiveSolverProfile,
  clearActiveSolverProfile,
  getActiveSolverProfile,
  beginSearchProfileWindow,
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
} from "./counters";

export { isSolverProfileEnabled as isSolverProfilingEnabled } from "./counters";

import {
  beginSearchProfileWindow,
  clearActiveSolverProfile,
  createProfileCounters,
  getActiveSolverProfile,
  setActiveSolverProfile,
  snapshotProfile,
  type SolverProfileSnapshot,
} from "./counters";

/** Alias used by solve/solveAsync entry. */
export const beginSolverProfileWindow = beginSearchProfileWindow;

/** Tests / explicit bind without env. */
export function enableSolverProfiling(on = true): void {
  if (on) setActiveSolverProfile(createProfileCounters(true));
  else clearActiveSolverProfile();
}

export function resetSolverProfileCounters(): void {
  if (getActiveSolverProfile()?.enabled) {
    setActiveSolverProfile(createProfileCounters(true));
  } else {
    clearActiveSolverProfile();
  }
}

/** Snapshot of the active process-local profile (search path / tests). */
export function getSolverDuplicateCounters(): SolverProfileSnapshot {
  const c = getActiveSolverProfile();
  return snapshotProfile(c ?? createProfileCounters(false));
}

/** Alias type for Phase 0 naming. */
export type SolverDuplicateCounters = SolverProfileSnapshot;
