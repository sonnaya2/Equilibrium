import { describe, expect, it } from "vitest";
import {
  compareSolverResultDTO,
  isEffectivelyEqualScore,
  isRankableSolverResult,
  pickBestSolverResult,
} from "./rankResults";
import { mergeResults } from "./worker/pool";
import type { SolverResultDTO } from "./worker/serializable";

function dto(
  partial: Partial<SolverResultDTO> & Pick<SolverResultDTO, "bar" | "score">,
): SolverResultDTO {
  return {
    windowDpms: 0,
    evaluations: 1,
    uniqueCandidates: 1,
    seed: 1,
    profileId: "balanced",
    tier: "thorough",
    durationTicks: 100,
    solveIdentity: "",
    proofLabel: "heuristic-best-found",
    ...partial,
  };
}

describe("rankResults", () => {
  it("higher score beats longer bar", () => {
    const shortHigh = dto({ bar: ["a", "b", "c", "d"], score: 12_000, seed: 1 });
    const longLow = dto({
      bar: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
      score: 11_000,
      seed: 2,
    });
    expect(compareSolverResultDTO(shortHigh, longLow)).toBeLessThan(0);
    expect(pickBestSolverResult([longLow, shortHigh])).toBe(shortHigh);
    expect(mergeResults([longLow, shortHigh]).bar).toEqual(shortHigh.bar);
    expect(mergeResults([longLow, shortHigh]).score).toBe(12_000);
  });

  it("meaningfully lower score never wins via length (legacy 2% band)", () => {
    // Old merge used 2% near-tie -> longer bar. That must not reverse a real gap.
    const short = dto({ bar: ["a", "b", "c", "d"], score: 1000, seed: 1 });
    const long = dto({
      bar: ["a", "b", "c", "d", "e", "f", "g", "h"],
      score: 985, // within old 2% band of 1000
      seed: 2,
    });
    expect(isEffectivelyEqualScore(1000, 985)).toBe(false);
    expect(pickBestSolverResult([long, short]).score).toBe(1000);
    expect(mergeResults([long, short]).score).toBe(1000);
  });

  it("deterministic exact ties prefer longer bar then stable fingerprint", () => {
    const a = dto({ bar: ["x", "y", "z", "w"], score: 5000, seed: 1 });
    const b = dto({ bar: ["x", "y", "z", "w", "v"], score: 5000, seed: 2 });
    expect(isEffectivelyEqualScore(5000, 5000)).toBe(true);
    expect(pickBestSolverResult([a, b]).bar).toEqual(b.bar);

    const c = dto({ bar: ["a", "b", "c", "d"], score: 5000, seed: 3 });
    const d = dto({ bar: ["e", "f", "g", "h"], score: 5000, seed: 4 });
    // Same length -> lexicographic bar fingerprint.
    const best = pickBestSolverResult([d, c]);
    expect(best.bar.join(",")).toBe(
      ["a", "b", "c", "d"].join(",") < ["e", "f", "g", "h"].join(",") ? "a,b,c,d" : "e,f,g,h",
    );
  });

  it("rankable status beats empty/failed even with higher junk score", () => {
    const good = dto({
      bar: ["a", "b", "c", "d"],
      score: 100,
      proofLabel: "heuristic-best-found",
    });
    const empty = dto({ bar: [], score: 999_999, proofLabel: "failed" });
    expect(pickBestSolverResult([empty, good])).toBe(good);
  });

  it("degraded-exploratory-fallback is never rankable (Phase 4)", () => {
    const good = dto({
      bar: ["a", "b", "c", "d"],
      score: 100,
      proofLabel: "heuristic-best-found",
    });
    const degraded = dto({
      bar: ["x", "y", "z", "w"],
      score: 999_999,
      proofLabel: "degraded-exploratory-fallback",
    });
    expect(isRankableSolverResult(degraded)).toBe(false);
    expect(pickBestSolverResult([degraded, good])).toBe(good);
    expect(mergeResults([degraded, good]).score).toBe(100);
  });

  it("mergeResults keeps the winner solveIdentity when host request omitted", () => {
    const shortHigh = dto({
      bar: ["a", "b", "c", "d"],
      score: 12_000,
      seed: 1,
      solveIdentity: "winner-id",
    });
    const longLow = dto({
      bar: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
      score: 11_000,
      seed: 2,
      solveIdentity: "loser-id",
    });
    expect(mergeResults([longLow, shortHigh]).solveIdentity).toBe("winner-id");
  });
});
