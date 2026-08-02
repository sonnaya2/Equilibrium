import { remainingCandidates } from "../eligibility";
import { insertAt, type SearchState } from "./types";
import { maybeYield, type YieldCtx } from "./yield";

/** LNS: destroy k random slots, repair greedily or randomly. */
export function runLargeNeighborhood(state: SearchState): void {
  void runLargeNeighborhoodAsync(state, undefined);
}

export async function runLargeNeighborhoodAsync(
  state: SearchState,
  yieldCtx?: YieldCtx,
): Promise<void> {
  if (!state.best) return;
  let current = [...state.best.bar];
  const rounds = state.config.lnsRounds;
  const kBase = state.config.lnsDestroyK;

  for (let r = 0; r < rounds && state.canEval(); r++) {
    if (current.length === 0) break;
    const k = Math.min(kBase, current.length);
    const destroyed = destroy(current, k, state);
    const greedy = state.rng.next() < 0.6;
    const repaired = repair(state, destroyed, greedy);
    if (repaired.length < state.sizeBounds.min) continue;
    if (repaired.length > state.sizeBounds.max) continue;

    const scored = state.tryEval(repaired, "search", "lns");
    if (yieldCtx) await maybeYield(state, yieldCtx);
    if (scored && scored.robustScore > (state.best?.robustScore ?? Number.NEGATIVE_INFINITY)) {
      current = [...scored.bar];
    } else if (scored && state.rng.next() < 0.15) {
      current = [...scored.bar];
    }
  }
}

function destroy(bar: readonly string[], k: number, state: SearchState): string[] {
  const idx = state.rng.shuffle(bar.map((_, i) => i)).slice(0, k);
  const drop = new Set(idx);
  return bar.filter((_, i) => !drop.has(i));
}

function repair(state: SearchState, partial: string[], greedy: boolean): string[] {
  let bar = partial.slice();
  const { min, max } = state.sizeBounds;

  while (bar.length < max && state.canEval()) {
    const remain = remainingCandidates(bar, state.pool, state.byId);
    if (remain.length === 0) break;
    if (bar.length >= min && state.rng.next() < 0.25) break;

    if (greedy) {
      let bestBar: string[] | null = null;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const a of remain) {
        if (!state.canEval()) break;
        const cand = insertAt(bar, bar.length, a.id);
        if (cand.length < min) {
          if (!bestBar) bestBar = cand;
          continue;
        }
        const scored = state.tryEval(cand, "search", "lns-repair");
        if (scored && scored.robustScore > bestScore) {
          bestScore = scored.robustScore;
          bestBar = [...scored.bar];
        }
      }
      if (!bestBar) break;
      bar = bestBar;
    } else {
      const a = state.rng.pick(remain);
      bar = insertAt(bar, state.rng.int(bar.length + 1), a.id);
      if (bar.length >= min) state.tryEval(bar, "search", "lns-repair");
    }
  }

  while (bar.length < min) {
    const remain = remainingCandidates(bar, state.pool, state.byId);
    if (remain.length === 0) break;
    bar = insertAt(bar, bar.length, state.rng.pick(remain).id);
  }
  return bar;
}
