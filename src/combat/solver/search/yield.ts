import type { SearchState } from "./types";

export type YieldCtx = {
  yieldSlice?: () => Promise<void>;
  lastYieldUsed: { n: number };
  every: number;
  lastYieldMs: { t: number };
  /** Soft max ms between yields (main-thread paint). */
  maxMs: number;
};

export function createYieldCtx(
  yieldSlice: (() => Promise<void>) | undefined,
  every: number,
  maxMs = 32,
): YieldCtx {
  return {
    yieldSlice,
    lastYieldUsed: { n: 0 },
    every: Math.max(1, every),
    lastYieldMs: { t: typeof performance !== "undefined" ? performance.now() : 0 },
    maxMs,
  };
}

function needsYield(state: SearchState, ctx: YieldCtx): boolean {
  if (!ctx.yieldSlice) return false;
  const used = state.budget.used;
  if (used - ctx.lastYieldUsed.n >= ctx.every) return true;
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  return now - ctx.lastYieldMs.t >= ctx.maxMs;
}

/** Yield every N budget-consuming evals (or maxMs) so React can paint. */
export async function maybeYield(state: SearchState, ctx: YieldCtx): Promise<void> {
  if (!needsYield(state, ctx) || !ctx.yieldSlice) return;
  ctx.lastYieldUsed.n = state.budget.used;
  ctx.lastYieldMs.t = typeof performance !== "undefined" ? performance.now() : 0;
  await ctx.yieldSlice();
}

export function yieldEveryForTier(tier: string): number {
  if (tier === "unhinged") return 16;
  if (tier === "extreme") return 8;
  return 4;
}
