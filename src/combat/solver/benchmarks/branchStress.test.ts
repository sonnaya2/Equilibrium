import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRANCH_STRESS_CASES,
  BRANCH_STRESS_SCENARIOS,
  branchStressRunnerId,
  runBranchStressReport,
  runBranchStressSuite,
  type BranchStressCaseId,
} from "./branchStress";
import { BRANCH_STRESS_BASELINES, BRANCH_STRESS_BASELINE_RUNNER } from "./branchStressBaseline";

const enabled = process.env.SOLVER_BENCH === "stress";
const selectedCase = process.env.SOLVER_BENCH_CASE as BranchStressCaseId | undefined;
const selectedScenario = process.env.SOLVER_BENCH_SCENARIO;
const cases = selectedCase
  ? BRANCH_STRESS_CASES.filter((id) => id === selectedCase)
  : BRANCH_STRESS_CASES;
const scenarios = selectedScenario
  ? BRANCH_STRESS_SCENARIOS.filter((scenario) => scenario.id === selectedScenario)
  : BRANCH_STRESS_SCENARIOS;

function resultMap(results: Awaited<ReturnType<typeof runBranchStressSuite>>) {
  return new Map(results.map((result) => [result.id, result]));
}

describe.skipIf(!enabled)("global branch stress", () => {
  it("keeps the valid League matrix exact, deterministic, and bounded", async () => {
    const report = await runBranchStressReport(cases, scenarios);
    const first = report.cases;
    const shortScore = BRANCH_STRESS_SCENARIOS.filter((scenario) => scenario.id === "short-score");
    const repeat = await runBranchStressSuite(cases, shortScore);
    const repeatedById = resultMap(repeat);
    const byId = resultMap(first);

    const reportDir = join(process.cwd(), "reports");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
      join(reportDir, "solver-branch-stress.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));

    for (const result of first) {
      expect(result.probabilityMass + result.residualWeight, result.id).toBeCloseTo(1, 12);
      expect(result.residualWeight, result.id).toBeLessThanOrEqual(1e-12);
      expect(result.failedWeight, result.id).toBe(0);
      if (result.attempts === 1) {
        expect(result.branchProfile.mergeAndCapDiscards, result.id).toBe(0);
        expect(result.branchProfile.residualMassEvents, result.id).toBe(0);
      }
      expect(result.branchProfile.branchFingerprintCollisions, result.id).toBe(0);
      expect(result.allocation.eventQueueMaxDepth, result.id).toBeGreaterThan(0);
      expect(result.hitPipeline.modifierProgramEvaluations, result.id).toBeGreaterThan(0);
      expect(Number.isFinite(result.maxObservedRssBytes), result.id).toBe(true);
      expect(result.maxObservedRssBytes, result.id).toBeGreaterThan(0);
      if (result.releaseGate) {
        expect(result.ok, result.id).toBe(true);
        expect(["exact", "merged-exactly"], result.id).toContain(result.exactness);
      } else {
        expect(result.ok, result.id).toBe(false);
        expect(result.exactness, result.id).toBe("approximated");
      }

      if (result.scenarioId === "short-score") {
        const repeated = repeatedById.get(result.id);
        expect(repeated, result.id).toBeTruthy();
        expect(result.totalExpected, result.id).toBe(repeated!.totalExpected);
        expect(result.probabilityMass, result.id).toBe(repeated!.probabilityMass);
        expect(result.exactness, result.id).toBe(repeated!.exactness);
      }

      if (branchStressRunnerId() === BRANCH_STRESS_BASELINE_RUNNER) {
        const baseline = BRANCH_STRESS_BASELINES[result.scenarioId];
        expect(result.durationMs, result.id).toBeLessThanOrEqual(baseline.maxDurationMs);
        expect(result.branchProfile.branchSnapshots, result.id).toBeLessThanOrEqual(
          baseline.maxSnapshots,
        );
        expect(result.branchProfile.maxLiveBranches, result.id).toBeLessThanOrEqual(
          baseline.maxLiveBranches,
        );
      }
    }

    for (const caseId of cases) {
      for (const horizon of ["short", "medium", "long"] as const) {
        const score = byId.get(`${caseId}:${horizon}-score`);
        const full = byId.get(`${caseId}:${horizon}-full`);
        if (!score || !full) continue;
        expect(score.totalExpected, `${caseId}:${horizon}`).toBe(full.totalExpected);
        expect(score.probabilityMass, `${caseId}:${horizon}`).toBe(full.probabilityMass);
        expect(score.exactness, `${caseId}:${horizon}`).toBe(full.exactness);
      }

      const release = byId.get(`${caseId}:short-score`);
      const oracle = byId.get(`${caseId}:oracle-short`);
      if (release && oracle) {
        expect(release.totalExpected, `${caseId}:oracle`).toBe(oracle.totalExpected);
        expect(release.probabilityMass, `${caseId}:oracle`).toBe(oracle.probabilityMass);
        expect(release.exactness, `${caseId}:oracle`).toBe(oracle.exactness);
      }
    }
  }, 1_200_000);
});
