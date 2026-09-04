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
  requiredAbilityIds: readonly string[] = [],
): number {
  const constrained = constrainPool(pool, requiredAbilityIds);
  if (!constrained) return 0;
  const requiredCount = constrained.requiredIds.length;
  if (requiredCount > sizeBounds.max) return 0;

  const groups = new Map<string, number>();
  let independents = 0;
  for (const a of constrained.optionalPool) {
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
  const minimumOptional = Math.max(0, sizeBounds.min - requiredCount);
  const maximumOptional = sizeBounds.max - requiredCount;
  for (let optionalCount = minimumOptional; optionalCount <= maximumOptional; optionalCount++) {
    const combos = ways.get(optionalCount) ?? 0;
    if (combos === 0) continue;
    total += combos * factorial(optionalCount + requiredCount);
    if (!Number.isFinite(total) || total > 1e15) return Number.POSITIVE_INFINITY;
  }
  return total;
}

function constrainPool(
  pool: readonly PoolAbility[],
  requiredAbilityIds: readonly string[],
): { requiredIds: string[]; optionalPool: PoolAbility[] } | null {
  const byId = new Map(pool.map((ability) => [ability.id, ability] as const));
  const requiredIds = [...new Set(requiredAbilityIds)];
  const requiredSet = new Set(requiredIds);
  const requiredGroups = new Set<string>();

  for (const id of requiredIds) {
    const ability = byId.get(id);
    if (!ability) return null;
    const group = exclusiveKey(ability);
    if (!group) continue;
    if (requiredGroups.has(group)) return null;
    requiredGroups.add(group);
  }

  const optionalPool = pool.filter((ability) => {
    if (requiredSet.has(ability.id)) return false;
    const group = exclusiveKey(ability);
    return !group || !requiredGroups.has(group);
  });
  return { requiredIds, optionalPool };
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
 * Returns true when the full tree fit in budget (search-objective exhaustive only;
 * does not prove full-horizon global optimum).
 */
export function runExhaustive(state: SearchState): boolean {
  return runExhaustiveSync(state);
}

function runExhaustiveSync(state: SearchState): boolean {
  const constrained = constrainPool(state.pool, state.requiredAbilityIds);
  if (!constrained) return false;
  const estimate = estimateFeasibleCount(state.pool, state.sizeBounds, state.requiredAbilityIds);
  if (!shouldRunExhaustive(estimate, state.budget.remaining, state.config.exhaustiveMax)) {
    return false;
  }

  const before = state.budget.used;
  const allowed = new Set([
    ...constrained.requiredIds,
    ...constrained.optionalPool.map((ability) => ability.id),
  ]);
  const pool = state.pool.filter((ability) => allowed.has(ability.id));
  const { min, max } = state.sizeBounds;
  const required = new Set(constrained.requiredIds);
  const missingRequired = new Set(constrained.requiredIds);
  const used = new Set<string>();
  const usedGroups = new Set<string>();
  const bar: string[] = [];

  const rec = (): void => {
    if (bar.length + missingRequired.size > max) return;
    if (missingRequired.size === 0 && bar.length >= min && bar.length <= max) {
      if (!state.canEval()) return;
      state.tryEval(bar, "search", "exhaustive");
    }
    if (bar.length >= max || !state.canEval()) return;

    for (let i = 0; i < pool.length; i++) {
      if (!state.canEval()) return;
      const a = pool[i]!;
      if (used.has(a.id)) continue;
      if (!required.has(a.id) && bar.length + missingRequired.size >= max) continue;
      const g = exclusiveKey(a);
      if (g && usedGroups.has(g)) continue;

      used.add(a.id);
      if (g) usedGroups.add(g);
      const wasRequired = missingRequired.delete(a.id);
      bar.push(a.id);
      rec();
      bar.pop();
      if (wasRequired) missingRequired.add(a.id);
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
  const constrained = constrainPool(state.pool, state.requiredAbilityIds);
  if (!constrained) return false;
  const estimate = estimateFeasibleCount(state.pool, state.sizeBounds, state.requiredAbilityIds);
  if (!shouldRunExhaustive(estimate, state.budget.remaining, state.config.exhaustiveMax)) {
    return false;
  }

  const before = state.budget.used;
  const allowed = new Set([
    ...constrained.requiredIds,
    ...constrained.optionalPool.map((ability) => ability.id),
  ]);
  const pool = state.pool.filter((ability) => allowed.has(ability.id));
  const { min, max } = state.sizeBounds;
  const required = new Set(constrained.requiredIds);
  const missingRequired = new Set(constrained.requiredIds);
  const used = new Set<string>();
  const usedGroups = new Set<string>();
  const bar: string[] = [];

  const rec = async (): Promise<void> => {
    if (bar.length + missingRequired.size > max) return;
    if (missingRequired.size === 0 && bar.length >= min && bar.length <= max) {
      if (!state.canEval()) return;
      state.tryEval(bar, "search", "exhaustive");
      if (yieldCtx) await maybeYield(state, yieldCtx);
    }
    if (bar.length >= max || !state.canEval()) return;

    for (let i = 0; i < pool.length; i++) {
      if (!state.canEval()) return;
      const a = pool[i]!;
      if (used.has(a.id)) continue;
      if (!required.has(a.id) && bar.length + missingRequired.size >= max) continue;
      const g = exclusiveKey(a);
      if (g && usedGroups.has(g)) continue;

      used.add(a.id);
      if (g) usedGroups.add(g);
      const wasRequired = missingRequired.delete(a.id);
      bar.push(a.id);
      await rec();
      bar.pop();
      if (wasRequired) missingRequired.add(a.id);
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
