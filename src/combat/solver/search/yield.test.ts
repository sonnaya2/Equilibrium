import { describe, expect, it, vi } from "vitest";
import type { SearchState } from "./types";
import { createYieldCtx, maybeYield, yieldEveryForTier } from "./yield";

function stateAt(used: number): SearchState {
  return { budget: { used } } as SearchState;
}

describe("cooperative solver yielding", () => {
  it("uses wider bounded evaluation batches for larger tiers", () => {
    expect(yieldEveryForTier("thorough")).toBe(32);
    expect(yieldEveryForTier("extreme")).toBe(64);
    expect(yieldEveryForTier("unhinged")).toBe(128);
  });

  it("yields at the evaluation-count bound", async () => {
    const yieldSlice = vi.fn(async () => undefined);
    const every = yieldEveryForTier("thorough");
    const ctx = createYieldCtx(yieldSlice, every, 60_000);

    await maybeYield(stateAt(every - 1), ctx);
    expect(yieldSlice).not.toHaveBeenCalled();

    await maybeYield(stateAt(every), ctx);
    expect(yieldSlice).toHaveBeenCalledTimes(1);
  });

  it("keeps the wall-time bound when the count bound is not reached", async () => {
    const yieldSlice = vi.fn(async () => undefined);
    const ctx = createYieldCtx(yieldSlice, 10_000, 32);
    ctx.lastYieldMs.t = performance.now() - ctx.maxMs - 1;

    await maybeYield(stateAt(1), ctx);

    expect(yieldSlice).toHaveBeenCalledTimes(1);
  });
});
