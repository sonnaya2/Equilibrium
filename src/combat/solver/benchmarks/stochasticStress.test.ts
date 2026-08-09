import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STOCHASTIC_STRESS_CASES,
  STOCHASTIC_STRESS_SCENARIOS,
  stochasticStressRunnerId,
  runStochasticStressReport,
  runStochasticStressSuite,
  type StochasticStressCaseId,
} from "./stochasticStress";
import {
  STOCHASTIC_STRESS_BASELINES,
  STOCHASTIC_STRESS_BASELINE_RUNNER,
} from "./stochasticStressBaseline";

const enabled = process.env.SOLVER_BENCH === "stress";
const selectedCase = process.env.SOLVER_BENCH_CASE as StochasticStressCaseId | undefined;
const selectedScenario = process.env.SOLVER_BENCH_SCENARIO;
const cases = selectedCase
  ? STOCHASTIC_STRESS_CASES.filter((id) => id === selectedCase)
  : STOCHASTIC_STRESS_CASES;
const scenarios = selectedScenario
  ? STOCHASTIC_STRESS_SCENARIOS.filter((scenario) => scenario.id === selectedScenario)
  : STOCHASTIC_STRESS_SCENARIOS;

function resultMap(results: Awaited<ReturnType<typeof runStochasticStressSuite>>) {
  return new Map(results.map((result) => [result.id, result]));
}

describe.skipIf(!enabled)("stochastic combat stress", () => {
  it("keeps the valid League matrix deterministic and bounded", async () => {
    const report = await runStochasticStressReport(cases, scenarios);
    const first = report.cases;
    const shortScore = STOCHASTIC_STRESS_SCENARIOS.filter(
      (scenario) => scenario.id === "short-score",
    );
    const repeat = await runStochasticStressSuite(cases, shortScore);
    const repeatedById = resultMap(repeat);
    const byId = resultMap(first);

    const reportDir = join(process.cwd(), "reports");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
      join(reportDir, "solver-stochastic-stress.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));

    for (const result of first) {
      expect(result.probabilityMass + result.residualWeight, result.id).toBeCloseTo(1, 12);
      expect(result.residualWeight, result.id).toBeLessThanOrEqual(1e-12);
      expect(result.failedWeight, result.id).toBe(0);
      expect(result.allocation.eventQueueMaxDepth, result.id).toBeGreaterThan(0);
      expect(result.hitPipeline.modifierProgramEvaluations, result.id).toBeGreaterThan(0);
      expect(Number.isFinite(result.maxObservedRssBytes), result.id).toBe(true);
      expect(result.maxObservedRssBytes, result.id).toBeGreaterThan(0);
      if (result.releaseGate) {
        expect(result.ok, result.id).toBe(true);
        expect(result.exactness, result.id).toBe(result.lanes === 1 ? "exact" : "estimated");
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

      if (stochasticStressRunnerId() === STOCHASTIC_STRESS_BASELINE_RUNNER) {
        const baseline = STOCHASTIC_STRESS_BASELINES[result.scenarioId];
        expect(result.durationMs, result.id).toBeLessThanOrEqual(baseline.maxDurationMs);
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
    }
  }, 1_200_000);
});
