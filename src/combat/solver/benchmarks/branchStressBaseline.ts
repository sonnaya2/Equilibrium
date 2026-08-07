import type { BranchStressResult } from "./branchStress";

export const BRANCH_STRESS_BASELINE_RUNNER = "win32-x64-node26";

export const BRANCH_STRESS_BASELINES: Readonly<
  Record<
    BranchStressResult["id"],
    { maxDurationMs: number; maxSnapshots: number; maxLiveBranches: number }
  >
> = {
  "league-blessings": { maxDurationMs: 1_500, maxSnapshots: 500, maxLiveBranches: 350 },
  "league-blessings-control": { maxDurationMs: 500, maxSnapshots: 200, maxLiveBranches: 120 },
  "league-poison-melee": { maxDurationMs: 15_000, maxSnapshots: 600, maxLiveBranches: 350 },
  "league-poison-melee-control": {
    maxDurationMs: 1_500,
    maxSnapshots: 200,
    maxLiveBranches: 80,
  },
  "league-necro-conjures": { maxDurationMs: 500, maxSnapshots: 100, maxLiveBranches: 40 },
  "league-necro-conjures-control": {
    maxDurationMs: 250,
    maxSnapshots: 50,
    maxLiveBranches: 20,
  },
};
