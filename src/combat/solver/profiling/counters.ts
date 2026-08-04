/**
 * Gated solver profiling counters (SOLVER_PROFILE=1 or explicit option).
 * Measure only; no effect on scoring when disabled.
 */

export type SolverProfileSnapshot = {
  wallMs: number;
  evaluations: number;
  searchEvals: number;
  fullEvals: number;
  evalsPerSec: number;
  memoHits: number;
  uniqueBars: number;
  progressEmits: number;
  /** Reserved for host/worker IPC wait; stub until wired. */
  workerWaitMs: number;
  neighborGenerated: number;
  neighborDeduped: number;
  neighborDuplicateSkipped: number;
  barKeysSeenWithinWorker: number;
  duplicateEvalAttempts: number;
  fingerprintJoins: number;
  beamChildrenGenerated: number;
  beamChildrenUniqueKeys: number;
};

export type SolverProfileCounters = {
  readonly enabled: boolean;
  startMs: number;
  evaluations: number;
  searchEvals: number;
  fullEvals: number;
  memoHits: number;
  uniqueBars: number;
  progressEmits: number;
  workerWaitMs: number;
  neighborGenerated: number;
  neighborDeduped: number;
  neighborDuplicateSkipped: number;
  duplicateEvalAttempts: number;
  fingerprintJoins: number;
  beamChildrenGenerated: number;
  /** Internal sets for unique-key counts (not in snapshot). */
  _barKeys: Set<string>;
  _beamChildKeys: Set<string>;
};

/**
 * Active counters for search hot paths (tryEval / neighbors / beam / fingerprint).
 * Ownership:
 * - "none": free for beginSolverProfileWindow env install
 * - "outer": solveFromRequest bind; begin must not replace
 * - "search": env window from solve/solveAsync; next begin may refresh
 */
type ActiveMode = "none" | "outer" | "search";
let activeProfile: SolverProfileCounters | undefined;
let activeMode: ActiveMode = "none";

/** True when explicit opt-in or env SOLVER_PROFILE=1. */
export function isSolverProfileEnabled(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  if (typeof process === "undefined") return false;
  return process.env?.SOLVER_PROFILE === "1";
}

export function createProfileCounters(enabled: boolean): SolverProfileCounters {
  return {
    enabled,
    startMs: enabled ? nowMs() : 0,
    evaluations: 0,
    searchEvals: 0,
    fullEvals: 0,
    memoHits: 0,
    uniqueBars: 0,
    progressEmits: 0,
    workerWaitMs: 0,
    neighborGenerated: 0,
    neighborDeduped: 0,
    neighborDuplicateSkipped: 0,
    duplicateEvalAttempts: 0,
    fingerprintJoins: 0,
    beamChildrenGenerated: 0,
    _barKeys: new Set(),
    _beamChildKeys: new Set(),
  };
}

/** Outer owner (solveFromRequest): enabled counters or undefined when profiling off. */
export function setActiveSolverProfile(c: SolverProfileCounters | undefined): void {
  activeMode = "outer";
  activeProfile = c?.enabled ? c : undefined;
}

export function clearActiveSolverProfile(): void {
  activeMode = "none";
  activeProfile = undefined;
}

export function getActiveSolverProfile(): SolverProfileCounters | undefined {
  return activeProfile;
}

/** Search-only env window; no-op while outer owns the slot. */
export function beginSearchProfileWindow(): void {
  if (activeMode === "outer") return;
  if (!isSolverProfileEnabled()) {
    activeMode = "none";
    activeProfile = undefined;
    return;
  }
  activeMode = "search";
  activeProfile = createProfileCounters(true);
}

export function noteEval(
  c: SolverProfileCounters | undefined,
  kind: "search" | "full",
  memoHit: boolean,
): void {
  if (!c?.enabled) return;
  c.evaluations += 1;
  if (kind === "full") c.fullEvals += 1;
  else c.searchEvals += 1;
  if (memoHit) c.memoHits += 1;
}

export function noteUniqueBar(c: SolverProfileCounters | undefined): void {
  if (!c?.enabled) return;
  c.uniqueBars += 1;
}

export function noteProgressEmit(c: SolverProfileCounters | undefined): void {
  if (!c?.enabled) return;
  c.progressEmits += 1;
}

/** Accumulates host/worker wait; stub until pool host wires it. */
export function noteWorkerWait(c: SolverProfileCounters | undefined, ms: number): void {
  if (!c?.enabled || !(ms > 0)) return;
  c.workerWaitMs += ms;
}

function target(c?: SolverProfileCounters): SolverProfileCounters | undefined {
  const p = c ?? activeProfile;
  return p?.enabled ? p : undefined;
}

export function noteFingerprintJoin(c?: SolverProfileCounters): void {
  const p = target(c);
  if (!p) return;
  p.fingerprintJoins += 1;
}

export function noteBarKeySeen(barKey: string, c?: SolverProfileCounters): void {
  const p = target(c);
  if (!p) return;
  p._barKeys.add(barKey);
}

export function noteDuplicateEvalAttempt(c?: SolverProfileCounters): void {
  const p = target(c);
  if (!p) return;
  p.duplicateEvalAttempts += 1;
}

/** Count a neighbor batch (pre-cap). Duplicates = key reappearances within the batch. */
export function noteNeighborBatch(
  neighbors: readonly (readonly string[])[],
  c?: SolverProfileCounters,
): void {
  const p = target(c);
  if (!p) return;
  p.neighborGenerated += neighbors.length;
  const seen = new Set<string>();
  for (let i = 0; i < neighbors.length; i++) {
    const key = neighbors[i]!.join("\0");
    if (seen.has(key)) {
      p.neighborDeduped += 1;
      p.neighborDuplicateSkipped += 1;
    } else {
      seen.add(key);
    }
  }
}

export function noteBeamChild(barKey: string, c?: SolverProfileCounters): void {
  const p = target(c);
  if (!p) return;
  p.beamChildrenGenerated += 1;
  p._beamChildKeys.add(barKey);
}

export function snapshotProfile(c: SolverProfileCounters): SolverProfileSnapshot {
  if (!c.enabled) {
    return {
      wallMs: 0,
      evaluations: 0,
      searchEvals: 0,
      fullEvals: 0,
      evalsPerSec: 0,
      memoHits: 0,
      uniqueBars: 0,
      progressEmits: 0,
      workerWaitMs: 0,
      neighborGenerated: 0,
      neighborDeduped: 0,
      neighborDuplicateSkipped: 0,
      barKeysSeenWithinWorker: 0,
      duplicateEvalAttempts: 0,
      fingerprintJoins: 0,
      beamChildrenGenerated: 0,
      beamChildrenUniqueKeys: 0,
    };
  }
  const wallMs = Math.max(0, nowMs() - c.startMs);
  const evalsPerSec = wallMs > 0 ? (c.evaluations * 1000) / wallMs : 0;
  return {
    wallMs,
    evaluations: c.evaluations,
    searchEvals: c.searchEvals,
    fullEvals: c.fullEvals,
    evalsPerSec,
    memoHits: c.memoHits,
    uniqueBars: c.uniqueBars,
    progressEmits: c.progressEmits,
    workerWaitMs: c.workerWaitMs,
    neighborGenerated: c.neighborGenerated,
    neighborDeduped: c.neighborDeduped,
    neighborDuplicateSkipped: c.neighborDuplicateSkipped,
    barKeysSeenWithinWorker: c._barKeys.size,
    duplicateEvalAttempts: c.duplicateEvalAttempts,
    fingerprintJoins: c.fingerprintJoins,
    beamChildrenGenerated: c.beamChildrenGenerated,
    beamChildrenUniqueKeys: c._beamChildKeys.size,
  };
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
