import { exclusiveKey, remainingCandidates } from "../eligibility";
import { insertAt, moveAt, removeAt, replaceAt, swapAt, type SearchState } from "./types";
import { maybeYield, type YieldCtx } from "./yield";

/**
 * Hill-climb for N iterations: swap, adjacent swap, replace, insert, remove, move.
 */
export function runLocalSearch(state: SearchState): void {
  // No yieldCtx → no await inside async body → runs fully sync.
  void runLocalSearchAsync(state, undefined);
}

export async function runLocalSearchAsync(state: SearchState, yieldCtx?: YieldCtx): Promise<void> {
  if (!state.best) return;
  let current = [...state.best.bar];
  let currentScore = state.best.robustScore;
  const iterations = state.config.localIterations;

  for (let iter = 0; iter < iterations && state.canEval(); iter++) {
    const neighbors = generateNeighbors(state, current);
    if (neighbors.length === 0) break;

    const order = state.rng.shuffle(neighbors);
    let improved: string[] | null = null;
    let improvedScore = currentScore;

    for (const nb of order) {
      if (!state.canEval()) break;
      const scored = state.tryEval(nb, "search", "local");
      if (yieldCtx) await maybeYield(state, yieldCtx);
      if (!scored || !Number.isFinite(scored.robustScore)) continue;
      if (scored.robustScore > improvedScore) {
        improved = [...scored.bar];
        improvedScore = scored.robustScore;
        break;
      }
    }

    if (!improved) {
      for (const nb of order) {
        if (!state.canEval()) break;
        const scored = state.tryEval(nb, "search", "local");
        if (yieldCtx) await maybeYield(state, yieldCtx);
        if (!scored || !Number.isFinite(scored.robustScore)) continue;
        if (scored.robustScore > improvedScore) {
          improved = [...scored.bar];
          improvedScore = scored.robustScore;
        }
      }
    }

    if (!improved || improvedScore <= currentScore) break;
    current = improved;
    currentScore = improvedScore;
  }
}

export function generateNeighbors(state: SearchState, bar: readonly string[]): string[][] {
  const out: string[][] = [];
  const n = bar.length;
  const { min, max } = state.sizeBounds;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) out.push(swapAt(bar, i, j));
  }
  for (let i = 0; i + 1 < n; i++) out.push(swapAt(bar, i, i + 1));

  for (let from = 0; from < n; from++) {
    for (let to = 0; to < n; to++) {
      if (from === to) continue;
      out.push(moveAt(bar, from, to));
    }
  }

  if (n > min) {
    for (let i = 0; i < n; i++) out.push(removeAt(bar, i));
  }

  if (n < max) {
    const remain = remainingCandidates(bar, state.pool, state.byId);
    // Cap inserts — full remain×positions explodes and freezes the UI.
    const insertPool = remain.slice(0, 8);
    for (const a of insertPool) {
      for (let i = 0; i <= n; i++) out.push(insertAt(bar, i, a.id));
    }
  }

  for (let i = 0; i < n; i++) {
    const without = removeAt(bar, i);
    let replaced = 0;
    for (const a of state.pool) {
      if (replaced >= 8) break;
      if (a.id === bar[i]) continue;
      if (without.includes(a.id)) continue;
      const g = exclusiveKey(a);
      if (g) {
        let clash = false;
        for (const id of without) {
          const e = state.byId.get(id);
          if (e && exclusiveKey(e) === g) {
            clash = true;
            break;
          }
        }
        if (clash) continue;
      }
      out.push(replaceAt(bar, i, a.id));
      replaced += 1;
    }
  }

  // Hard cap neighbor set so local search cannot stall the page.
  if (out.length > 48) {
    return state.rng.shuffle(out).slice(0, 48);
  }
  return out;
}
