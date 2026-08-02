import { describe, expect, it } from "vitest";
import type { EvaluateFn, PoolAbility } from "../contracts";
import { createSearchState } from "./types";
import { configForTier, solve } from "../solve";
import { estimateFeasibleCount, runExhaustive, shouldRunExhaustive } from "./exhaustive";

const pool: PoolAbility[] = [
  { id: "a", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "b", category: "enhanced", averageDamage: 30, occupancyTicks: 3 },
  { id: "c", category: "ultimate", averageDamage: 100, occupancyTicks: 3 },
];

/** Score = sum of position-weighted damage so order matters; c before b is best. */
const mockEvaluate: EvaluateFn = ({ bar }) => {
  const dmg: Record<string, number> = { a: 10, b: 30, c: 100 };
  let score = 0;
  bar.forEach((id, i) => {
    score += (dmg[id] ?? 0) * (bar.length - i);
  });
  if (bar.includes("c")) score += 50;
  return { score, bar };
};

describe("estimateFeasibleCount", () => {
  it("counts ordered bars within size bounds", () => {
    // 3 independent abilities, size 1..3 → 3 + 6 + 6 = 15
    expect(estimateFeasibleCount(pool, { min: 1, max: 3 })).toBe(15);
  });

  it("respects exclusive groups", () => {
    const gPool: PoolAbility[] = [
      { id: "x", exclusiveGroup: "g" },
      { id: "y", exclusiveGroup: "g" },
      { id: "z" },
    ];
    // k=1: 3, k=2: 4 → 7
    expect(estimateFeasibleCount(gPool, { min: 1, max: 2 })).toBe(7);
  });
});

describe("shouldRunExhaustive", () => {
  it("allows small estimates under budget", () => {
    expect(shouldRunExhaustive(15, 500, 2000)).toBe(true);
    expect(shouldRunExhaustive(100, 50, 2000)).toBe(false);
    expect(shouldRunExhaustive(Number.POSITIVE_INFINITY, 500, 2000)).toBe(false);
  });
});

describe("runExhaustive", () => {
  it("finds the best ordered bar in a tiny pool", () => {
    const config = configForTier("thorough", 42);
    const state = createSearchState({
      pool,
      sizeBounds: { min: 1, max: 3 },
      evaluate: mockEvaluate,
      config,
    });

    const completed = runExhaustive(state);
    expect(completed).toBe(true);
    expect(state.exhaustiveCompleted).toBe(true);
    expect(state.best).not.toBeNull();
    // Best: c, b, a → 100*3 + 30*2 + 10*1 + 50 = 420
    expect([...state.best!.bar]).toEqual(["c", "b", "a"]);
    expect(state.best!.robustScore).toBe(420);
  });

  it("skips when estimate exceeds budget", () => {
    const tiny = createSearchState({
      pool,
      sizeBounds: { min: 1, max: 3 },
      evaluate: mockEvaluate,
      config: {
        ...configForTier("thorough", 1),
        evaluationBudget: 5,
        exhaustiveMax: 5,
      },
    });
    const completed = runExhaustive(tiny);
    expect(completed).toBe(false);
    expect(tiny.exhaustiveCompleted).toBe(false);
  });
});

describe("solve orchestrator (tiny pool)", () => {
  it("finds best bar; exhaustive short-horizon never claims full-objective global optimum", () => {
    const result = solve({
      pool,
      sizeBounds: { min: 1, max: 3 },
      evaluate: mockEvaluate,
      tier: "thorough",
      seed: 7,
    });
    expect(result.best).not.toBeNull();
    expect([...result.best!.bar]).toEqual(["c", "b", "a"]);
    // Full shortlist rescoring ranks the winner; exhaustive search alone is not full-global.
    expect(result.proof).not.toBe("full-objective-global-optimum");
    expect([
      "full-shortlist-best",
      "heuristic-best-found",
      "search-objective-exhaustive",
    ]).toContain(result.proof);
    expect(result.exhaustiveCompleted).toBe(true);
    expect(result.totalEvaluations).toBeGreaterThan(0);
    expect(result.fullEvaluations).toBeGreaterThan(0);
    expect(result.searchEvaluations).toBeGreaterThan(0);
    expect(result.best!.robustScore).toBeGreaterThanOrEqual(result.seedBestScore);
  });
});
