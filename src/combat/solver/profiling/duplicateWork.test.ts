import { describe, expect, it, afterEach } from "vitest";
import type { PoolAbility } from "../contracts";
import { createSearchState } from "../search/types";
import { generateNeighbors } from "../search/localSearch";
import { runConstructiveBeam } from "../search/constructiveBeam";
import { fingerprintBar } from "../fingerprint";
import {
  enableSolverProfiling,
  getSolverDuplicateCounters,
  resetSolverProfileCounters,
} from "./index";

const pool: PoolAbility[] = [
  { id: "a", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "b", category: "basic", averageDamage: 20, occupancyTicks: 3 },
  { id: "c", category: "basic", averageDamage: 30, occupancyTicks: 3 },
  { id: "d", category: "basic", averageDamage: 40, occupancyTicks: 3 },
];

function mockEval(score = 1) {
  return ({ bar }: { bar: readonly string[] }) => ({
    score: score + bar.length * 0.01,
    finite: true as const,
    exploratory: true as const,
    validForFinalRanking: false as const,
  });
}

const baseConfig = {
  tier: "thorough" as const,
  evaluationBudget: 80,
  beamWidth: 4,
  beamInsertAllPositions: true,
  evoPopulation: 0,
  evoGenerations: 0,
  evoElite: 0,
  lnsRounds: 0,
  lnsDestroyK: 0,
  annealSteps: 0,
  localIterations: 1,
  topK: 3,
  seed: 1,
  exhaustiveMax: 0,
};

afterEach(() => {
  enableSolverProfiling(false);
  resetSolverProfileCounters();
});

describe("duplicate-work profiling counters", () => {
  it("stays zero when profiling is off", () => {
    enableSolverProfiling(false);
    resetSolverProfileCounters();
    fingerprintBar(["a", "b"]);
    const state = createSearchState({
      pool,
      sizeBounds: { min: 2, max: 3 },
      evaluate: mockEval(),
      config: { ...baseConfig, evaluationBudget: 20, beamInsertAllPositions: false },
    });
    state.tryEval(["a", "b"], "search");
    state.tryEval(["a", "b"], "search");
    generateNeighbors(state, ["a", "b"]);
    const c = getSolverDuplicateCounters();
    expect(c.fingerprintJoins).toBe(0);
    expect(c.duplicateEvalAttempts).toBe(0);
    expect(c.neighborGenerated).toBe(0);
  });

  it("counts tryEval duplicates, neighbors, fingerprints, beam children", () => {
    enableSolverProfiling(true);
    resetSolverProfileCounters();

    const state = createSearchState({
      pool,
      sizeBounds: { min: 1, max: 2 },
      evaluate: mockEval(10),
      config: baseConfig,
    });

    fingerprintBar(["x"]);
    state.tryEval(["a"], "search");
    state.tryEval(["a"], "search");
    state.tryEval(["b"], "search");

    const neighbors = generateNeighbors(state, ["a", "b"]);
    expect(neighbors.length).toBeGreaterThan(0);

    runConstructiveBeam(state);

    const c = getSolverDuplicateCounters();
    expect(c.fingerprintJoins).toBeGreaterThan(0);
    expect(c.duplicateEvalAttempts).toBeGreaterThanOrEqual(1);
    expect(c.barKeysSeenWithinWorker).toBeGreaterThanOrEqual(2);
    expect(c.neighborGenerated).toBeGreaterThan(0);
    expect(c.neighborDeduped).toBe(c.neighborDuplicateSkipped);
    expect(c.beamChildrenGenerated).toBeGreaterThan(0);
    expect(c.beamChildrenUniqueKeys).toBeGreaterThan(0);
    expect(c.beamChildrenUniqueKeys).toBeLessThanOrEqual(c.beamChildrenGenerated);
  });
});
