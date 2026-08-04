/**
 * Scope-local reuse of land-time EventResolution when the full hit identity matches.
 * Leng multi-branch re-resolves the same ability hit on arms that only differ in
 * post-hit state (e.g. primordial ice stacks). Cache is active only inside
 * runWithHitReuseScope; inactive path has zero lookup cost.
 */

import type { EventResolution } from "./types";

let depth = 0;
let cache: Map<string, EventResolution> | null = null;

/** Nested scopes share one map; cleared when outermost exits. */
export function runWithHitReuseScope<T>(fn: () => T): T {
  if (depth === 0) cache = new Map();
  depth += 1;
  try {
    return fn();
  } finally {
    depth -= 1;
    if (depth === 0) cache = null;
  }
}

export function isHitReuseActive(): boolean {
  return cache !== null;
}

export function hitReuseGet(key: string): EventResolution | undefined {
  return cache?.get(key);
}

export function hitReuseSet(key: string, value: EventResolution): void {
  cache?.set(key, value);
}

/** Test / profile: entries stored in the active scope (0 when inactive). */
export function hitReuseSize(): number {
  return cache?.size ?? 0;
}
