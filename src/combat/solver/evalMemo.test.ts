import { describe, expect, it, beforeEach } from "vitest";
import { clearEvalMemo, readEvalMemo, writeEvalMemo, evalMemoStats } from "./evalMemo";

describe("evalMemo", () => {
  beforeEach(() => {
    clearEvalMemo();
  });

  it("stores finite scores and returns them on the next read", () => {
    writeEvalMemo("k1", {
      score: 1200,
      finite: true,
      mode: "full",
      validForFinalRanking: true,
    });
    expect(readEvalMemo("k1")?.score).toBe(1200);
    expect(evalMemoStats().hits).toBe(1);
  });

  it("does not store failures", () => {
    writeEvalMemo("bad", {
      score: Number.NEGATIVE_INFINITY,
      finite: false,
    });
    expect(readEvalMemo("bad")).toBeUndefined();
  });
});
