import { describe, expect, it } from "vitest";
import type { EvaluateFn, PoolAbility } from "./contracts";
import { compareVigourSearch, reevaluateIncumbentBar } from "./vigourIncumbent";

const pool: PoolAbility[] = [
  { id: "a", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "b", category: "enhanced", averageDamage: 30, occupancyTicks: 3 },
  { id: "c", category: "ultimate", averageDamage: 100, occupancyTicks: 3 },
];

function fullScore(bar: readonly string[]): number {
  const dmg: Record<string, number> = { a: 100, b: 40, c: 5 };
  let score = 0;
  bar.forEach((id, i) => {
    score += (dmg[id] ?? 0) * (i + 1);
  });
  return score;
}

function searchScore(bar: readonly string[]): number {
  const dmg: Record<string, number> = { a: 10, b: 30, c: 100 };
  let score = 0;
  bar.forEach((id, i) => {
    score += (dmg[id] ?? 0) * (bar.length - i);
  });
  if (bar.includes("c")) score += 50;
  return score;
}

const evaluate: EvaluateFn = ({ bar, mode }) => {
  const useFull = mode === "full" || mode === "finalize";
  const score = useFull ? fullScore(bar) : searchScore(bar);
  return {
    score,
    finite: true,
    mode: useFull ? "full" : "search",
    exploratory: !useFull,
    validForFinalRanking: useFull,
  };
};

describe("reevaluateIncumbentBar", () => {
  it("freshly evaluates under the provided Vigour context (ignores any stored score)", () => {
    const bar = ["c", "b", "a"] as const;
    const stale = 999_999;
    const result = reevaluateIncumbentBar(bar, { evaluate, mode: "full" });
    expect(result.score).toBe(fullScore(bar));
    expect(result.score).not.toBe(stale);
    expect(result.validForFinalRanking).toBe(true);
  });
});

describe("compareVigourSearch", () => {
  it("seeds the no-Vigour winner as authored incumbent and never uses stale score", () => {
    const incumbentBar = ["c", "a"] as const;
    const staleIncumbentScore = 1e9;

    const out = compareVigourSearch({
      incumbentBar,
      staleIncumbentScore,
      evaluate,
      pool,
      sizeBounds: { min: 1, max: 3 },
      tier: "thorough",
      seed: 7,
      config: { evaluationBudget: 40, fullShortlistSize: 4 },
    });

    expect(out.reevaluatedScore).toBe(fullScore(incumbentBar));
    expect(out.reevaluatedScore).not.toBe(staleIncumbentScore);
    expect(out.search.best).not.toBeNull();

    // Comparison is only against fresh reeval.
    if (out.search.best) {
      const winnerScore = out.search.best.robustScore;
      expect(out.winnerBeatsIncumbent).toBe(winnerScore > out.reevaluatedScore + 1e-12);
      expect(out.winnerTiesIncumbent).toBe(Math.abs(winnerScore - out.reevaluatedScore) <= 1e-12);
      // Solver must not report a worse full winner than the reevaluated seed.
      expect(winnerScore + 1e-9).toBeGreaterThanOrEqual(out.reevaluatedScore);
    }
  });

  it("reports winnerIsIncumbentBar when search keeps the reevaluated bar", () => {
    // Force evaluate to prefer the incumbent composition on full score.
    const incumbentBar = ["a", "b", "c"] as const;
    const biased: EvaluateFn = ({ bar, mode }) => {
      const useFull = mode === "full" || mode === "finalize";
      const base = useFull ? fullScore(bar) : searchScore(bar);
      const bonus =
        useFull &&
        bar.length === incumbentBar.length &&
        bar.every((id, i) => id === incumbentBar[i])
          ? 10_000
          : 0;
      return {
        score: base + bonus,
        finite: true,
        mode: useFull ? "full" : "search",
        exploratory: !useFull,
        validForFinalRanking: useFull,
      };
    };

    const out = compareVigourSearch({
      incumbentBar,
      staleIncumbentScore: -1,
      evaluate: biased,
      pool,
      sizeBounds: { min: 3, max: 3 },
      tier: "thorough",
      seed: 1,
      config: { evaluationBudget: 30, fullShortlistSize: 3 },
    });

    expect(out.reevaluatedScore).toBe(fullScore(incumbentBar) + 10_000);
    expect(out.winnerIsIncumbentBar).toBe(true);
    expect(out.winnerBeatsIncumbent).toBe(false);
    expect(out.winnerTiesIncumbent).toBe(true);
  });
});
