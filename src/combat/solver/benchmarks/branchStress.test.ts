import { describe, expect, it } from "vitest";
import { BRANCH_STRESS_CASES, branchStressRunnerId, runBranchStressSuite } from "./branchStress";
import { BRANCH_STRESS_BASELINES, BRANCH_STRESS_BASELINE_RUNNER } from "./branchStressBaseline";

const enabled = process.env.SOLVER_BENCH === "stress";
const selected = process.env.SOLVER_BENCH_CASE;
const cases = selected ? BRANCH_STRESS_CASES.filter((id) => id === selected) : BRANCH_STRESS_CASES;

describe.skipIf(!enabled)("global branch stress", () => {
  it("keeps valid League builds exact, deterministic, and bounded", async () => {
    const first = await runBranchStressSuite(cases);
    const second = await runBranchStressSuite(cases);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(first, null, 2));
    expect(first.map((result) => result.id)).toEqual(cases);

    for (let index = 0; index < first.length; index++) {
      const result = first[index]!;
      const repeat = second[index]!;
      expect(result.ok, result.id).toBe(true);
      expect(result.probabilityMass + result.residualWeight, result.id).toBeCloseTo(1, 12);
      expect(result.residualWeight, result.id).toBeLessThanOrEqual(1e-12);
      expect(["exact", "merged-exactly"], result.id).toContain(result.exactness);
      expect(result.totalExpected, result.id).toBe(repeat.totalExpected);
      expect(result.probabilityMass, result.id).toBe(repeat.probabilityMass);
      expect(result.residualWeight, result.id).toBe(repeat.residualWeight);
      expect(result.exactness, result.id).toBe(repeat.exactness);
      expect(result.finalLiveCap, result.id).toBeLessThanOrEqual(8192);
      expect(result.branchProfile.snapshotBytesActual, result.id).toBeGreaterThan(0);
      expect(result.allocation.eventQueueMaxDepth, result.id).toBeGreaterThan(0);
      expect(result.hitPipeline.modifierProgramEvaluations, result.id).toBeGreaterThan(0);
      if (branchStressRunnerId() === BRANCH_STRESS_BASELINE_RUNNER) {
        const baseline = BRANCH_STRESS_BASELINES[result.id];
        expect(result.durationMs, result.id).toBeLessThanOrEqual(baseline.maxDurationMs);
        expect(result.branchProfile.branchSnapshots, result.id).toBeLessThanOrEqual(
          baseline.maxSnapshots,
        );
        expect(result.branchProfile.maxLiveBranches, result.id).toBeLessThanOrEqual(
          baseline.maxLiveBranches,
        );
      }
    }

    const byId = new Map(first.map((result) => [result.id, result]));
    for (const leagueId of [
      "league-blessings",
      "league-poison-melee",
      "league-necro-conjures",
    ] as const) {
      const league = byId.get(leagueId);
      const control = byId.get(`${leagueId}-control` as (typeof first)[number]["id"]);
      if (!league || !control) continue;
      expect(league.durationMs, leagueId).toBeLessThanOrEqual(control.durationMs * 25 + 250);
    }
  }, 600_000);
});
