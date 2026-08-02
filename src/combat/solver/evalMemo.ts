/**
 * Process-local evaluation memo (main thread or a long-lived worker).
 * Survives re-runs in the same JS context so Optimize again on the same loadout
 * reuses full/explore scores. Not shared across workers (each has its own heap).
 */
import { EvalCache } from "./cache";
import type { EvalResult } from "./contracts";

const memo = new EvalCache<EvalResult>(6_144);

export function readEvalMemo(key: string): EvalResult | undefined {
  return memo.get(key);
}

export function writeEvalMemo(key: string, result: EvalResult): void {
  if (!result.finite || !Number.isFinite(result.score)) return;
  if (result.score === Number.NEGATIVE_INFINITY) return;
  memo.set(key, result);
}

export function clearEvalMemo(): void {
  memo.clear();
}

export function evalMemoStats(): { size: number; hits: number; misses: number } {
  return { size: memo.size, hits: memo.hits, misses: memo.misses };
}
