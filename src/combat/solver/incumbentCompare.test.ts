import { describe, expect, it } from "vitest";
import { INCUMBENT_SCORE_TOLERANCE } from "./contracts";
import {
  barsEqual,
  candidateBeatsIncumbent,
  finiteFullScore,
  scoreImprovementAbsolute,
  scoreImprovementPercent,
} from "./incumbentCompare";

describe("incumbentCompare", () => {
  describe("finiteFullScore", () => {
    it("passes through finite numbers", () => {
      expect(finiteFullScore(12.5)).toBe(12.5);
      expect(finiteFullScore(0)).toBe(0);
    });

    it("maps null, undefined, NaN, +/-Infinity to -Infinity", () => {
      expect(finiteFullScore(null)).toBe(Number.NEGATIVE_INFINITY);
      expect(finiteFullScore(undefined)).toBe(Number.NEGATIVE_INFINITY);
      expect(finiteFullScore(Number.NaN)).toBe(Number.NEGATIVE_INFINITY);
      expect(finiteFullScore(Number.POSITIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
      expect(finiteFullScore(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
    });
  });

  describe("candidateBeatsIncumbent", () => {
    it("candidate slightly above within tolerance does not beat", () => {
      const incumbent = 1000;
      const candidate = incumbent + INCUMBENT_SCORE_TOLERANCE * 0.5;
      expect(candidateBeatsIncumbent(candidate, incumbent)).toBe(false);
      expect(candidateBeatsIncumbent(candidate, incumbent, INCUMBENT_SCORE_TOLERANCE)).toBe(false);
    });

    it("candidate above by more than tolerance beats", () => {
      const incumbent = 1000;
      const candidate = incumbent + INCUMBENT_SCORE_TOLERANCE * 2;
      expect(candidateBeatsIncumbent(candidate, incumbent)).toBe(true);
    });

    it("equal scores do not beat", () => {
      expect(candidateBeatsIncumbent(500, 500)).toBe(false);
      expect(candidateBeatsIncumbent(0, 0)).toBe(false);
    });

    it("unrankable incumbent (-Infinity) + finite candidate beats", () => {
      expect(candidateBeatsIncumbent(1, Number.NEGATIVE_INFINITY)).toBe(true);
      expect(candidateBeatsIncumbent(0, Number.NaN)).toBe(true);
      expect(candidateBeatsIncumbent(10, null as unknown as number)).toBe(true);
    });

    it("unrankable candidate never beats", () => {
      expect(candidateBeatsIncumbent(Number.NEGATIVE_INFINITY, 100)).toBe(false);
      expect(candidateBeatsIncumbent(Number.NaN, Number.NEGATIVE_INFINITY)).toBe(false);
    });

    it("strictly below incumbent does not beat", () => {
      expect(candidateBeatsIncumbent(99, 100)).toBe(false);
    });
  });

  describe("scoreImprovementAbsolute", () => {
    it("returns 0 when not an upgrade", () => {
      expect(scoreImprovementAbsolute(200, 100, false)).toBe(0);
    });

    it("returns winner - incumbent on upgrade", () => {
      expect(scoreImprovementAbsolute(150, 100, true)).toBe(50);
    });

    it("returns winner score when incumbent was unrankable", () => {
      expect(scoreImprovementAbsolute(42, Number.NEGATIVE_INFINITY, true)).toBe(42);
    });

    it("returns 0 when winner is unrankable", () => {
      expect(scoreImprovementAbsolute(Number.NEGATIVE_INFINITY, 10, true)).toBe(0);
    });
  });

  describe("scoreImprovementPercent", () => {
    it("returns null when not an upgrade", () => {
      expect(scoreImprovementPercent(200, 100, false)).toBeNull();
    });

    it("returns 100 * abs / |incumbent| when upgrade with finite denominator", () => {
      expect(scoreImprovementPercent(150, 100, true)).toBeCloseTo(50, 9);
      expect(scoreImprovementPercent(110, 100, true)).toBeCloseTo(10, 9);
    });

    it("returns null when incumbent is unrankable or near-zero", () => {
      expect(scoreImprovementPercent(50, Number.NEGATIVE_INFINITY, true)).toBeNull();
      expect(scoreImprovementPercent(1, 0, true)).toBeNull();
      expect(scoreImprovementPercent(1, INCUMBENT_SCORE_TOLERANCE / 2, true)).toBeNull();
    });

    it("uses absolute value of negative incumbent in denominator", () => {
      // Unusual but defined: |incumbent| in denominator.
      expect(scoreImprovementPercent(-50, -100, true)).toBeCloseTo(50, 9);
    });
  });

  describe("barsEqual", () => {
    it("matches identical sequences", () => {
      expect(barsEqual(["a", "b"], ["a", "b"])).toBe(true);
    });

    it("rejects length, order, or empty/null", () => {
      expect(barsEqual(["a", "b"], ["b", "a"])).toBe(false);
      expect(barsEqual(["a"], ["a", "b"])).toBe(false);
      expect(barsEqual([], ["a"])).toBe(false);
      expect(barsEqual(null, ["a"])).toBe(false);
      expect(barsEqual(undefined, undefined)).toBe(false);
    });
  });
});
