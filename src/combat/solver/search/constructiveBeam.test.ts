import { describe, expect, it } from "vitest";
import type { PoolAbility } from "../contracts";
import { createSearchState } from "./types";
import { runConstructiveBeam } from "./constructiveBeam";

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
  evaluationBudget: 200,
  beamWidth: 16,
  beamInsertAllPositions: true,
  evoPopulation: 0,
  evoGenerations: 0,
  evoElite: 0,
  lnsRounds: 0,
  lnsDestroyK: 0,
  annealSteps: 0,
  localIterations: 0,
  topK: 3,
  seed: 1,
  exhaustiveMax: 0,
};

describe("constructive beam child-batch dedup", () => {
  it("dedupes insert-at-all-positions collisions within one generation", () => {
    // min=max=2: one scored expansion gen from length-1 partials.
    // Insert-all: parent [a]+b@0 and parent [b]+a@1 both yield [b,a].
    const state = createSearchState({
      pool,
      sizeBounds: { min: 2, max: 2 },
      evaluate: mockEval(10),
      config: baseConfig,
    });

    const tryEvalKeys: string[] = [];
    const orig = state.tryEval.bind(state);
    state.tryEval = (bar, mode, source) => {
      tryEvalKeys.push(bar.join("\0"));
      return orig(bar, mode, source);
    };

    runConstructiveBeam(state);

    const unique = new Set(tryEvalKeys);
    expect(tryEvalKeys.length).toBe(unique.size);
    // 4-choose-ordered length-2 bars = 4*3 = 12 without eligibility cuts.
    expect(tryEvalKeys.length).toBe(12);
    expect(state.budget.used).toBe(12);
  });

  it("still keeps growing parents on the beam when depth remains", () => {
    const state = createSearchState({
      pool,
      sizeBounds: { min: 1, max: 2 },
      evaluate: mockEval(5),
      config: { ...baseConfig, beamWidth: 4, evaluationBudget: 80 },
    });

    runConstructiveBeam(state);

    expect(state.best).not.toBeNull();
    expect(state.archive.length).toBeGreaterThan(0);
    expect(state.archive.some((s) => s.bar.length === 2)).toBe(true);
    // Length-1 seeds remain rankable parents (grew path kept them).
    expect(state.archive.some((s) => s.bar.length === 1)).toBe(true);
  });

  it("append-only single generation has no tryEval key collisions", () => {
    const state = createSearchState({
      pool,
      sizeBounds: { min: 2, max: 2 },
      evaluate: mockEval(3),
      config: {
        ...baseConfig,
        beamInsertAllPositions: false,
        evaluationBudget: 40,
        beamWidth: 16,
      },
    });

    const tryEvalKeys: string[] = [];
    const orig = state.tryEval.bind(state);
    state.tryEval = (bar, mode, source) => {
      tryEvalKeys.push(bar.join("\0"));
      return orig(bar, mode, source);
    };

    runConstructiveBeam(state);

    expect(new Set(tryEvalKeys).size).toBe(tryEvalKeys.length);
    // Append-only: each parent appends each remaining ability once → 12.
    expect(tryEvalKeys.length).toBe(12);
    expect(state.budget.used).toBeGreaterThan(0);
  });
});
