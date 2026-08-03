import type { ProofLabel, ScoredBar, SolveResult, SolveStatus, SolveTier } from "../contracts";
import { diverseSelect } from "../diversity";
import { estimateFeasibleCount } from "./exhaustive";
import type { SearchState } from "./types";

export interface FinalizeOptions {
  tier: SolveTier;
  topK?: number;
  /** Yield between expensive full-horizon re-scores so the UI can paint. */
  yieldSlice?: () => Promise<void>;
  /** Cooperative cancel - checked before each full re-score (not mid-sim). */
  isCancelled?: () => boolean;
  onStep?: (info: {
    done: number;
    total: number;
    label: string;
    /** Bar about to be / just scored under full horizon. */
    bar?: readonly string[];
  }) => void;
}

function isSearchRankable(s: ScoredBar | null | undefined): s is ScoredBar {
  return Boolean(s && s.mode === "search" && Number.isFinite(s.robustScore) && s.bar.length > 0);
}

function isFullRankable(s: ScoredBar | null | undefined): s is ScoredBar {
  return Boolean(
    s &&
    s.mode === "full" &&
    s.validForFinalRanking &&
    Number.isFinite(s.robustScore) &&
    s.bar.length > 0,
  );
}

function pickSeedBest(state: SearchState): {
  seedBestScore: number;
  seedBestBar: readonly string[] | null;
} {
  let seedBestScore = Number.NEGATIVE_INFINITY;
  let seedBestBar: readonly string[] | null = null;
  for (const seed of state.seeds) {
    const explore = state.forceEval(seed, "search", "seed-baseline-explore");
    if (isSearchRankable(explore) && explore.robustScore > seedBestScore) {
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
    if (isSearchRankable(explore) && explore.robustScore > seedBestScore) {
      seedBestScore = explore.robustScore;
      seedBestBar = explore.bar;
    }
    if (i + 1 < state.seeds.length) await yieldSlice();
  }
  return { seedBestScore, seedBestBar };
}

/** Exploratory candidates only - full archive entries never seed the shortlist rank. */
function buildExplorePool(state: SearchState, seedBestBar: readonly string[] | null): ScoredBar[] {
  const pool: ScoredBar[] = [];
  const seen = new Set<string>();
  const add = (s: ScoredBar | null | undefined) => {
    if (!isSearchRankable(s)) return;
    if (seen.has(s.fingerprint)) return;
    seen.add(s.fingerprint);
    pool.push(s);
  };
  add(state.bestExploratory ?? state.best);
  for (const a of state.archive) {
    if (a.mode === "search") add(a);
  }
  if (seedBestBar) add(state.forceEval(seedBestBar, "search", "seed-in-pool"));
  pool.sort((a, b) => b.robustScore - a.robustScore);
  return pool;
}

/**
 * Diverse full shortlist: score rank + composition + order + authored seeds + user bar.
 * Configurable size (not a hardcoded top-two). Hard-capped so full rescoring stays bounded.
 */
export function fullCandidateList(
  pool: ScoredBar[],
  state: SearchState,
  seedBestBar: readonly string[] | null,
): ScoredBar[] {
  const shortlistSize = Math.max(
    2,
    state.config.fullShortlistSize ?? Math.max(state.config.topK, 5),
  );
  if (pool.length === 0 && !seedBestBar && state.seeds.length === 0) return [];

  const selected: ScoredBar[] = [];
  const seen = new Set<string>();

  const push = (s: ScoredBar | null | undefined) => {
    if (!isSearchRankable(s)) return;
    if (seen.has(s.fingerprint)) return;
    if (selected.length >= shortlistSize) return;
    seen.add(s.fingerprint);
    selected.push(s);
  };

  // Priority: seed best + authored seeds (distinct composition), then diverse top scorers.
  const ensureBar = (bar: readonly string[] | null | undefined, source: string) => {
    if (!bar || bar.length === 0 || selected.length >= shortlistSize) return;
    const fp = bar.join("\0");
    if (seen.has(fp)) return;
    const fromPool = pool.find((p) => p.fingerprint === fp);
    if (fromPool) {
      push(fromPool);
      return;
    }
    push(state.forceEval(bar, "search", source));
  };

  ensureBar(seedBestBar, "seed-best-shortlist");
  for (const seed of state.seeds) ensureBar(seed, "authored-seed-shortlist");

  // Fill remaining slots with diverse high exploratory scorers.
  if (selected.length < shortlistSize && pool.length > 0) {
    const diversifyFrom = pool.slice(0, Math.min(pool.length, shortlistSize * 3));
    const diverse = diverseSelect(diversifyFrom, shortlistSize);
    for (const s of diverse) push(s);
  }

  return selected;
}

function rescoreFull(state: SearchState, fullCandidates: ScoredBar[]): ScoredBar[] {
  const rescored: ScoredBar[] = [];
  for (const s of fullCandidates) {
    const full = state.forceEval(s.bar, "full", "finalize");
    // Failed full scores stay failed - never push the exploratory candidate.
    if (isFullRankable(full)) rescored.push(full);
  }
  return rescored;
}

function chooseProof(
  state: SearchState,
  status: SolveStatus,
  fullOnly: ScoredBar[],
  feasibleCount: number,
): ProofLabel {
  if (status === "failed") return "failed";
  if (status === "degraded") return "degraded-exploratory-fallback";

  // True full-objective global optimum: every feasible bar has a successful
  // full-horizon rankable score (not mere attempts, not shortlist size proxy).
  const fullCover =
    state.exhaustiveCompleted &&
    Number.isFinite(feasibleCount) &&
    feasibleCount > 0 &&
    state.fullSuccessFingerprints.size >= feasibleCount &&
    fullOnly.length > 0;

  if (fullCover) return "full-objective-global-optimum";

  if (fullOnly.length > 0) {
    // Exhaustive short-horizon search never proves full-objective global optimum.
    return state.exhaustiveCompleted ? "full-shortlist-best" : "heuristic-best-found";
  }

  if (state.exhaustiveCompleted) return "search-objective-exhaustive";

  if (state.budget.remaining > 0 && state.budget.used > 0) return "budget-not-exhausted";
  if (state.budget.remaining <= 0) return "stopped-early";
  return "heuristic-complete";
}

function assembleResult(
  state: SearchState,
  opts: FinalizeOptions,
  seedBestScore: number,
  seedBestBar: readonly string[] | null,
  explorePool: ScoredBar[],
  fullOnly: ScoredBar[],
): SolveResult {
  const topK = opts.topK ?? state.config.topK;
  const rankedFull = [...fullOnly].sort((a, b) => b.robustScore - a.robustScore);

  let best: ScoredBar | null = rankedFull[0] ?? null;
  let status: SolveStatus = best ? "ok" : "failed";

  // Explicit degraded fallback only - never pretend it is a full robust winner.
  if (!best) {
    const exploreBest =
      explorePool.find(isSearchRankable) ??
      (isSearchRankable(state.bestExploratory) ? state.bestExploratory : null);
    if (exploreBest) {
      best = {
        ...exploreBest,
        bar: [...exploreBest.bar],
        validForFinalRanking: false,
        exploratory: true,
        mode: "search",
        failureReason: exploreBest.failureReason ?? "full rescoring produced no valid robust score",
      };
      status = "degraded";
    }
  }

  // No fabricated empty-bar / zero-score winner.
  const top =
    rankedFull.length > 0
      ? diverseSelect(rankedFull, topK)
      : status === "degraded" && best
        ? [best]
        : [];

  if (rankedFull.length > 0 && best && top.length > 0) {
    top.sort((a, b) => b.robustScore - a.robustScore);
    if (top[0]!.robustScore < best.robustScore) top[0] = best;
  }

  const feasibleCount = estimateFeasibleCount(state.pool, state.sizeBounds);
  const proof = chooseProof(state, status, rankedFull, feasibleCount);

  const bestExploratoryScore = state.bestExploratory?.robustScore ?? seedBestScore;
  const bestFullScore =
    state.bestFull?.robustScore ?? rankedFull[0]?.robustScore ?? Number.NEGATIVE_INFINITY;

  const searchEvaluations = state.searchEvaluations;
  const fullEvaluations = state.fullEvaluations;
  const totalEvaluations = state.budget.used;

  return {
    status,
    best: best ? { ...best, bar: [...best.bar] } : null,
    top: top.map((t) => ({ ...t, bar: [...t.bar] })),
    proof,
    searchEvaluations,
    fullEvaluations,
    totalEvaluations,
    searchBudget: state.budget.total,
    evaluationsUsed: totalEvaluations,
    evaluationBudget: state.budget.total,
    exhaustiveCompleted: state.exhaustiveCompleted,
    tier: opts.tier,
    seedBestScore: Number.isFinite(seedBestScore) ? seedBestScore : Number.NEGATIVE_INFINITY,
    bestExploratoryScore: Number.isFinite(bestExploratoryScore)
      ? bestExploratoryScore
      : Number.NEGATIVE_INFINITY,
    bestFullScore: Number.isFinite(bestFullScore) ? bestFullScore : Number.NEGATIVE_INFINITY,
    validFullCandidateCount: rankedFull.length,
    stats: {
      evaluations: totalEvaluations,
      searchEvaluations,
      fullEvaluations,
      cacheHits: state.cache.hits,
      cacheMisses: state.cache.misses,
      searchCacheHits: state.searchCacheHits,
      fullCacheHits: state.fullCacheHits,
      uniqueBars: new Set(state.archive.map((a) => a.fingerprint)).size,
      elapsedMs: Date.now() - state.startedAt,
      bestExploratoryScore: Number.isFinite(bestExploratoryScore)
        ? bestExploratoryScore
        : undefined,
      bestFullScore: Number.isFinite(bestFullScore) ? bestFullScore : undefined,
      // Never mix scales into a single bestScore - leave unset when both exist.
      bestScore: undefined,
    },
  };
}

/** Sync finalize for unit tests / pure solve(). */
export function finalizeSearch(state: SearchState, opts: FinalizeOptions): SolveResult {
  const { seedBestScore, seedBestBar } = pickSeedBest(state);
  const explorePool = buildExplorePool(state, seedBestBar);
  const fullCandidates = fullCandidateList(explorePool, state, seedBestBar);
  const fullOnly = rescoreFull(state, fullCandidates);
  return assembleResult(state, opts, seedBestScore, seedBestBar, explorePool, fullOnly);
}

/**
 * Async finalize: yields before/after each full-horizon re-score so cancel and
 * UI paint can run. One full-horizon sim is still synchronous (cannot mid-kill
 * without terminating the worker); cancel is observed between candidates.
 */
export async function finalizeSearchAsync(
  state: SearchState,
  opts: FinalizeOptions,
): Promise<SolveResult> {
  const yieldSlice = opts.yieldSlice ?? (async () => undefined);
  const throwIfCancelled = () => {
    if (opts.isCancelled?.()) {
      const err = new Error("solver cancelled");
      err.name = "AbortError";
      throw err;
    }
  };

  throwIfCancelled();
  const { seedBestScore, seedBestBar } = await pickSeedBestAsync(state, yieldSlice);
  throwIfCancelled();
  await yieldSlice();
  throwIfCancelled();

  const explorePool = buildExplorePool(state, seedBestBar);
  const fullCandidates = fullCandidateList(explorePool, state, seedBestBar);
  const totalSteps = fullCandidates.length;
  const fullOnly: ScoredBar[] = [];

  for (let i = 0; i < fullCandidates.length; i++) {
    throwIfCancelled();
    const s = fullCandidates[i]!;
    opts.onStep?.({
      done: i,
      total: Math.max(1, totalSteps),
      label: `${i + 1}/${Math.max(1, totalSteps)}`,
      bar: s.bar,
    });
    // Yield *before* the heavy sim so a pending cancel is observed without
    // starting another 300s-window evaluation.
    await yieldSlice();
    throwIfCancelled();
    const full = state.forceEval(s.bar, "full", "finalize");
    if (isFullRankable(full)) fullOnly.push(full);
    opts.onStep?.({
      done: i + 1,
      total: Math.max(1, totalSteps),
      label: `${i + 1}/${Math.max(1, totalSteps)}`,
      bar: s.bar,
    });
    await yieldSlice();
  }

  throwIfCancelled();
  opts.onStep?.({
    done: totalSteps,
    total: Math.max(1, totalSteps),
    label: "Done",
  });

  return assembleResult(state, opts, seedBestScore, seedBestBar, explorePool, fullOnly);
}
