import { describe, expect, it } from "vitest";
import type { PoolAbility } from "../contracts";
import { barKey } from "../fingerprint";
import { generateNeighbors, runLocalSearchAsync } from "./localSearch";
import { createSearchState, moveAt, swapAt } from "./types";

const pool: PoolAbility[] = [
  { id: "a", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "b", category: "basic", averageDamage: 20, occupancyTicks: 3 },
  { id: "c", category: "basic", averageDamage: 30, occupancyTicks: 3 },
  { id: "d", category: "basic", averageDamage: 40, occupancyTicks: 3 },
  { id: "e", category: "basic", averageDamage: 50, occupancyTicks: 3 },
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

function makeState(
  bounds: { min: number; max: number } = { min: 1, max: 5 },
  requiredAbilityIds: readonly string[] = [],
) {
  return createSearchState({
    pool,
    sizeBounds: bounds,
    evaluate: mockEval(),
    config: baseConfig,
    requiredAbilityIds,
  });
}

function uniqueKeys(bars: readonly (readonly string[])[]): string[] {
  return bars.map((b) => barKey(b));
}

describe("generateNeighbors", () => {
  it("emits unique bars by barKey (no move/swap duplicates)", () => {
    const state = makeState({ min: 2, max: 4 });
    const bar = ["a", "b", "c", "d"];
    const neighbors = generateNeighbors(state, bar);
    const keys = uniqueKeys(neighbors);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(barKey(bar));
  });

  it("does not double-count adjacent swaps under all-pair swaps", () => {
    const state = makeState({ min: 3, max: 3 });
    // Fixed size: only swap + move operators (no insert/remove).
    const bar = ["a", "b", "c"];
    const neighbors = generateNeighbors(state, bar);
    const keys = new Set(uniqueKeys(neighbors));

    // Adjacent swap (0,1) must appear exactly once.
    const adj = barKey(swapAt(bar, 0, 1));
    expect(keys.has(adj)).toBe(true);
    expect(neighbors.filter((n) => barKey(n) === adj)).toHaveLength(1);

    // All-pair swap (0,2) still present.
    expect(keys.has(barKey(swapAt(bar, 0, 2)))).toBe(true);
  });

  it("collapses rotate-equivalent moves to one barKey", () => {
    const state = makeState({ min: 3, max: 3 });
    const bar = ["a", "b", "c"];
    // move(0,1) and move(1,0) both yield [b,a,c] under moveAt splice semantics.
    expect(barKey(moveAt(bar, 0, 1))).toBe(barKey(moveAt(bar, 1, 0)));
    const neighbors = generateNeighbors(state, bar);
    const target = barKey(moveAt(bar, 0, 1));
    expect(neighbors.filter((n) => barKey(n) === target)).toHaveLength(1);
  });

  it("includes distinct non-adjacent move and swap outcomes", () => {
    const state = makeState({ min: 4, max: 4 });
    const bar = ["a", "b", "c", "d"];
    const neighbors = generateNeighbors(state, bar);
    const keys = new Set(uniqueKeys(neighbors));
    // Swap ends: [d,b,c,a]
    expect(keys.has(barKey(swapAt(bar, 0, 3)))).toBe(true);
    // Move first to end: [b,c,d,a]
    expect(keys.has(barKey(moveAt(bar, 0, 3)))).toBe(true);
    expect(barKey(swapAt(bar, 0, 3))).not.toBe(barKey(moveAt(bar, 0, 3)));
  });

  it("still offers remove and insert when size allows", () => {
    const state = makeState({ min: 2, max: 4 });
    const bar = ["a", "b", "c"];
    const neighbors = generateNeighbors(state, bar);
    const lens = new Set(neighbors.map((n) => n.length));
    expect(lens.has(2)).toBe(true);
    expect(lens.has(4)).toBe(true);
  });

  it("never removes or replaces a required ability", () => {
    const state = makeState({ min: 2, max: 4 }, ["b"]);
    const neighbors = generateNeighbors(state, ["a", "b", "c"]);

    expect(neighbors.length).toBeGreaterThan(0);
    expect(neighbors.every((bar) => bar.includes("b"))).toBe(true);
    expect(neighbors.some((bar) => bar.length === 2)).toBe(true);
  });
});

describe("runLocalSearchAsync", () => {
  it("visits a non-improving neighbor batch once", async () => {
    const state = makeState({ min: 3, max: 3 });
    const bar = ["a", "b", "c"];
    expect(state.tryEval(bar, "search", "seed")).not.toBeNull();
    const neighborCount = generateNeighbors(state, bar).length;
    const tryEval = state.tryEval.bind(state);
    let attempts = 0;
    state.tryEval = (...args) => {
      attempts += 1;
      return tryEval(...args);
    };

    await runLocalSearchAsync(state);

    expect(attempts).toBe(neighborCount);
    expect(state.best?.bar).toEqual(bar);
  });
});
