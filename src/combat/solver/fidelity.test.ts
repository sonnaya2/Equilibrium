import { describe, expect, it } from "vitest";
import type { EvaluateFn, PoolAbility } from "./contracts";
import { allocateFidelityBudget, FIDELITY_BUDGET_SHARES, mediumHorizonTicks } from "./fidelity";
import { MIN_RANKABLE_HORIZON_TICKS } from "./objective";
import { configForTier, solve, TIER_BUDGETS } from "./solve";
import { createSearchState } from "./search/types";
import { finalizeSearch, fullCandidateList } from "./search/finalize";
import { collectMediumIncumbents, runMediumScreen } from "./search/mediumScreen";
import { planFidelityStages, beginShortStage, beginMediumStage } from "./search/fidelityBudget";

const tinyPool: PoolAbility[] = [
  { id: "a", category: "basic", averageDamage: 10, occupancyTicks: 3 },
  { id: "b", category: "enhanced", averageDamage: 30, occupancyTicks: 3 },
  { id: "c", category: "ultimate", averageDamage: 100, occupancyTicks: 3 },
];

function searchScore(bar: readonly string[]): number {
  const dmg: Record<string, number> = { a: 10, b: 30, c: 100 };
  let score = 0;
  bar.forEach((id, i) => {
    score += (dmg[id] ?? 0) * (bar.length - i);
  });
  if (bar.includes("c")) score += 50;
  return score;
}

/** Medium prefers a/b over c (closer to full objective). */
function mediumScore(bar: readonly string[]): number {
  const dmg: Record<string, number> = { a: 80, b: 50, c: 20 };
  let score = 0;
  bar.forEach((id, i) => {
    score += (dmg[id] ?? 0) * (i + 1);
  });
  return score;
}

function fullScore(bar: readonly string[]): number {
  const dmg: Record<string, number> = { a: 100, b: 40, c: 5 };
  let score = 0;
  bar.forEach((id, i) => {
    score += (dmg[id] ?? 0) * (i + 1);
  });
  return score;
}

const multiFidelityEval: EvaluateFn = ({ bar, mode }) => {
  if (mode === "full" || mode === "finalize") {
    return {
      score: fullScore(bar),
      finite: true,
      mode: "full",
      exploratory: false,
      validForFinalRanking: true,
      fidelity: "full",
      horizonTicks: 150,
    };
  }
  if (mode === "medium") {
    return {
      score: mediumScore(bar),
      finite: true,
      mode: "medium",
      exploratory: false,
      validForFinalRanking: false,
      fidelity: "medium",
      horizonTicks: 95,
    };
  }
  return {
    score: searchScore(bar),
    finite: true,
    mode: "search",
    exploratory: true,
    validForFinalRanking: false,
    fidelity: "short",
    horizonTicks: 40,
  };
};

describe("multi-fidelity allocation", () => {
  it("does not lower TIER_BUDGETS production numbers", () => {
    expect(TIER_BUDGETS.thorough).toBe(2_400);
    expect(TIER_BUDGETS.extreme).toBe(4_000);
    expect(TIER_BUDGETS.unhinged).toBe(10_000);
    expect(FIDELITY_BUDGET_SHARES.short + FIDELITY_BUDGET_SHARES.medium).toBeCloseTo(1, 9);
  });

  it("partitions total budget short+medium without waste", () => {
    const alloc = allocateFidelityBudget(2_400);
    expect(alloc.short + alloc.medium).toBe(2_400);
    expect(alloc.short).toBeGreaterThan(alloc.medium);
    expect(alloc.medium).toBeGreaterThan(0);
  });

  it("keeps tiny budgets short-only (unit tests / quick)", () => {
    const alloc = allocateFidelityBudget(20);
    expect(alloc.short).toBe(20);
    expect(alloc.medium).toBe(0);
  });

  it("medium horizon is rankable and strictly below full", () => {
    const mid = mediumHorizonTicks(40, 150);
    expect(mid).not.toBeNull();
    expect(mid!).toBeGreaterThanOrEqual(MIN_RANKABLE_HORIZON_TICKS);
    expect(mid!).toBeLessThan(150);
    expect(mid!).toBeGreaterThan(40);
  });

  it("returns null medium when full is only min-rankable", () => {
    expect(mediumHorizonTicks(24, MIN_RANKABLE_HORIZON_TICKS)).toBeNull();
  });
});

describe("multi-fidelity search honesty", () => {
  it("medium scores never set validForFinalRanking", () => {
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate: multiFidelityEval,
      config: {
        ...configForTier("thorough", 1),
        evaluationBudget: 80,
        mediumHorizonTicks: 95,
        searchHorizonTicks: 40,
        fullHorizonTicks: 150,
      },
      seeds: [["a", "b"]],
    });
    const m = state.tryEval(["a", "b"], "medium", "t");
    expect(m).not.toBeNull();
    expect(m!.mode).toBe("medium");
    expect(m!.validForFinalRanking).toBe(false);
    expect(m!.fidelity).toBe("medium");
    expect(state.bestMedium?.fingerprint).toBe(m!.fingerprint);
    expect(state.bestFull).toBeNull();
  });

  it("finalize still force-evals full horizon (not medium)", () => {
    const modes: string[] = [];
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      modes.push(mode ?? "search");
      return multiFidelityEval({ bar, mode });
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate,
      tier: "thorough",
      seed: 7,
      config: {
        evaluationBudget: 120,
        mediumHorizonTicks: 95,
        searchHorizonTicks: 40,
        fullHorizonTicks: 150,
        fullShortlistSize: 3,
      },
    });
    expect(modes.some((m) => m === "medium")).toBe(true);
    expect(modes.some((m) => m === "full" || m === "finalize")).toBe(true);
    if (result.status === "ok") {
      expect(result.best!.mode).toBe("full");
      expect(result.best!.validForFinalRanking).toBe(true);
      expect(result.best!.fidelity === "full" || result.best!.fidelity === undefined).toBe(true);
    }
    const fullCalls = modes.filter((m) => m === "full" || m === "finalize");
    expect(fullCalls.length).toBeGreaterThan(0);
  });

  it("exploratory-only never promotes to validForFinalRanking via medium path", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
      }
      if (mode === "medium") {
        return {
          score: 9999,
          finite: true,
          mode: "medium",
          exploratory: false,
          // Malicious mock: production toScoredBar must strip this.
          validForFinalRanking: true,
          fidelity: "medium",
        };
      }
      return {
        score: searchScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
        validForFinalRanking: false,
      };
    };
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      config: {
        ...configForTier("thorough", 2),
        evaluationBudget: 40,
        mediumHorizonTicks: 95,
      },
    });
    const m = state.tryEval(["c", "a"], "medium");
    expect(m).not.toBeNull();
    expect(m!.validForFinalRanking).toBe(false);
    expect(state.bestFull).toBeNull();
    const fin = finalizeSearch(state, { tier: "thorough" });
    expect(fin.validFullCandidateCount).toBe(0);
    expect(fin.status).toBe("failed");
    expect(fin.best).toBeNull();
    expect(fin.proof).toBe("failed");
  });

  it("previous winners are medium-stage incumbents", () => {
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate: multiFidelityEval,
      config: {
        ...configForTier("thorough", 3),
        evaluationBudget: 50,
        mediumHorizonTicks: 95,
      },
      seeds: [["a", "b"]],
    });
    state.tryEval(["c", "b"], "search");
    state.tryEval(["a", "b"], "search");
    const incumbents = collectMediumIncumbents(state);
    expect(incumbents.some((b) => b.join(",") === "c,b" || b.join(",") === "a,b")).toBe(true);
    expect(incumbents.some((b) => b.join(",") === "a,b")).toBe(true);
  });

  it("staged budget: short then medium without exceeding total", () => {
    const config = {
      ...configForTier("thorough", 1),
      evaluationBudget: 100,
      mediumHorizonTicks: 95,
    };
    const plan = planFidelityStages(config);
    expect(plan.runMedium).toBe(true);
    expect(plan.allocation.short + plan.allocation.medium).toBe(100);

    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate: multiFidelityEval,
      config,
      seeds: [["a", "b"]],
    });
    beginShortStage(state, plan);
    expect(state.budget.remaining).toBe(plan.allocation.short);

    // Simulate short stage fully spent (cache hits would not burn remaining).
    state.budget.used = plan.allocation.short;
    state.budget.remaining = 0;

    beginMediumStage(state, plan);
    expect(state.budget.remaining).toBe(plan.allocation.medium);
    expect(state.budget.used + state.budget.remaining).toBe(100);

    // Seed short archive so medium screen has incumbents.
    state.forceEval(["a", "b"], "search");
    state.budget.remaining = plan.allocation.medium;
    runMediumScreen(state);
    expect(state.mediumEvaluations).toBeGreaterThan(0);
    expect(state.bestMedium == null || state.bestMedium.validForFinalRanking === false).toBe(true);
  });

  it("fullCandidateList prefers medium incumbents before pure explore fillers", () => {
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate: multiFidelityEval,
      config: {
        ...configForTier("thorough", 4),
        evaluationBudget: 80,
        mediumHorizonTicks: 95,
        fullShortlistSize: 4,
      },
      seeds: [["a"]],
    });
    state.tryEval(["c", "b", "a"], "search");
    state.tryEval(["a", "b"], "search");
    state.tryEval(["a", "b"], "medium");
    const pool = [
      state.forceEval(["c", "b", "a"], "search")!,
      state.forceEval(["a", "b"], "search")!,
    ].filter(Boolean);
    const list = fullCandidateList(pool, state, ["a", "b"]);
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((s) => s.fingerprint === "a,b" || s.bar.join(",") === "a,b")).toBe(true);
  });

  it("solve without mediumHorizonTicks keeps full budget on short (compat)", () => {
    const modes: string[] = [];
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      modes.push(mode ?? "search");
      return multiFidelityEval({ bar, mode });
    };
    solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 1,
      config: { evaluationBudget: 40 },
    });
    expect(modes.every((m) => m !== "medium")).toBe(true);
  });
});
