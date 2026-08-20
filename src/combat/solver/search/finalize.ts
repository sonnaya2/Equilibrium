import type { ProofLabel, ScoredBar, SolveResult, SolveStatus, SolveTier } from "../contracts";
import {
  barsEqual,
  candidateBeatsIncumbent,
  finiteFullScore,
  scoreImprovementAbsolute,
  scoreImprovementPercent,
} from "../incumbentCompare";
import { diverseSelect } from "../diversity";
import { estimateFeasibleCount } from "./exhaustive";
import { barKey } from "../fingerprint";
import { statefulCandidateBars } from "./mediumScreen";
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

function isMediumOk(s: ScoredBar | null | undefined): s is ScoredBar {
  return Boolean(
    s &&
    s.mode === "medium" &&
    !s.validForFinalRanking &&
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
 * Incumbent full eval is guaranteed outside this capacity gate (see forceEvalIncumbentFull).
 */
export function fullCandidateList(
  pool: ScoredBar[],
  state: SearchState,
  seedBestBar: readonly string[] | null,
): ScoredBar[] {
  const baseShortlistSize = Math.max(
    2,
    state.config.fullShortlistSize ?? Math.max(state.config.topK, 5),
  );
  if (pool.length === 0 && !seedBestBar && state.seeds.length === 0) return [];

  const statefulCoverage = statefulCoverageCandidates(state);
  const shortlistSize = baseShortlistSize + statefulCoverage.length;

  const selected: ScoredBar[] = [];
  const seen = new Set<string>();

  const push = (s: ScoredBar | null | undefined) => {
    if (!isSearchRankable(s)) return;
    if (seen.has(s.fingerprint)) return;
    if (selected.length >= shortlistSize) return;
    seen.add(s.fingerprint);
    selected.push(s);
  };

  // Stateful casts can lose a short-horizon race before their buff or cooldown effect pays back.
  // Give the best explored bar for each one a full-horizon score outside normal shortlist capacity.
  const ensureBar = (bar: readonly string[] | null | undefined, source: string) => {
    if (!bar || bar.length === 0 || selected.length >= shortlistSize) return;
    const fp = barKey(bar);
    if (seen.has(fp)) return;
    const fromPool = pool.find((p) => p.fingerprint === fp);
    if (fromPool) {
      push(fromPool);
      return;
    }
    push(state.forceEval(bar, "search", source));
  };

  ensureBar(seedBestBar, "seed-best-shortlist");
  for (const candidate of statefulCoverage) {
    ensureBar(candidate.bar, "stateful-coverage-shortlist");
  }

  // Medium-stage incumbents (previous winners under robust-shaped mid horizon).
  ensureBar(state.bestMedium?.bar, "medium-best-shortlist");
  const mediumArchive = state.archive
    .filter(isMediumOk)
    .sort((a, b) => b.robustScore - a.robustScore);
  for (const m of mediumArchive) {
    if (selected.length >= shortlistSize) break;
    ensureBar(m.bar, "medium-shortlist");
  }

  for (const seed of state.seeds) ensureBar(seed, "authored-seed-shortlist");

  // Fill remaining slots with diverse high exploratory scorers.
  if (selected.length < shortlistSize && pool.length > 0) {
    const diversifyFrom = pool.slice(0, Math.min(pool.length, shortlistSize * 3));
    const diverse = diverseSelect(diversifyFrom, shortlistSize);
    for (const s of diverse) push(s);
  }

  return selected;
}

function statefulCoverageCandidates(state: SearchState): ScoredBar[] {
  const statefulIds = state.pool.filter((ability) => ability.stateful).map((ability) => ability.id);
  if (statefulIds.length === 0) return [];

  const bestSearchByAbility = new Map<string, ScoredBar>();
  const bestMediumByAbility = new Map<string, ScoredBar>();
  const consider = (candidate: ScoredBar | null | undefined) => {
    if (!candidate || (!isSearchRankable(candidate) && !isMediumOk(candidate))) return;
    for (const id of statefulIds) {
      if (!candidate.bar.includes(id)) continue;
      const target = candidate.mode === "medium" ? bestMediumByAbility : bestSearchByAbility;
      const prior = target.get(id);
      if (!prior || candidate.robustScore > prior.robustScore) target.set(id, candidate);
    }
  };

  for (const candidate of state.archive) consider(candidate);
  for (const seed of state.seeds) {
    if (!statefulIds.some((id) => seed.includes(id))) continue;
    consider(state.forceEval(seed, "search", "stateful-coverage-explore"));
  }

  const unique = new Map<string, ScoredBar>();
  for (const id of statefulIds) {
    const candidate = bestMediumByAbility.get(id) ?? bestSearchByAbility.get(id);
    if (candidate) unique.set(candidate.fingerprint, candidate);
  }
  return [...unique.values()].sort((a, b) => b.robustScore - a.robustScore);
}

/** Full-horizon ranking re-score (session forceEval uses score-only detail). */
function rescoreFull(state: SearchState, fullCandidates: ScoredBar[]): ScoredBar[] {
  const rescored: ScoredBar[] = [];
  for (const s of fullCandidates) {
    const full = state.forceEval(s.bar, "full", "finalize");
    // Failed full scores stay failed - never push the exploratory candidate.
    if (isFullRankable(full)) rescored.push(full);
  }
  return rescored;
}

function bestFullAnchor(
  shortlistFull: readonly ScoredBar[],
  incumbentRaw: ScoredBar | null,
): ScoredBar | null {
  const candidates = incumbentRaw ? [...shortlistFull, incumbentRaw] : [...shortlistFull];
  return candidates.filter(isFullRankable).sort((a, b) => b.robustScore - a.robustScore)[0] ?? null;
}

function statefulRefinementIds(state: SearchState): string[] {
  return state.pool.filter((ability) => ability.stateful).map((ability) => ability.id);
}

const STATEFUL_FULL_REFINEMENT_LIMIT = 8;
const STATEFUL_REFINEMENT_PASSES = 2;

function statefulMediumShortlist(
  state: SearchState,
  anchor: ScoredBar,
  abilityId: string,
): ScoredBar[] {
  const candidates = new Map<string, ScoredBar>();
  for (const bar of statefulCandidateBars(state, anchor.bar, abilityId, true)) {
    if (barKey(bar) === anchor.fingerprint) continue;
    const medium = state.forceEval(bar, "medium", "stateful-refine-screen");
    if (!isMediumOk(medium)) continue;
    candidates.set(medium.fingerprint, medium);
  }
  return [...candidates.values()]
    .sort((a, b) => b.robustScore - a.robustScore)
    .slice(0, STATEFUL_FULL_REFINEMENT_LIMIT);
}

function refineStatefulFull(state: SearchState, initialAnchor: ScoredBar | null): ScoredBar[] {
  if (!initialAnchor || state.config.mediumHorizonTicks == null) return [];
  const refined: ScoredBar[] = [];
  let anchor = initialAnchor;
  const refinementIds = statefulRefinementIds(state);
  for (let pass = 0; pass < STATEFUL_REFINEMENT_PASSES; pass++) {
    const startingFingerprint = anchor.fingerprint;
    for (const abilityId of refinementIds) {
      for (const medium of statefulMediumShortlist(state, anchor, abilityId)) {
        const full = state.forceEval(medium.bar, "full", "stateful-refine");
        if (!isFullRankable(full)) continue;
        refined.push(full);
        if (full.robustScore > anchor.robustScore) anchor = full;
      }
    }
    if (anchor.fingerprint === startingFingerprint) break;
  }
  return refined;
}

/**
 * Always full-rescore the first-class incumbent, outside shortlist capacity.
 * Cache hit is fine when the bar already landed on the shortlist.
 * Skips candidate-policy gates (style-required inject, size band) via forceEvalIncumbent.
 */
function forceEvalIncumbentFull(state: SearchState): ScoredBar | null {
  if (!state.incumbentBar?.length) return null;
  return state.forceEvalIncumbent(state.incumbentBar, "full", "incumbent-full");
}

function mergeFullUnique(
  shortlistFull: ScoredBar[],
  incumbentScored: ScoredBar | null,
): ScoredBar[] {
  const byFp = new Map<string, ScoredBar>();
  for (const s of shortlistFull) {
    if (isFullRankable(s)) byFp.set(s.fingerprint, s);
  }
  if (incumbentScored && isFullRankable(incumbentScored)) {
    byFp.set(incumbentScored.fingerprint, incumbentScored);
  }
  return [...byFp.values()].sort((a, b) => b.robustScore - a.robustScore);
}

function chooseProof(
  state: SearchState,
  status: SolveStatus,
  fullOnly: ScoredBar[],
  feasibleCount: number,
): ProofLabel {
  // Zero full-horizon rankable winners is a failed solve.
  // Exploratory scores stay in bestExploratoryScore only - never as proof fallback.
  // Incumbent-only ok still uses normal labels when any full rankable exists.
  if (status === "failed" || fullOnly.length === 0) return "failed";

  // True full-objective global optimum: every feasible bar has a successful
  // full-horizon rankable score (not mere attempts, not shortlist size proxy).
  const fullCover =
    state.exhaustiveCompleted &&
    Number.isFinite(feasibleCount) &&
    feasibleCount > 0 &&
    state.fullSuccessFingerprints.size >= feasibleCount &&
    fullOnly.length > 0;

  if (fullCover) return "full-objective-global-optimum";

  // Exhaustive short-horizon search never proves full-objective global optimum.
  return state.exhaustiveCompleted ? "full-shortlist-best" : "heuristic-best-found";
}

function assembleResult(
  state: SearchState,
  opts: FinalizeOptions,
  seedBestScore: number,
  seedBestBar: readonly string[] | null,
  explorePool: ScoredBar[],
  shortlistFull: ScoredBar[],
  incumbentRaw: ScoredBar | null,
): SolveResult {
  const topK = opts.topK ?? state.config.topK;

  const incumbentScored = isFullRankable(incumbentRaw) ? incumbentRaw : null;
  const incumbentScore = incumbentScored ? incumbentScored.robustScore : Number.NEGATIVE_INFINITY;

  const rankedFull = mergeFullUnique(shortlistFull, incumbentScored);
  // Proposed: best full-rankable among shortlist + other full candidates (inc. incumbent).
  const proposed = rankedFull[0] ?? null;

  let best: ScoredBar | null = null;
  let status: SolveStatus = "failed";
  let isUpgrade = false;
  let validForApply = false;

  const proposedBeats =
    proposed != null &&
    candidateBeatsIncumbent(proposed.robustScore, incumbentScore) &&
    !barsEqual(proposed.bar, state.incumbentBar);

  if (proposedBeats) {
    best = proposed;
    status = "ok";
    isUpgrade = true;
    validForApply = true;
  } else if (incumbentScored) {
    // Current bar remains best - validated full score to report; Apply stays off.
    best = incumbentScored;
    status = "ok";
    isUpgrade = false;
    validForApply = false;
  } else if (proposed != null) {
    // Full-rankable proposed, no rankable incumbent (candidateBeatsIncumbent is true).
    best = proposed;
    status = "ok";
    isUpgrade = true;
    validForApply = true;
  }

  // No fabricated empty-bar / zero-score winner. top is full-rankable only.
  const top = rankedFull.length > 0 ? diverseSelect(rankedFull, topK) : [];

  if (rankedFull.length > 0 && best && top.length > 0) {
    top.sort((a, b) => b.robustScore - a.robustScore);
    const bestFp = best.fingerprint;
    const idx = top.findIndex((t) => t.fingerprint === bestFp);
    if (idx < 0) {
      top.unshift(best);
      if (top.length > topK) top.length = topK;
    } else if (top[0]!.robustScore < best.robustScore) {
      top[0] = best;
    }
  }

  const feasibleCount = estimateFeasibleCount(state.pool, state.sizeBounds);
  const proof = chooseProof(state, status, rankedFull, feasibleCount);

  // Debug / progress only - never applied as the solved bar.
  void explorePool;
  void seedBestBar;
  const bestExploratoryScore =
    state.bestExploratory?.robustScore ??
    (isSearchRankable(explorePool[0]) ? explorePool[0].robustScore : seedBestScore);
  const bestFullScore =
    state.bestFull?.robustScore ?? rankedFull[0]?.robustScore ?? Number.NEGATIVE_INFINITY;

  const winnerScore = best ? best.robustScore : Number.NEGATIVE_INFINITY;
  const scoreImprovement = scoreImprovementAbsolute(winnerScore, incumbentScore, isUpgrade);
  const percentImprovement = scoreImprovementPercent(winnerScore, incumbentScore, isUpgrade);

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
    incumbentBar: state.incumbentBar?.length ? [...state.incumbentBar] : null,
    incumbentScore: finiteFullScore(incumbentScore),
    isUpgrade,
    scoreImprovement,
    percentImprovement,
    validForApply,
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
  const shortlistFull = rescoreFull(state, fullCandidates);
  // Outside shortlist capacity: always full-eval incumbent (cache hit OK).
  const incumbentRaw = forceEvalIncumbentFull(state);
  shortlistFull.push(...refineStatefulFull(state, bestFullAnchor(shortlistFull, incumbentRaw)));
  return assembleResult(
    state,
    opts,
    seedBestScore,
    seedBestBar,
    explorePool,
    shortlistFull,
    incumbentRaw,
  );
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
  // +1 when incumbent is present so progress includes the guaranteed full eval.
  const hasIncumbent = Boolean(state.incumbentBar?.length);
  const totalSteps = fullCandidates.length + (hasIncumbent ? 1 : 0);
  const shortlistFull: ScoredBar[] = [];

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
    // Ranking score-only full horizon; presentation re-sim is post-rank.
    const full = state.forceEval(s.bar, "full", "finalize");
    if (isFullRankable(full)) shortlistFull.push(full);
    opts.onStep?.({
      done: i + 1,
      total: Math.max(1, totalSteps),
      label: `${i + 1}/${Math.max(1, totalSteps)}`,
      bar: s.bar,
    });
    await yieldSlice();
  }

  // Guaranteed full-eval of first-class incumbent (outside shortlist capacity).
  let incumbentRaw: ScoredBar | null = null;
  if (hasIncumbent) {
    throwIfCancelled();
    const step = fullCandidates.length;
    opts.onStep?.({
      done: step,
      total: Math.max(1, totalSteps),
      label: `${step + 1}/${Math.max(1, totalSteps)}`,
      bar: state.incumbentBar!,
    });
    await yieldSlice();
    throwIfCancelled();
    incumbentRaw = forceEvalIncumbentFull(state);
    opts.onStep?.({
      done: step + 1,
      total: Math.max(1, totalSteps),
      label: `${step + 1}/${Math.max(1, totalSteps)}`,
      bar: state.incumbentBar!,
    });
    await yieldSlice();
  }

  let refinementAnchor = bestFullAnchor(shortlistFull, incumbentRaw);
  const refinementIds =
    refinementAnchor && state.config.mediumHorizonTicks != null ? statefulRefinementIds(state) : [];
  const refinementCapacity =
    refinementIds.length * STATEFUL_FULL_REFINEMENT_LIMIT * STATEFUL_REFINEMENT_PASSES;
  const finalTotalSteps = totalSteps + refinementCapacity;
  let refinementDone = 0;
  for (let pass = 0; pass < STATEFUL_REFINEMENT_PASSES && refinementAnchor; pass++) {
    const startingFingerprint = refinementAnchor.fingerprint;
    for (let i = 0; i < refinementIds.length && refinementAnchor; i++) {
      throwIfCancelled();
      const abilityId = refinementIds[i]!;
      const candidates = new Map<string, ScoredBar>();
      for (const bar of statefulCandidateBars(state, refinementAnchor.bar, abilityId, true)) {
        if (barKey(bar) === refinementAnchor.fingerprint) continue;
        throwIfCancelled();
        const medium = state.forceEval(bar, "medium", "stateful-refine-screen");
        if (isMediumOk(medium)) candidates.set(medium.fingerprint, medium);
        await yieldSlice();
      }
      const mediumShortlist = [...candidates.values()]
        .sort((a, b) => b.robustScore - a.robustScore)
        .slice(0, STATEFUL_FULL_REFINEMENT_LIMIT);

      for (const medium of mediumShortlist) {
        throwIfCancelled();
        const step = totalSteps + refinementDone;
        opts.onStep?.({
          done: step,
          total: Math.max(1, finalTotalSteps),
          label: `Stateful ${pass + 1}.${i + 1}`,
          bar: medium.bar,
        });
        await yieldSlice();
        throwIfCancelled();
        const full = state.forceEval(medium.bar, "full", "stateful-refine");
        if (isFullRankable(full)) {
          shortlistFull.push(full);
          if (full.robustScore > refinementAnchor.robustScore) refinementAnchor = full;
        }
        refinementDone++;
        opts.onStep?.({
          done: totalSteps + refinementDone,
          total: Math.max(1, finalTotalSteps),
          label: `Stateful ${pass + 1}.${i + 1}`,
          bar: medium.bar,
        });
        await yieldSlice();
      }
    }
    if (refinementAnchor.fingerprint === startingFingerprint) break;
  }

  throwIfCancelled();
  opts.onStep?.({
    done: finalTotalSteps,
    total: Math.max(1, finalTotalSteps),
    label: "Done",
  });

  return assembleResult(
    state,
    opts,
    seedBestScore,
    seedBestBar,
    explorePool,
    shortlistFull,
    incumbentRaw,
  );
}
