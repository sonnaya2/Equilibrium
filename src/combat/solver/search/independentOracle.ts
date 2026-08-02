import type { EvaluateFn, PoolAbility, SizeBounds } from "../contracts";
import { exclusiveKey } from "../eligibility";

export type OracleBarResult = {
  bar: string[];
  score: number;
};

/**
 * Enumerate every legal ordered bar for a deliberately tiny pool and pick the
 * highest score using the production evaluator. Independent of solver search,
 * ranking stores, pruning, and neighbor generation.
 */
export function enumerateLegalBars(
  pool: readonly PoolAbility[],
  sizeBounds: SizeBounds,
): string[][] {
  const out: string[][] = [];
  const used = new Set<string>();
  const usedGroups = new Set<string>();
  const bar: string[] = [];
  const { min, max } = sizeBounds;

  const rec = (): void => {
    if (bar.length >= min && bar.length <= max) {
      out.push([...bar]);
    }
    if (bar.length >= max) return;
    for (const a of pool) {
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
  return out;
}

export function independentOptimum(
  pool: readonly PoolAbility[],
  sizeBounds: SizeBounds,
  evaluate: EvaluateFn,
): OracleBarResult {
  const bars = enumerateLegalBars(pool, sizeBounds);
  if (bars.length === 0) {
    throw new Error("independentOptimum: empty legal set");
  }
  let best: OracleBarResult | null = null;
  for (const bar of bars) {
    const result = evaluate({ bar });
    const score = result.score;
    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score) {
      best = { bar: [...bar], score };
    }
  }
  if (!best) throw new Error("independentOptimum: no finite scores");
  return best;
}
