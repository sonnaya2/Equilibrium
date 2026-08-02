import type { ProofLabel, ScoredBar, SolveResult, SolveTier } from "../contracts";
import { diverseSelect } from "../diversity";
import type { SearchState } from "./types";

export interface FinalizeOptions {
  tier: SolveTier;
  topK?: number;
}

/**
 * Re-evaluate finalists at full horizon, force seed evaluation, enforce
 * baseline guarantee (best >= best seed), diverse top-k, proof label.
 */
export function finalizeSearch(state: SearchState, opts: FinalizeOptions): SolveResult {
  const topK = opts.topK ?? state.config.topK;

  let seedBestScore = Number.NEGATIVE_INFINITY;
  for (const seed of state.seeds) {
    const scored = state.forceEval(seed, "full", "seed-final");
    if (scored && Number.isFinite(scored.robustScore)) {
      seedBestScore = Math.max(seedBestScore, scored.robustScore);
    }
  }

  const pool: ScoredBar[] = [];
  const seen = new Set<string>();
  const add = (s: ScoredBar | null | undefined) => {
    if (!s || !Number.isFinite(s.robustScore)) return;
    if (seen.has(s.fingerprint)) return;
    seen.add(s.fingerprint);
    pool.push(s);
  };
  add(state.best);
  for (const a of state.archive) add(a);

  pool.sort((a, b) => b.robustScore - a.robustScore);
  const reevalLimit = Math.min(pool.length, Math.max(topK * 3, 12));
  const rescored: ScoredBar[] = [];
  for (let i = 0; i < reevalLimit; i++) {
    const s = pool[i]!;
    const full = state.forceEval(s.bar, "full", "finalize");
    if (full && Number.isFinite(full.robustScore)) rescored.push(full);
    else rescored.push(s);
  }
  for (let i = reevalLimit; i < pool.length; i++) rescored.push(pool[i]!);
  rescored.sort((a, b) => b.robustScore - a.robustScore);

  let best = rescored[0] ?? state.best;
  if (
    !best ||
    (Number.isFinite(seedBestScore) &&
      seedBestScore > Number.NEGATIVE_INFINITY &&
      best.robustScore < seedBestScore)
  ) {
    for (const seed of state.seeds) {
      const s = state.forceEval(seed, "full", "seed-baseline");
      if (s && s.robustScore >= seedBestScore) {
        best = s;
        break;
      }
    }
  }

  if (!best) {
    best = {
      bar: [],
      fingerprint: "",
      robustScore: Number.NEGATIVE_INFINITY,
      minDpm: 0,
      weightedMean: 0,
      profileId: state.config.profileId ?? "balanced",
      openingDpm: 0,
      developedDpm: 0,
      steadyDpm: 0,
    };
  }

  if (!rescored.some((r) => r.fingerprint === best!.fingerprint)) {
    rescored.unshift(best);
  }

  const top = diverseSelect(rescored, topK);
  if (top.length === 0) top.push(best);
  top.sort((a, b) => b.robustScore - a.robustScore);
  if (top[0]!.robustScore < best.robustScore) top[0] = best;

  // globally-optimal only if exhaustive completed the full tree.
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
