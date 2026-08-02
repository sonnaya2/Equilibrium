/**
 * Adversarial score/proof honesty gates for the Revolution solver.
 * These pin intended contracts — do not weaken to match broken production.
 */
import { describe, expect, it } from "vitest";
import type { EvaluateFn, PoolAbility, ScoredBar } from "../contracts";
import { buildCandidatePool, indexPool } from "../candidatePool";
import { fingerprintEvaluationKey } from "../fingerprint";
import { OBJECTIVE_HORIZON_TICKS } from "../objective";
import { configForTier, solve } from "../solve";
import { createSearchState, cacheKeyFor } from "./types";
import { finalizeSearch, fullCandidateList } from "./finalize";

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

/** Full scores inverted vs search so a high exploratory bar loses on full. */
function fullScore(bar: readonly string[]): number {
  // Prefer a then b then c — opposite of search weighting.
  const dmg: Record<string, number> = { a: 100, b: 40, c: 5 };
  let score = 0;
  bar.forEach((id, i) => {
    score += (dmg[id] ?? 0) * (i + 1);
  });
  return score;
}

describe("score honesty", () => {
  it("1. failed full evaluation never enters the full leaderboard", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
      }
      return { score: searchScore(bar), finite: true, mode: "search", exploratory: true };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 3,
    });
    expect(result.validFullCandidateCount).toBe(0);
    expect(result.top.every((t) => t.mode !== "full" || !t.validForFinalRanking)).toBe(true);
    // May degrade to exploratory, but never a full robust winner.
    if (result.best) {
      expect(result.best.validForFinalRanking).toBe(false);
      expect(result.proof).toBe("degraded-exploratory-fallback");
      expect(result.status).toBe("degraded");
    } else {
      expect(result.proof).toBe("failed");
      expect(result.status).toBe("failed");
    }
  });

  it("2. high exploratory score cannot beat a valid lower full score", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        return {
          score: fullScore(bar),
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
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
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate,
      tier: "thorough",
      seed: 9,
    });
    expect(result.status).toBe("ok");
    expect(result.best).not.toBeNull();
    expect(result.best!.mode).toBe("full");
    expect(result.best!.validForFinalRanking).toBe(true);
    // Winner must be the best among full-rescored shortlist, not explore max.
    const exploreBest = searchScore(["c", "b", "a"]);
    expect(result.best!.robustScore).not.toBe(exploreBest);
    expect(result.bestExploratoryScore).toBeGreaterThanOrEqual(exploreBest - 1e-9);
    expect(result.bestFullScore).toBe(result.best!.robustScore);
  });

  it("3. exhaustive short-horizon search never emits full-objective-global-optimum", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      const score = mode === "full" || mode === "finalize" ? fullScore(bar) : searchScore(bar);
      return {
        score,
        finite: true,
        mode: mode === "full" || mode === "finalize" ? "full" : "search",
        exploratory: mode === "search" || mode === undefined,
        validForFinalRanking: mode === "full" || mode === "finalize",
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate,
      tier: "thorough",
      seed: 1,
    });
    expect(result.exhaustiveCompleted).toBe(true);
    expect(result.proof).not.toBe("full-objective-global-optimum");
  });

  it("4. robust-score failure remains visible (evaluate layer + finalize)", () => {
    // Production path: evaluateRevolutionBar custom profile without weights (evaluate.test.ts).
    // Search path: forceEval full that returns objective failure does not rank.
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        return {
          score: 0,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: false,
          objective: {
            ok: false,
            reason: "simulation failedWeight=0.5",
            robustScore: 0,
            profileId: "balanced",
          },
        };
      }
      return { score: searchScore(bar), finite: true, mode: "search", exploratory: true };
    };
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      config: { ...configForTier("thorough", 2), evaluationBudget: 50 },
      seeds: [["a", "b"]],
    });
    state.tryEval(["a", "b"], "search", "t");
    const full = state.forceEval(["a", "b"], "full", "t");
    expect(full === null || full.validForFinalRanking === false).toBe(true);
    const fin = finalizeSearch(state, { tier: "thorough" });
    expect(fin.validFullCandidateCount).toBe(0);
    expect(fin.proof === "degraded-exploratory-fallback" || fin.proof === "failed").toBe(true);
  });

  it("full-objective-global-optimum requires full-mode cover of feasible space, not shortlist size", () => {
    // Exhaustive search + shortlist full rescore must NOT claim full global optimum
    // when only a few bars received full evaluation.
    const evaluate: EvaluateFn = ({ bar, mode }) => ({
      score: mode === "full" || mode === "finalize" ? fullScore(bar) : searchScore(bar),
      finite: true,
      mode: mode === "full" || mode === "finalize" ? "full" : "search",
      exploratory: mode !== "full" && mode !== "finalize",
      validForFinalRanking: mode === "full" || mode === "finalize",
    });
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate,
      tier: "thorough",
      seed: 1,
      config: { fullShortlistSize: 3 },
    });
    expect(result.exhaustiveCompleted).toBe(true);
    // Feasible space is 15 bars; shortlist is 3 — not a full cover.
    expect(result.proof).not.toBe("full-objective-global-optimum");
    expect(result.proof).toBe("full-shortlist-best");
  });

  it("never emits legacy globally-optimal / converged / best-found proof labels", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => ({
      score: mode === "full" || mode === "finalize" ? fullScore(bar) : searchScore(bar),
      finite: true,
      mode: mode === "full" || mode === "finalize" ? "full" : "search",
      exploratory: mode !== "full" && mode !== "finalize",
      validForFinalRanking: mode === "full" || mode === "finalize",
    });
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate,
      tier: "thorough",
      seed: 2,
    });
    const legacy = new Set(["globally-optimal", "converged", "best-found"]);
    expect(legacy.has(result.proof)).toBe(false);
  });

  it("failed full attempts alone never unlock full-objective-global-optimum", () => {
    // Even if every feasible bar is "attempted" under full mode and fails,
    // do not claim global optimum from a single residual success (none here).
    let fullCalls = 0;
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        fullCalls += 1;
        return { score: Number.NEGATIVE_INFINITY, finite: false, mode: "full" };
      }
      return {
        score: searchScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 5,
      config: { fullShortlistSize: 20, evaluationBudget: 200 },
    });
    expect(fullCalls).toBeGreaterThan(0);
    expect(result.proof).not.toBe("full-objective-global-optimum");
    expect(result.validFullCandidateCount).toBe(0);
  });

  it("5. no valid candidate returns failure rather than a zero-score winner", () => {
    const evaluate: EvaluateFn = () => ({
      score: Number.NEGATIVE_INFINITY,
      finite: false,
    });
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 4,
      authoredSeeds: [],
    });
    expect(result.status).toBe("failed");
    expect(result.best).toBeNull();
    expect(result.proof).toBe("failed");
    expect(result.top).toHaveLength(0);
  });

  it("6. search and full cache entries for the same bar remain distinct", () => {
    const calls: string[] = [];
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      const m = mode === "full" || mode === "finalize" ? "full" : "search";
      calls.push(`${m}:${bar.join(",")}`);
      return {
        score: m === "full" ? 1 : 100,
        finite: true,
        mode: m,
        exploratory: m === "search",
        validForFinalRanking: m === "full",
      };
    };
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 1 },
      evaluate,
      config: { ...configForTier("thorough", 1), evaluationBudget: 20 },
    });
    const s1 = state.tryEval(["a"], "search");
    const f1 = state.forceEval(["a"], "full");
    const s2 = state.tryEval(["a"], "search");
    const f2 = state.forceEval(["a"], "full");
    expect(s1?.mode).toBe("search");
    expect(f1?.mode).toBe("full");
    expect(s1!.robustScore).toBe(100);
    expect(f1!.robustScore).toBe(1);
    // Second calls hit mode-specific cache — no extra evaluate for same mode+bar.
    expect(calls.filter((c) => c === "search:a")).toHaveLength(1);
    expect(calls.filter((c) => c === "full:a")).toHaveLength(1);
    expect(s2!.robustScore).toBe(100);
    expect(f2!.robustScore).toBe(1);
    expect(cacheKeyFor("search", "a")).not.toBe(cacheKeyFor("full", "a"));
  });

  it("7. full cache hits do not mutate the search best", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => {
      if (mode === "full" || mode === "finalize") {
        return {
          score: 9999,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
        };
      }
      return {
        score: searchScore(bar),
        finite: true,
        mode: "search",
        exploratory: true,
      };
    };
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      config: { ...configForTier("thorough", 5), evaluationBudget: 40 },
    });
    const explore = state.tryEval(["c", "b"], "search");
    expect(explore).not.toBeNull();
    const searchBest = state.bestExploratory!.robustScore;
    state.forceEval(["a"], "full");
    state.forceEval(["a"], "full"); // cache hit
    expect(state.bestExploratory!.robustScore).toBe(searchBest);
    expect(state.best!.robustScore).toBe(searchBest);
    expect(state.bestFull!.robustScore).toBe(9999);
  });

  it("8. final evaluation counts are separate from search budget", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => ({
      score: mode === "full" || mode === "finalize" ? fullScore(bar) : searchScore(bar),
      finite: true,
      mode: mode === "full" || mode === "finalize" ? "full" : "search",
      exploratory: mode !== "full" && mode !== "finalize",
      validForFinalRanking: mode === "full" || mode === "finalize",
    });
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 2,
      config: { evaluationBudget: 30, fullShortlistSize: 4 },
    });
    expect(result.searchEvaluations).toBeGreaterThan(0);
    expect(result.fullEvaluations).toBeGreaterThan(0);
    expect(result.totalEvaluations).toBe(result.searchEvaluations + result.fullEvaluations);
    // Search budget is the configured search allowance; total may exceed it via forceEval.
    expect(result.searchBudget).toBe(30);
    expect(result.stats.searchEvaluations).toBe(result.searchEvaluations);
    expect(result.stats.fullEvaluations).toBe(result.fullEvaluations);
  });

  it("9. duplicate candidate IDs fail during pool creation", () => {
    expect(() => indexPool([{ id: "x" }, { id: "x" }])).toThrow(/duplicate/i);
    const catalogue = [
      {
        id: "dup",
        name: "Dup",
        style: "melee" as const,
        category: "basic" as const,
        hits: [{ band: { minPct: 100, maxPct: 100 } }],
      },
      {
        id: "dup",
        name: "Dup2",
        style: "melee" as const,
        category: "basic" as const,
        hits: [{ band: { minPct: 100, maxPct: 100 } }],
      },
    ];
    expect(() => buildCandidatePool(catalogue, "melee")).toThrow(/duplicate/i);
  });

  it("10. progress exposes separate exploratory and full values", () => {
    const evaluate: EvaluateFn = ({ mode }) => {
      if (mode === "full" || mode === "finalize") {
        return {
          score: 10,
          finite: true,
          mode: "full",
          exploratory: false,
          validForFinalRanking: true,
        };
      }
      return {
        score: 500,
        finite: true,
        mode: "search",
        exploratory: true,
      };
    };
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 2 },
      evaluate,
      tier: "thorough",
      seed: 6,
    });
    expect(result.bestExploratoryScore).toBe(500);
    expect(result.bestFullScore).toBe(10);
    expect(result.stats.bestExploratoryScore).toBe(500);
    expect(result.stats.bestFullScore).toBe(10);
    // Final winner is full scale, not exploratory 500.
    expect(result.best!.robustScore).toBe(10);
  });

  it("11. deterministic repeated runs produce identical rankings", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => ({
      score: mode === "full" || mode === "finalize" ? fullScore(bar) : searchScore(bar),
      finite: true,
      mode: mode === "full" || mode === "finalize" ? "full" : "search",
      exploratory: mode !== "full" && mode !== "finalize",
      validForFinalRanking: mode === "full" || mode === "finalize",
    });
    const run = () =>
      solve({
        pool: tinyPool,
        sizeBounds: { min: 1, max: 3 },
        evaluate,
        tier: "thorough",
        seed: 99,
      });
    const a = run();
    const b = run();
    expect(a.best?.bar).toEqual(b.best?.bar);
    expect(a.best?.robustScore).toBe(b.best?.robustScore);
    expect(a.top.map((t) => t.fingerprint)).toEqual(b.top.map((t) => t.fingerprint));
    expect(a.proof).toBe(b.proof);
  });

  it("12. existing valid solver behavior remains stable on tiny pool", () => {
    const evaluate: EvaluateFn = ({ bar }) => ({
      score: searchScore(bar),
      finite: true,
    });
    const result = solve({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate,
      tier: "thorough",
      seed: 7,
    });
    expect(result.best).not.toBeNull();
    expect([...result.best!.bar]).toEqual(["c", "b", "a"]);
    expect(result.best!.robustScore).toBe(420);
  });

  it("full shortlist expands beyond two near-identical candidates", () => {
    const evaluate: EvaluateFn = ({ bar, mode }) => ({
      score: mode === "full" || mode === "finalize" ? fullScore(bar) : searchScore(bar),
      finite: true,
      mode: mode === "full" || mode === "finalize" ? "full" : "search",
      exploratory: mode !== "full" && mode !== "finalize",
      validForFinalRanking: mode === "full" || mode === "finalize",
    });
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 3 },
      evaluate,
      config: {
        ...configForTier("thorough", 1),
        evaluationBudget: 200,
        fullShortlistSize: 8,
      },
      seeds: [["a"], ["b"], ["c"]],
    });
    for (const id of ["a", "b", "c"]) state.tryEval([id], "search");
    state.tryEval(["c", "b", "a"], "search");
    state.tryEval(["c", "a", "b"], "search");
    state.tryEval(["b", "a"], "search");
    const pool = state.archive.filter((s) => s.mode === "search");
    const shortlist = fullCandidateList(pool, state, ["a"]);
    expect(shortlist.length).toBeGreaterThan(2);
  });

  it("evaluation fingerprint keys include mode", () => {
    const searchKey = fingerprintEvaluationKey({
      bar: ["a"],
      mode: "search",
      horizonTicks: 50,
    });
    const fullKey = fingerprintEvaluationKey({
      bar: ["a"],
      mode: "full",
      horizonTicks: OBJECTIVE_HORIZON_TICKS,
    });
    expect(searchKey).not.toBe(fullKey);
    expect(searchKey).toContain("mode=search");
    expect(fullKey).toContain("mode=full");
  });
});

describe("tagged ScoredBar invariants", () => {
  it("toScoredBar via tryEval tags search mode", () => {
    const state = createSearchState({
      pool: tinyPool,
      sizeBounds: { min: 1, max: 1 },
      evaluate: ({ bar }) => ({ score: 1, bar, finite: true }),
      config: configForTier("thorough", 1),
    });
    const scored = state.tryEval(["a"], "search") as ScoredBar;
    expect(scored.mode).toBe("search");
    expect(scored.exploratory).toBe(true);
    expect(scored.validForFinalRanking).toBe(false);
  });
});
