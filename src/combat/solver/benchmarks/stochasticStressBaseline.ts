import type { StochasticStressScenarioId } from "./stochasticStress";

export const STOCHASTIC_STRESS_BASELINE_RUNNER = "win32-x64-node26";

export const STOCHASTIC_STRESS_BASELINES: Readonly<
  Record<StochasticStressScenarioId, { maxDurationMs: number }>
> = {
  "short-score": { maxDurationMs: 10_000 },
  "short-full": { maxDurationMs: 10_000 },
  "medium-score": { maxDurationMs: 15_000 },
  "medium-full": { maxDurationMs: 15_000 },
  "long-score": { maxDurationMs: 20_000 },
  "long-full": { maxDurationMs: 20_000 },
};
