import { describe, expect, it } from "vitest";
import type { EvaluateFn, PoolAbility } from "./contracts";
import { buildSeeds } from "./seeds";
import { createRng } from "./rng";
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

    expect(out.seededIncumbentBar).toEqual(["c", "a"]);
    expect(out.reevaluatedScore).toBe(fullScore(incumbentBar));
    expect(out.reevaluatedScore).not.toBe(staleIncumbentScore);
    expect(out.search.best).not.toBeNull();

    if (out.search.best) {
      const winnerScore = out.search.best.robustScore;
      expect(out.winnerBeatsIncumbent).toBe(winnerScore > out.reevaluatedScore + 1e-12);
      expect(out.winnerTiesIncumbent).toBe(Math.abs(winnerScore - out.reevaluatedScore) <= 1e-12);
      // Solver must not report a worse full winner than the reevaluated seed.
      expect(winnerScore + 1e-9).toBeGreaterThanOrEqual(out.reevaluatedScore);
    }
  });

  it("does not claim winner beats incumbent when only degraded exploratory best exists", () => {
    const residualFail: EvaluateFn = ({ mode }) => {
      const useFull = mode === "full" || mode === "finalize";
      if (useFull) {
        return {
          score: Number.NEGATIVE_INFINITY,
          finite: false,
          mode: "full",
          exploratory: false,
          validForFinalRanking: false,
        };
      }
      return {
        score: 999,
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };

    const out = compareVigourSearch({
      incumbentBar: ["c", "a"],
      staleIncumbentScore: 1e9,
      evaluate: residualFail,
      pool,
      sizeBounds: { min: 1, max: 2 },
      tier: "thorough",
      seed: 2,
      config: { evaluationBudget: 20, fullShortlistSize: 2 },
    });

    expect(out.reevaluatedScore).toBe(Number.NEGATIVE_INFINITY);
    expect(out.winnerBeatsIncumbent).toBe(false);
    expect(out.winnerTiesIncumbent).toBe(false);
  });

  it("reports winnerIsIncumbentBar when search keeps the reevaluated bar", () => {
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

  it("aligns reeval with size-bounds truncate of oversize incumbent", () => {
    // Raw winner is longer than max; buildSeeds keeps only the max prefix.
    const incumbentBar = ["a", "b", "c"] as const;
    const sizeBounds = { min: 1, max: 2 };
    const expectedSeed = ["a", "b"];

    const seeds = buildSeeds({
      pool,
      sizeBounds,
      rng: createRng(1),
      authored: [incumbentBar],
      count: 0,
    });
    expect(seeds.some((s) => s.join("\0") === expectedSeed.join("\0"))).toBe(true);

    // Inflate score of the illegal full bar so a raw reeval would poison ranking.
    const adversarial: EvaluateFn = ({ bar, mode }) => {
      const useFull = mode === "full" || mode === "finalize";
      let score = useFull ? fullScore(bar) : searchScore(bar);
      if (useFull && bar.length === 3 && bar[0] === "a" && bar[1] === "b" && bar[2] === "c") {
        score = 1_000_000;
      }
      return {
        score,
        finite: true,
        mode: useFull ? "full" : "search",
        exploratory: !useFull,
        validForFinalRanking: useFull,
      };
    };

    const out = compareVigourSearch({
      incumbentBar,
      staleIncumbentScore: 1e9,
      evaluate: adversarial,
      pool,
      sizeBounds,
      tier: "thorough",
      seed: 3,
      config: { evaluationBudget: 40, fullShortlistSize: 4 },
    });

    expect(out.seededIncumbentBar).toEqual(expectedSeed);
    // Reeval must score the truncated seed, not the oversize raw bar.
    expect(out.reevaluatedScore).toBe(fullScore(expectedSeed));
    expect(out.reevaluatedScore).not.toBe(1_000_000);
    expect(out.winnerIsIncumbentBar).toBe(
      out.search.best != null &&
        out.search.best.bar.length === expectedSeed.length &&
        out.search.best.bar.every((id, i) => id === expectedSeed[i]),
    );

    if (out.search.best?.validForFinalRanking && out.search.best.mode === "full") {
      expect(out.search.best.robustScore + 1e-9).toBeGreaterThanOrEqual(out.reevaluatedScore);
      const rankableWinner = true;
      expect(out.winnerBeatsIncumbent || out.winnerTiesIncumbent).toBe(rankableWinner);
    }
  });

  it("aligns reeval with exclusive-group filter of illegal co-group pair", () => {
    const exclusivePool: PoolAbility[] = [
      {
        id: "u1",
        category: "ultimate",
        averageDamage: 100,
        occupancyTicks: 3,
        exclusiveGroup: "ult",
      },
      {
        id: "u2",
        category: "ultimate",
        averageDamage: 90,
        occupancyTicks: 3,
        exclusiveGroup: "ult",
      },
      { id: "b1", category: "basic", averageDamage: 10, occupancyTicks: 3 },
      { id: "b2", category: "basic", averageDamage: 12, occupancyTicks: 3 },
    ];
    // u1+u2 share exclusiveGroup; seed keeps first legal members only: [u1, b1].
    const incumbentBar = ["u1", "u2", "b1"] as const;
    const sizeBounds = { min: 2, max: 3 };
    const expectedSeed = ["u1", "b1"];

    const seeds = buildSeeds({
      pool: exclusivePool,
      sizeBounds,
      rng: createRng(1),
      authored: [incumbentBar],
      count: 0,
    });
    expect(seeds.some((s) => s.join("\0") === expectedSeed.join("\0"))).toBe(true);

    const adversarial: EvaluateFn = ({ bar, mode }) => {
      const useFull = mode === "full" || mode === "finalize";
      const base =
        bar.reduce((s, id, i) => s + (id.startsWith("u") ? 50 : 5) * (i + 1), 0) +
        (bar.includes("u1") && bar.includes("u2") ? 500_000 : 0);
      return {
        score: useFull ? base : base * 0.1,
        finite: true,
        mode: useFull ? "full" : "search",
        exploratory: !useFull,
        validForFinalRanking: useFull,
      };
    };

    const out = compareVigourSearch({
      incumbentBar,
      evaluate: adversarial,
      pool: exclusivePool,
      sizeBounds,
      tier: "thorough",
      seed: 5,
      config: { evaluationBudget: 50, fullShortlistSize: 4 },
    });

    expect(out.seededIncumbentBar).toEqual(expectedSeed);
    // Must not reeval the illegal dual-ult bar (500k poison).
    expect(out.reevaluatedScore).toBeLessThan(10_000);
    expect(out.reevaluatedScore).toBe(
      expectedSeed.reduce((s, id, i) => s + (id.startsWith("u") ? 50 : 5) * (i + 1), 0),
    );

    if (
      out.search.best &&
      out.search.best.validForFinalRanking === true &&
      out.search.best.mode === "full" &&
      Number.isFinite(out.reevaluatedScore) &&
      out.reevaluatedScore > Number.NEGATIVE_INFINITY
    ) {
      expect(out.search.best.robustScore + 1e-9).toBeGreaterThanOrEqual(out.reevaluatedScore);
      // Rankability gates still apply.
      expect(out.winnerBeatsIncumbent || out.winnerTiesIncumbent).toBe(true);
      if (out.winnerBeatsIncumbent) {
        expect(out.search.best.robustScore).toBeGreaterThan(out.reevaluatedScore + 1e-12);
      }
    }
  });

  it("marks unseedable short incumbent as non-rankable (no pad fill available)", () => {
    const thinPool: PoolAbility[] = [
      { id: "only", category: "basic", averageDamage: 1, occupancyTicks: 3 },
    ];
    const out = compareVigourSearch({
      incumbentBar: ["only"],
      evaluate,
      pool: thinPool,
      sizeBounds: { min: 3, max: 3 },
      tier: "thorough",
      seed: 1,
      config: { evaluationBudget: 10, fullShortlistSize: 1 },
    });

    expect(out.seededIncumbentBar).toBeNull();
    expect(out.reevaluatedScore).toBe(Number.NEGATIVE_INFINITY);
    expect(out.winnerBeatsIncumbent).toBe(false);
    expect(out.winnerTiesIncumbent).toBe(false);
    expect(out.winnerIsIncumbentBar).toBe(false);
  });

  it("aligns reeval with pad-to-min of short authored incumbent", () => {
    // Raw winner is below min; buildSeeds pads with pool-order remainders.
    const incumbentBar = ["c"] as const;
    const sizeBounds = { min: 2, max: 3 };

    const seeds = buildSeeds({
      pool,
      sizeBounds,
      rng: createRng(1),
      authored: [incumbentBar],
      count: 0,
    });
    const authoredSeed = seeds.find((s) => s[0] === "c");
    expect(authoredSeed).toBeDefined();
    expect(authoredSeed!.length).toBeGreaterThanOrEqual(sizeBounds.min);

    // Raw single-slot score must not drive comparison when search seeds the pad.
    const adversarial: EvaluateFn = ({ bar, mode }) => {
      const useFull = mode === "full" || mode === "finalize";
      let score = useFull ? fullScore(bar) : searchScore(bar);
      if (useFull && bar.length === 1 && bar[0] === "c") score = 1_000_000;
      return {
        score,
        finite: true,
        mode: useFull ? "full" : "search",
        exploratory: !useFull,
        validForFinalRanking: useFull,
      };
    };

    const out = compareVigourSearch({
      incumbentBar,
      staleIncumbentScore: fullScore(incumbentBar),
      evaluate: adversarial,
      pool,
      sizeBounds,
      tier: "thorough",
      seed: 9,
      config: { evaluationBudget: 40, fullShortlistSize: 4 },
    });

    expect(out.seededIncumbentBar).toEqual(authoredSeed);
    expect(out.seededIncumbentBar!.length).toBeGreaterThanOrEqual(sizeBounds.min);
    expect(out.reevaluatedScore).toBe(fullScore(out.seededIncumbentBar!));
    expect(out.reevaluatedScore).not.toBe(1_000_000);
    expect(out.reevaluatedScore).not.toBe(fullScore(incumbentBar));

    if (out.search.best?.validForFinalRanking && out.search.best.mode === "full") {
      expect(out.search.best.robustScore + 1e-9).toBeGreaterThanOrEqual(out.reevaluatedScore);
    }
  });
});
