import { describe, expect, it } from "vitest";
import {
  STOCHASTIC_STRESS_CASES,
  STOCHASTIC_STRESS_SCENARIOS,
  runStochasticStressCase,
  type StochasticStressCaseId,
  type StochasticStressScenario,
} from "./stochasticStress";

const enabled = process.env.SOLVER_STOCHASTIC_BENCH === "1";
const scenarioId = process.env.SOLVER_BENCH_SCENARIO ?? "short-score";
const caseId = process.env.SOLVER_BENCH_CASE ?? "league-poison-melee";

const retiredExactOracle = {
  totalExpected: 39_106.39415772694,
  playerPoisonHostExpectedDamage: 4_499.315,
};

describe("stochastic migration parity", () => {
  it("keeps the combined Avernic and Cinderbane workload within 1% of the retired oracle", async () => {
    const baseScenario = STOCHASTIC_STRESS_SCENARIOS.find(
      (candidate) => candidate.id === "short-full",
    )!;
    const scenario = { ...baseScenario, horizonTicks: 15 } as StochasticStressScenario;
    const first = await runStochasticStressCase("league-poison-melee", scenario);
    const second = await runStochasticStressCase("league-poison-melee", scenario);

    expect(first.totalExpected).toBe(second.totalExpected);
    expect(first.playerPoisonExpectedDamage).toBe(second.playerPoisonExpectedDamage);
    expect(first.playerPoisonHostExpectedDamage).toBe(second.playerPoisonHostExpectedDamage);
    expect(first.probabilityMass).toBe(second.probabilityMass);
    expect(first.exactness).toBe(second.exactness);
    expect(first.lanes).toBe(128);
    expect(first.probabilityMass).toBe(1);
    expect(first.residualWeight).toBe(0);
    expect(
      Math.abs(first.totalExpected - retiredExactOracle.totalExpected) /
        retiredExactOracle.totalExpected,
    ).toBeLessThan(0.01);
    expect(
      Math.abs(
        first.playerPoisonHostExpectedDamage - retiredExactOracle.playerPoisonHostExpectedDamage,
      ) / retiredExactOracle.playerPoisonHostExpectedDamage,
    ).toBeLessThan(0.01);
  });
});

describe.skipIf(!enabled)("stochastic migration benchmark", () => {
  it("runs the combined League poison workload with fixed lanes", async () => {
    const selected = STOCHASTIC_STRESS_SCENARIOS.find((candidate) => candidate.id === scenarioId);
    if (!selected) throw new Error(`unknown scenario: ${scenarioId}`);
    const horizonOverride = Number(process.env.SOLVER_BENCH_TICKS);
    const scenario: StochasticStressScenario =
      Number.isInteger(horizonOverride) && horizonOverride > 0
        ? ({ ...selected, horizonTicks: horizonOverride } as StochasticStressScenario)
        : selected;
    if (!STOCHASTIC_STRESS_CASES.includes(caseId as StochasticStressCaseId)) {
      throw new Error(`unknown case: ${caseId}`);
    }
    const result = await runStochasticStressCase(caseId as StochasticStressCaseId, scenario);
    console.warn(JSON.stringify(result, null, 2));
    expect(result.residualWeight).toBe(0);
    expect(result.totalExpected).toBeGreaterThan(0);
  }, 300_000);
});
