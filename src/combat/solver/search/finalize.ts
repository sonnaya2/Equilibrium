import type { ProofLabel, ScoredBar, SolveResult, SolveTier } from "../contracts";
import { diverseSelect } from "../diversity";
import type { SearchState } from "./types";

export interface FinalizeOptions {
  tier: SolveTier;
  topK?: number;
  /** Yield between expensive full-horizon re-scores so the UI can paint. */
  yieldSlice?: () => Promise<void>;
  onStep?: (info: { done: number; total: number; label: string }) => void;
}

function isRankable(s: ScoredBar | null | undefined): s is ScoredBar {
  return Boolean(s && Number.isFinite(s.robustScore) && s.bar.length > 0);
}

function pickSeedBest(state: SearchState): {
  seedBestScore: number;
  seedBestBar: readonly string[] | null;
} {
  let seedBestScore = Number.NEGATIVE_INFINITY;
  let seedBestBar: readonly string[] | null = null;
  for (const seed of state.seeds) {
    const explore = state.forceEval(seed, "search", "seed-baseline-explore");
    if (isRankable(explore) && explore.robustScore > seedBestScore) {
      seedBestScore = explore.robustScore;
      seedBestBar = explore.bar;
    }
  }
  return { seedBestScore, seedBestBar };
}

async function pickSeedBestAsync(
  state: SearchState,
  yieldSlice: () => Promise<void>,
): Promise<{ seedBestScore: number; seedBestBar: readonly string[] | null }> {
  let seedBestScore = Number.NEGATIVE_INFINITY;
  let seedBestBar: readonly string[] | null = null;
  for (let i = 0; i < state.seeds.length; i++) {
    const seed = state.seeds[i]!;
    const explore = state.forceEval(seed, "search", "seed-baseline-explore");
    if (isRankable(explore) && explore.robustScore > seedBestScore) {
      seedBestScore = explore.robustScore;
      seedBestBar = explore.bar;
    }
    // Yield between seed re-scores so main-thread fallback can paint / cancel.
    if (i + 1 < state.seeds.length) await yieldSlice();
  }
  return { seedBestScore, seedBestBar };
}

function buildPool(state: SearchState, seedBestBar: readonly string[] | null): ScoredBar[] {
  const pool: ScoredBar[] = [];
  const seen = new Set<string>();
  const add = (s: ScoredBar | null | undefined) => {
    if (!isRankable(s)) return;
    if (seen.has(s.fingerprint)) return;
    seen.add(s.fingerprint);
    pool.push(s);
  };
  add(state.best);
  for (const a of state.archive) add(a);
  if (seedBestBar) add(state.forceEval(seedBestBar, "search", "seed-in-pool"));
  pool.sort((a, b) => b.robustScore - a.robustScore);
  return pool;
}

function fullCandidateList(pool: ScoredBar[], seedBestBar: readonly string[] | null): ScoredBar[] {
  const fullCandidates: ScoredBar[] = [];
  const take = Math.min(pool.length, 2);
  for (let i = 0; i < take; i++) fullCandidates.push(pool[i]!);
  if (
    seedBestBar &&
    !fullCandidates.some((c) => c.bar.join("\0") === seedBestBar.join("\0"))
  ) {
    const seedEntry = pool.find((p) => p.bar.join("\0") === seedBestBar.join("\0"));
    if (seedEntry) fullCandidates.push(seedEntry);
  }
  return fullCandidates;
}

function assembleResult(
  state: SearchState,
  opts: FinalizeOptions,
  seedBestScore: number,
  seedBestBar: readonly string[] | null,
  pool: ScoredBar[],
  rescoredFull: ScoredBar[],
): SolveResult {
  const topK = opts.topK ?? state.config.topK;
  // Rank ONLY full-horizon re-scores. Explore DPM is a different unit and must
  // not beat a true robust score in the final leaderboard.
  const fullOnly = rescoredFull.filter(isRankable).sort((a, b) => b.robustScore - a.robustScore);

  let best = fullOnly[0] ?? null;

  // If no full re-score was finite, fall back to best explore candidate (labeled via score).
  if (!best) {
    const exploreBest = pool.find(isRankable) ?? null;
    if (exploreBest) best = exploreBest;
  }

  if (!best) {
    const fallbackBar = seedBestBar ?? state.seeds[0] ?? [];
    best = {
      bar: [...fallbackBar],
      fingerprint: fallbackBar.join("\0"),
      robustScore: Number.isFinite(seedBestScore) ? seedBestScore : 0,
      minDpm: 0,
      weightedMean: 0,
      profileId: state.config.profileId ?? "balanced",
      openingDpm: 0,
      developedDpm: 0,
      steadyDpm: 0,
    };
  }

  const diversifyPool = fullOnly.length > 0 ? fullOnly : pool.filter(isRankable);
  const top = diverseSelect(diversifyPool, topK);
  if (top.length === 0) top.push(best);
  top.sort((a, b) => b.robustScore - a.robustScore);
  if (top[0]!.robustScore < best.robustScore) top[0] = best;

  const proof: ProofLabel = state.exhaustiveCompleted
    ? "globally-optimal"
    : state.budget.remaining > 0 && state.budget.used > 0
      ? "converged"
      : "best-found";

  return {
    best: { ...best, bar: [...best.bar] },
    top: top.map((t) => ({ ...t, bar: [...t.bar] })),
    proof,
    evaluationsUsed: state.budget.used,
    evaluationBudget: state.budget.total,
    exhaustiveCompleted: state.exhaustiveCompleted,
    tier: opts.tier,
    seedBestScore: Number.isFinite(seedBestScore) ? seedBestScore : Number.NEGATIVE_INFINITY,
    stats: {
      evaluations: state.budget.used,
      cacheHits: state.cache.hits,
      cacheMisses: state.cache.misses,
      uniqueBars: state.archive.length,
      elapsedMs: Date.now() - state.startedAt,
      bestScore: best.robustScore,
    },
  };
}

function rescoreFull(
  state: SearchState,
  fullCandidates: ScoredBar[],
): ScoredBar[] {
  const rescored: ScoredBar[] = [];
  for (const s of fullCandidates) {
    const full = state.forceEval(s.bar, "full", "finalize");
    if (isRankable(full)) rescored.push(full);
    else rescored.push(s);
  }
  return rescored;
}

/** Sync finalize for unit tests / pure solve(). */
export function finalizeSearch(
  state: SearchState,
  opts: FinalizeOptions,
): SolveResult {
  const { seedBestScore, seedBestBar } = pickSeedBest(state);
  const pool = buildPool(state, seedBestBar);
  const fullCandidates = fullCandidateList(pool, seedBestBar);
  const rescoredFull = rescoreFull(state, fullCandidates);
  return assembleResult(state, opts, seedBestScore, seedBestBar, pool, rescoredFull);
}

/**
 * Async finalize: yields between each full-horizon re-score so main-thread UI
 * stays responsive and progress can update.
 */
export async function finalizeSearchAsync(
  state: SearchState,
  opts: FinalizeOptions,
): Promise<SolveResult> {
  const yieldSlice = opts.yieldSlice ?? (async () => undefined);
  const { seedBestScore, seedBestBar } = await pickSeedBestAsync(state, yieldSlice);
  await yieldSlice();

  const pool = buildPool(state, seedBestBar);
  const fullCandidates = fullCandidateList(pool, seedBestBar);
  const totalSteps = fullCandidates.length;
  const rescoredFull: ScoredBar[] = [];

  for (let i = 0; i < fullCandidates.length; i++) {
    const s = fullCandidates[i]!;
    opts.onStep?.({
      done: i,
      total: Math.max(1, totalSteps),
      label: `Final scoring ${i + 1}/${Math.max(1, totalSteps)}`,
    });
    const full = state.forceEval(s.bar, "full", "finalize");
    if (isRankable(full)) rescoredFull.push(full);
    else rescoredFull.push(s);
    await yieldSlice();
  }

  opts.onStep?.({
    done: totalSteps,
    total: Math.max(1, totalSteps),
    label: "Final scoring done",
  });

  return assembleResult(state, opts, seedBestScore, seedBestBar, pool, rescoredFull);
}
