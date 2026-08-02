import { generateNeighbors } from "./localSearch";
import type { SearchState } from "./types";
import { maybeYield, type YieldCtx } from "./yield";

/**
 * Threshold acceptance / SA hybrid for escaping local optima.
 * Accepts improving moves always; non-improving when delta >= -threshold (TA)
 * or via Metropolis at temperature.
 */
export function runAnnealing(state: SearchState): void {
  void runAnnealingAsync(state, undefined);
}

export async function runAnnealingAsync(
  state: SearchState,
  yieldCtx?: YieldCtx,
): Promise<void> {
  if (!state.best) return;
  let current = [...state.best.bar];
  let currentScore = state.best.robustScore;
  const steps = state.config.annealSteps;
  let threshold = Math.max(Math.abs(currentScore) * 0.08, 1);
  let temperature = Math.max(Math.abs(currentScore) * 0.05, 0.5);
  const coolT = 0.95;
  const coolTh = 0.92;

  for (let step = 0; step < steps && state.canEval(); step++) {
    const neighbors = generateNeighbors(state, current);
    if (neighbors.length === 0) break;
    const sampleN = Math.min(8, neighbors.length);
    const sample = state.rng.shuffle(neighbors).slice(0, sampleN);

    let chosen: string[] | null = null;
    let chosenScore = currentScore;

    for (const nb of sample) {
      if (!state.canEval()) break;
      const scored = state.tryEval(nb, "search", "anneal");
      if (yieldCtx) await maybeYield(state, yieldCtx);
      if (!scored || !Number.isFinite(scored.robustScore)) continue;
      const delta = scored.robustScore - currentScore;
      if (delta >= 0) {
        chosen = [...scored.bar];
        chosenScore = scored.robustScore;
        break;
      }
      if (delta >= -threshold) {
        chosen = [...scored.bar];
        chosenScore = scored.robustScore;
        break;
      }
      const p = Math.exp(delta / Math.max(temperature, 1e-9));
      if (state.rng.next() < p) {
        chosen = [...scored.bar];
        chosenScore = scored.robustScore;
        break;
      }
    }

    if (chosen) {
      current = chosen;
      currentScore = chosenScore;
    }

    threshold *= coolTh;
    temperature *= coolT;
  }
}
