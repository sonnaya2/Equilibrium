import { describe, expect, it } from "vitest";
import type { EvaluateFn, PoolAbility } from "../contracts";
import { configForTier, solve } from "../solve";
import { enumerateLegalBars, independentOptimum } from "./independentOracle";

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

describe("independent solver oracle", () => {
  it("enumerates every ordered legal bar for a tiny pool", () => {
    const bars = enumerateLegalBars(pool, { min: 1, max: 3 });
    // 3 + 6 + 6 = 15 ordered bars
    expect(bars).toHaveLength(15);
    expect(bars.some((b) => b.join(",") === "c,b,a")).toBe(true);
  });

  it("picks the true optimum without using solver search", () => {
    const best = independentOptimum(pool, { min: 1, max: 3 }, mockEvaluate);
    expect(best.bar).toEqual(["c", "b", "a"]);
    expect(best.score).toBe(420);
  });

  it("matches solve() on the same tiny pool", () => {
    const oracle = independentOptimum(pool, { min: 1, max: 3 }, mockEvaluate);
    const result = solve({
      pool,
      sizeBounds: { min: 1, max: 3 },
      evaluate: mockEvaluate,
      tier: "thorough",
      seed: 7,
    });
    expect(result.best).not.toBeNull();
    expect([...result.best!.bar]).toEqual(oracle.bar);
    expect(result.best!.robustScore).toBe(oracle.score);
    // Exhaustive search-objective does not imply full-objective global optimum.
    expect(result.proof).not.toBe("full-objective-global-optimum");
    expect(configForTier("thorough", 1).evaluationBudget).toBeGreaterThan(0);
  });

  it("respects exclusive groups when enumerating", () => {
    const gPool: PoolAbility[] = [
      { id: "x", exclusiveGroup: "g" },
      { id: "y", exclusiveGroup: "g" },
      { id: "z" },
    ];
    const bars = enumerateLegalBars(gPool, { min: 1, max: 2 });
    expect(bars.every((b) => !(b.includes("x") && b.includes("y")))).toBe(true);
    expect(bars).toHaveLength(7);
  });
});
