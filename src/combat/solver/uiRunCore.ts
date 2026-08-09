import { DEFAULT_STOCHASTIC_SEED } from "../engine/runtime/stochastic";
import { simulateRevolution, type RevolutionInput } from "../engine/simulation/revolution";
import type { RotationSummary, SimulateOptions } from "../engine/simulation/simulate";

export interface StochasticRunMeta {
  lanes: number;
  seed: number;
}

export interface UiRunResult {
  summary: RotationSummary;
  meta: StochasticRunMeta;
}

export function simulateRevolutionForUi(
  input: RevolutionInput,
  options?: SimulateOptions,
): UiRunResult {
  const seed = options?.stochasticSeed ?? DEFAULT_STOCHASTIC_SEED;
  const summary = simulateRevolution(input, {
    ...options,
    detailLevel: options?.detailLevel ?? "full-analysis",
    stochasticSeed: seed,
  });
  return {
    summary,
    meta: { lanes: summary.rng?.lanes ?? 1, seed },
  };
}
