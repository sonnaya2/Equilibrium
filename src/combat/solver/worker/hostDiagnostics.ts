/**
 * Host-side solver lifecycle breadcrumbs for memory / worker debugging.
 * Enable with localStorage eq-solver-debug=1 or ?solverDebug=1 on the combat page.
 */

export type SolverHostDiagEvent = {
  readonly at: number;
  readonly kind: string;
  readonly detail?: Readonly<Record<string, unknown>>;
};

export type SolverHostHeapSnapshot = {
  readonly jsHeapUsedMB: number;
  readonly jsHeapTotalMB: number;
  readonly jsHeapLimitMB: number;
};

const MAX_EVENTS = 48;
const events: SolverHostDiagEvent[] = [];

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
};

function mb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

/** True when the page opted into solver host debug logging. */
export function isSolverHostDebugEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.localStorage?.getItem("eq-solver-debug") === "1") return true;
    return new URLSearchParams(window.location.search).has("solverDebug");
  } catch {
    return false;
  }
}

/** Chromium-only heap snapshot; null in Firefox / workers without performance.memory. */
export function snapshotSolverHostHeap(): SolverHostHeapSnapshot | null {
  try {
    const memory = (performance as PerformanceWithMemory).memory;
    if (!memory) return null;
    return {
      jsHeapUsedMB: mb(memory.usedJSHeapSize),
      jsHeapTotalMB: mb(memory.totalJSHeapSize),
      jsHeapLimitMB: mb(memory.jsHeapSizeLimit),
    };
  } catch {
    return null;
  }
}

export function noteSolverHost(kind: string, detail?: Readonly<Record<string, unknown>>): void {
  const entry: SolverHostDiagEvent = {
    at: Date.now(),
    kind,
    ...(detail ? { detail: { ...detail } } : {}),
  };
  events.push(entry);
  if (events.length > MAX_EVENTS) events.shift();
  if (!isSolverHostDebugEnabled()) return;
  if (typeof console === "undefined") return;
  const heap = snapshotSolverHostHeap();
  console.info("[eq-solver]", kind, detail ?? {}, heap ?? "");
}

export function clearSolverHostDiagnostics(): void {
  events.length = 0;
}

export function getSolverHostDiagnostics(poolWorkers = 0): {
  readonly events: readonly SolverHostDiagEvent[];
  readonly poolWorkers: number;
  readonly heap: SolverHostHeapSnapshot | null;
  readonly debugEnabled: boolean;
} {
  return {
    events: events.slice(),
    poolWorkers,
    heap: snapshotSolverHostHeap(),
    debugEnabled: isSolverHostDebugEnabled(),
  };
}
