/**
 * Runtime allocation-churn counters (Phase 0: measure only).
 * Off by default; enable with setAllocationProfiling(true) or RS3_ALLOC_PROFILE=1.
 * Does not change sim/solver math.
 */

export interface AllocationCounters {
  /** createRuntime() invocations */
  runtimeObjectsCreated: number;
  /**
   * evaluateRevolutionBar rebuilds abilityMap (new Map + 3 fill loops) every bar.
   * Primary evaluate.ts allocation hotspot.
   */
  abilityMapRebuilds: number;
  /** evaluateRevolutionBar spreads abilityMap into a fresh catalogue array every bar */
  catalogueArrayRebuilds: number;
  /** EventQueue push + shift + cancel (combined) */
  eventQueueOps: number;
  eventQueuePush: number;
  eventQueueShift: number;
  eventQueueCancel: number;
  /** rt.casts.push sites */
  castsGrowthOps: number;
  /** rt.events.push sites (resolved history log) */
  historyEventsGrowthOps: number;
}

const ZERO: AllocationCounters = {
  runtimeObjectsCreated: 0,
  abilityMapRebuilds: 0,
  catalogueArrayRebuilds: 0,
  eventQueueOps: 0,
  eventQueuePush: 0,
  eventQueueShift: 0,
  eventQueueCancel: 0,
  castsGrowthOps: 0,
  historyEventsGrowthOps: 0,
};

/** Live counters object (mutate in place when enabled). */
export const allocationCounters: AllocationCounters = { ...ZERO };

let enabled = false;

function envWantsProfiling(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env.RS3_ALLOC_PROFILE ?? process.env.ALLOCATION_PROFILE;
  return v === "1" || v === "true";
}

enabled = envWantsProfiling();

export function isAllocationProfilingEnabled(): boolean {
  return enabled;
}

export function setAllocationProfiling(on: boolean): void {
  enabled = on;
}

export function resetAllocationCounters(): void {
  allocationCounters.runtimeObjectsCreated = 0;
  allocationCounters.abilityMapRebuilds = 0;
  allocationCounters.catalogueArrayRebuilds = 0;
  allocationCounters.eventQueueOps = 0;
  allocationCounters.eventQueuePush = 0;
  allocationCounters.eventQueueShift = 0;
  allocationCounters.eventQueueCancel = 0;
  allocationCounters.castsGrowthOps = 0;
  allocationCounters.historyEventsGrowthOps = 0;
}

/** Snapshot copy of counters (safe to log / serialize). */
export function snapshotAllocationCounters(): AllocationCounters {
  return { ...allocationCounters };
}

/** Alias of snapshotAllocationCounters. */
export function getAllocationCounters(): AllocationCounters {
  return snapshotAllocationCounters();
}

export function noteRuntimeCreated(): void {
  if (!enabled) return;
  allocationCounters.runtimeObjectsCreated += 1;
}

export function noteAbilityMapRebuild(): void {
  if (!enabled) return;
  allocationCounters.abilityMapRebuilds += 1;
}

export function noteCatalogueArrayRebuild(): void {
  if (!enabled) return;
  allocationCounters.catalogueArrayRebuilds += 1;
}

export function noteEventQueuePush(): void {
  if (!enabled) return;
  allocationCounters.eventQueueOps += 1;
  allocationCounters.eventQueuePush += 1;
}

export function noteEventQueueShift(): void {
  if (!enabled) return;
  allocationCounters.eventQueueOps += 1;
  allocationCounters.eventQueueShift += 1;
}

export function noteEventQueueCancel(count = 1): void {
  if (!enabled || count <= 0) return;
  allocationCounters.eventQueueOps += count;
  allocationCounters.eventQueueCancel += count;
}

export function noteCastsGrowth(): void {
  if (!enabled) return;
  allocationCounters.castsGrowthOps += 1;
}

export function noteHistoryEventsGrowth(): void {
  if (!enabled) return;
  allocationCounters.historyEventsGrowthOps += 1;
}
