import type { PoolAbility, SizeBounds } from "../contracts";
import { exclusiveKey } from "../eligibility";
import type { SearchState } from "./types";
import { maybeYield, type YieldCtx } from "./yield";

/**
 * Upper-bound count of ordered bars respecting size bounds + exclusivity groups.
 * Independent ids: choose & permute. Group of size g: 0 or 1 pick (g choices).
 */
export function estimateFeasibleCount(
  pool: readonly PoolAbility[],
  sizeBounds: SizeBounds,
): number {
  const groups = new Map<string, number>();
  let independents = 0;
  for (const a of pool) {
    const g = exclusiveKey(a);
    if (g) groups.set(g, (groups.get(g) ?? 0) + 1);
    else independents += 1;
  }

  const slots: number[] = [];
  for (let i = 0; i < independents; i++) slots.push(1);
  for (const gSize of groups.values()) slots.push(gSize);

  let ways = new Map<number, number>([[0, 1]]);
  for (const options of slots) {
    const next = new Map<number, number>();
    for (const [k, w] of ways) {
      next.set(k, (next.get(k) ?? 0) + w);
      next.set(k + 1, (next.get(k + 1) ?? 0) + w * options);
    }
    ways = next;
  }

  let total = 0;
  for (let k = sizeBounds.min; k <= sizeBounds.max; k++) {
    const combos = ways.get(k) ?? 0;
    if (combos === 0) continue;
    total += combos * factorial(k);
    if (!Number.isFinite(total) || total > 1e15) return Number.POSITIVE_INFINITY;
  }
  return total;
}

function factorial(n: number): number {
  let x = 1;
  for (let i = 2; i <= n; i++) {
    x *= i;
    if (x > 1e15) return Number.POSITIVE_INFINITY;
  }
  return x;
}

export function shouldRunExhaustive(
  estimate: number,
  budgetRemaining: number,
  exhaustiveMax: number,
): boolean {
  if (!Number.isFinite(estimate) || estimate <= 0) return false;
  return estimate <= Math.min(budgetRemaining, exhaustiveMax);
}

/**
 * Backtracking ordered subsets with exclusivity; evaluates each legal bar.
 * Returns true when the full tree fit in budget (globally-optimal claim ok).
 */
export function runExhaustive(state: SearchState): boolean {
  return runExhaustiveSync(state);
}

function runExhaustiveSync(state: SearchState): boolean {
  const estimate = estimateFeasibleCount(state.pool, state.sizeBounds);
  if (
    !shouldRunExhaustive(estimate, state.budget.remaining, state.config.exhaustiveMax)
  ) {
    return false;
  }

  const before = state.budget.used;
  const pool = state.pool;
  const { min, max } = state.sizeBounds;
  const used = new Set<string>();
  const usedGroups = new Set<string>();
  const bar: string[] = [];

  const rec = (): void => {
    if (bar.length >= min && bar.length <= max) {
      if (!state.canEval()) return;
      state.tryEval(bar, "search", "exhaustive");
    }
    if (bar.length >= max || !state.canEval()) return;

    for (let i = 0; i < pool.length; i++) {
      if (!state.canEval()) return;
      const a = pool[i]!;
      if (used.has(a.id)) continue;
      const g = exclusiveKey(a);
      if (g && usedGroups.has(g)) continue;

      used.add(a.id);
      if (g) usedGroups.add(g);
      bar.push(a.id);
      rec();
      bar.pop();
      used.delete(a.id);
      if (g) usedGroups.delete(g);
    }
  };

  rec();
  finishExhaustive(state, before, estimate);
  return state.exhaustiveCompleted;
}

export async function runExhaustiveAsync(
  state: SearchState,
  yieldCtx?: YieldCtx,
): Promise<boolean> {
  const estimate = estimateFeasibleCount(state.pool, state.sizeBounds);
  if (
    !shouldRunExhaustive(estimate, state.budget.remaining, state.config.exhaustiveMax)
  ) {
    return false;
  }

  const before = state.budget.used;
  const pool = state.pool;
  const { min, max } = state.sizeBounds;
  const used = new Set<string>();
  const usedGroups = new Set<string>();
  const bar: string[] = [];

  const rec = async (): Promise<void> => {
    if (bar.length >= min && bar.length <= max) {
      if (!state.canEval()) return;
      state.tryEval(bar, "search", "exhaustive");
      if (yieldCtx) await maybeYield(state, yieldCtx);
    }
    if (bar.length >= max || !state.canEval()) return;

    for (let i = 0; i < pool.length; i++) {
      if (!state.canEval()) return;
      const a = pool[i]!;
      if (used.has(a.id)) continue;
      const g = exclusiveKey(a);
      if (g && usedGroups.has(g)) continue;

      used.add(a.id);
      if (g) usedGroups.add(g);
      bar.push(a.id);
      await rec();
      bar.pop();
      used.delete(a.id);
      if (g) usedGroups.delete(g);
    }
  };

  await rec();
  finishExhaustive(state, before, estimate);
  return state.exhaustiveCompleted;
}

function finishExhaustive(state: SearchState, before: number, estimate: number): void {
  const usedEvals = state.budget.used - before;
  state.exhaustiveCompleted = state.budget.remaining > 0 || usedEvals >= estimate;
  if (state.budget.remaining === 0 && usedEvals < estimate) {
    state.exhaustiveCompleted = usedEvals >= estimate;
  }
}
