import type { BranchStressScenarioId } from "./branchStress";

export const BRANCH_STRESS_BASELINE_RUNNER = "win32-x64-node26";

export const BRANCH_STRESS_BASELINES: Readonly<
  Record<
    BranchStressScenarioId,
    { maxDurationMs: number; maxSnapshots: number; maxLiveBranches: number }
  >
> = {
  "short-score": { maxDurationMs: 30_000, maxSnapshots: 20_000, maxLiveBranches: 8_192 },
  "short-full": { maxDurationMs: 30_000, maxSnapshots: 20_000, maxLiveBranches: 8_192 },
  "medium-score": { maxDurationMs: 60_000, maxSnapshots: 60_000, maxLiveBranches: 8_192 },
  "medium-full": { maxDurationMs: 60_000, maxSnapshots: 60_000, maxLiveBranches: 8_192 },
  "long-score": { maxDurationMs: 120_000, maxSnapshots: 180_000, maxLiveBranches: 8_192 },
  "long-full": { maxDurationMs: 120_000, maxSnapshots: 180_000, maxLiveBranches: 8_192 },
  "oracle-short": { maxDurationMs: 60_000, maxSnapshots: 40_000, maxLiveBranches: 16_384 },
};
