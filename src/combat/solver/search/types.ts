import { EvalCache } from "../cache";
import type {
  EvaluateFn,
  EvalMode,
  EvalResult,
  PoolAbility,
  ScoredBar,
  ScoreEvalMode,
  SizeBounds,
  SolveTier,
} from "../contracts";
import { OBJECTIVE_VERSION } from "../contracts";
import { indexPool } from "../candidatePool";
import { canAdd } from "../eligibility";
import { fingerprintBar } from "../fingerprint";
import { isFiniteEval } from "../objective";
import type { Rng } from "../rng";
import { createRng } from "../rng";

export interface SearchConfig {
  tier: SolveTier;
  evaluationBudget: number;
  beamWidth: number;
  beamInsertAllPositions: boolean;
  evoPopulation: number;
  evoGenerations: number;
  evoElite: number;
  lnsRounds: number;
  lnsDestroyK: number;
  annealSteps: number;
  localIterations: number;
  topK: number;
  /** How many diverse search candidates to full-rescore (default: max(topK, 5)). */
  fullShortlistSize?: number;
  seed: number;
  exhaustiveMax: number;
  profileId?: ScoredBar["profileId"];
  /** Horizon ticks used for search evaluations (for score tags). */
  searchHorizonTicks?: number;
  /** Horizon ticks used for full evaluations. */
  fullHorizonTicks?: number;
}

export interface SearchState {
  pool: readonly PoolAbility[];
  byId: ReadonlyMap<string, PoolAbility>;
  sizeBounds: SizeBounds;
  evaluate: EvaluateFn;
  rng: Rng;
  config: SearchConfig;
  budget: { remaining: number; used: number; total: number };
  /** Mode-keyed eval cache: search and full never share entries. */
  cache: EvalCache<{ score: number; scored: ScoredBar }>;
  searchCacheHits: number;
  fullCacheHits: number;
  searchEvaluations: number;
  fullEvaluations: number;
  /**
   * Distinct bar fingerprints that received a full-horizon evaluation attempt
   * (success or failure). Diagnostic / coverage of work performed.
   */
  fullEvaluatedFingerprints: Set<string>;
  /**
   * Distinct bar fingerprints with a valid full-horizon rankable score.
   * full-objective-global-optimum requires this set to cover every feasible bar.
   */
  fullSuccessFingerprints: Set<string>;
  /** Best exploratory (search-mode) score only. */
  best: ScoredBar | null;
  bestExploratory: ScoredBar | null;
  bestFull: ScoredBar | null;
  /** Archive entries preserve mode; mixed-scale ranking is forbidden. */
  archive: ScoredBar[];
  seeds: string[][];
  exhaustiveCompleted: boolean;
  startedAt: number;
  tryEval(bar: readonly string[], mode?: EvalMode, source?: string): ScoredBar | null;
  forceEval(bar: readonly string[], mode?: EvalMode, source?: string): ScoredBar | null;
  canEval(): boolean;
}

const ARCHIVE_CAP = 256;

export function normalizeEvalMode(mode: EvalMode | undefined): ScoreEvalMode {
  if (mode === "full" || mode === "finalize") return "full";
  return "search";
}

export function cacheKeyFor(mode: ScoreEvalMode, fingerprint: string): string {
  return `m=${mode}|ov=${OBJECTIVE_VERSION}|${fingerprint}`;
}

export function createSearchState(opts: {
  pool: readonly PoolAbility[];
  sizeBounds: SizeBounds;
  evaluate: EvaluateFn;
  config: SearchConfig;
  seeds?: readonly (readonly string[])[];
}): SearchState {
  const byId = indexPool(opts.pool);
  const cache = new EvalCache<{ score: number; scored: ScoredBar }>(8_192);
  const state: SearchState = {
    pool: opts.pool,
    byId,
    sizeBounds: opts.sizeBounds,
    evaluate: opts.evaluate,
    rng: createRng(opts.config.seed),
    config: opts.config,
    budget: {
      remaining: opts.config.evaluationBudget,
      used: 0,
      total: opts.config.evaluationBudget,
    },
    cache,
    searchCacheHits: 0,
    fullCacheHits: 0,
    searchEvaluations: 0,
    fullEvaluations: 0,
    fullEvaluatedFingerprints: new Set<string>(),
    fullSuccessFingerprints: new Set<string>(),
    best: null,
    bestExploratory: null,
    bestFull: null,
    archive: [],
    seeds: (opts.seeds ?? []).map((s) => [...s]),
    exhaustiveCompleted: false,
    startedAt: Date.now(),
    canEval() {
      return state.budget.remaining > 0;
    },
    tryEval(bar, mode = "search", source) {
      return evalBar(state, bar, mode, source, false);
    },
    forceEval(bar, mode = "search", source) {
      return evalBar(state, bar, mode, source, true);
    },
  };
  return state;
}

function evalBar(
  state: SearchState,
  bar: readonly string[],
  mode: EvalMode,
  source: string | undefined,
  force: boolean,
): ScoredBar | null {
  if (!force && state.budget.remaining <= 0) return null;
  if (bar.length < state.sizeBounds.min || bar.length > state.sizeBounds.max) return null;
  for (let i = 0; i < bar.length; i++) {
    if (!canAdd(bar.slice(0, i), bar[i]!, state.byId)) return null;
  }

  const scoreMode = normalizeEvalMode(mode);
  const fp = fingerprintBar(bar);
  const cacheKey = cacheKeyFor(scoreMode, fp);
  const cached = state.cache.get(cacheKey);
  if (cached) {
    if (scoreMode === "search") state.searchCacheHits += 1;
    else {
      state.fullCacheHits += 1;
      state.fullEvaluatedFingerprints.add(fp);
      if (cached.scored.validForFinalRanking) state.fullSuccessFingerprints.add(fp);
    }
    // Cache hit: update mode-specific best only; full never mutates search best.
    if (scoreMode === "search") touchSearchBest(state, cached.scored);
    else touchFullBest(state, cached.scored);
    return cached.scored;
  }

  if (state.budget.remaining <= 0 && !force) return null;
  if (state.budget.remaining > 0) {
    state.budget.remaining -= 1;
    state.budget.used += 1;
  } else if (force) {
    // Forced finalize evals count toward total but not the search budget remainder.
    state.budget.used += 1;
  } else {
    return null;
  }

  if (scoreMode === "search") state.searchEvaluations += 1;
  else {
    state.fullEvaluations += 1;
    // Count every full-horizon attempt (including failures) for global-optimum proof.
    state.fullEvaluatedFingerprints.add(fp);
  }

  const result = state.evaluate({ bar, mode });
  if (result.finite === false) {
    // Do not cache failures as rankable bars (would pollute beam/local).
    return null;
  }
  const scored = toScoredBar(bar, result, state.config, scoreMode, source);
  if (!isFiniteEval({ score: scored.robustScore })) {
    return null;
  }

  state.cache.set(cacheKey, { score: scored.robustScore, scored });

  if (scoreMode === "search") {
    touchSearchBest(state, scored);
    pushArchive(state, scored);
  } else {
    // Full results never update search best (scale mismatch).
    if (scored.validForFinalRanking) state.fullSuccessFingerprints.add(fp);
    touchFullBest(state, scored);
    pushArchive(state, scored);
  }
  return scored;
}

export function toScoredBar(
  bar: readonly string[],
  result: EvalResult,
  config: SearchConfig,
  mode: ScoreEvalMode,
  source?: string,
): ScoredBar {
  const profileId = config.profileId ?? "balanced";
  const horizonTicks =
    result.horizonTicks ??
    (mode === "full" ? (config.fullHorizonTicks ?? 500) : (config.searchHorizonTicks ?? 50));
  const obj = result.objective;

  if (obj && "ok" in obj && obj.ok === false) {
    return {
      bar: [...bar],
      fingerprint: fingerprintBar(bar),
      minDpm: 0,
      weightedMean: 0,
      robustScore: Number.NEGATIVE_INFINITY,
      score: Number.NEGATIVE_INFINITY,
      profileId,
      mode,
      objectiveType: profileId,
      horizonTicks,
      exploratory: mode === "search",
      validForFinalRanking: false,
      failureReason: obj.reason,
      openingDpm: 0,
      developedDpm: 0,
      steadyDpm: 0,
      source,
    };
  }

  if (obj && obj.ok === true && typeof obj.robustScore === "number") {
    const robustScore = obj.robustScore;
    const fullRankable = mode === "full" && result.validForFinalRanking !== false;
    return {
      bar: [...bar],
      fingerprint: fingerprintBar(bar),
      minDpm: obj.minDpm,
      weightedMean: obj.weightedMean,
      robustScore,
      score: robustScore,
      profileId: obj.profileId ?? profileId,
      mode,
      objectiveType: obj.profileId ?? profileId,
      horizonTicks,
      exploratory: mode === "search" || result.exploratory === true,
      validForFinalRanking: fullRankable && Number.isFinite(robustScore),
      openingDpm: obj.openingDpm,
      developedDpm: obj.developedDpm,
      steadyDpm: obj.steadyDpm,
      source,
    };
  }

  // Scalar score without a robust objective object.
  // Do not invent opening/developed/steady windows. Mock evaluators that only
  // return `{ score }` on full mode are treated as rankable full scores so unit
  // tests can exercise finalize; production evaluate always sets flags.
  const score = result.score;
  const exploratory = result.exploratory !== undefined ? result.exploratory : mode === "search";
  const validForFinalRanking =
    result.validForFinalRanking !== undefined
      ? result.validForFinalRanking
      : mode === "full" && Number.isFinite(score);
  return {
    bar: [...bar],
    fingerprint: fingerprintBar(bar),
    minDpm: score,
    weightedMean: score,
    robustScore: score,
    score,
    profileId,
    mode,
    objectiveType: profileId,
    horizonTicks,
    exploratory,
    validForFinalRanking,
    failureReason: result.failureReason,
    openingDpm: 0,
    developedDpm: 0,
    steadyDpm: 0,
    source,
  };
}

function touchSearchBest(state: SearchState, scored: ScoredBar): void {
  if (scored.mode !== "search") return;
  if (!Number.isFinite(scored.robustScore)) return;
  if (!state.bestExploratory || scored.robustScore > state.bestExploratory.robustScore) {
    const copy = cloneScored(scored);
    state.bestExploratory = copy;
    state.best = copy;
  }
}

function touchFullBest(state: SearchState, scored: ScoredBar): void {
  if (scored.mode !== "full") return;
  if (!scored.validForFinalRanking) return;
  if (!Number.isFinite(scored.robustScore)) return;
  if (!state.bestFull || scored.robustScore > state.bestFull.robustScore) {
    state.bestFull = cloneScored(scored);
  }
}

function pushArchive(state: SearchState, scored: ScoredBar): void {
  if (!Number.isFinite(scored.robustScore)) return;
  // Coexist: same fingerprint may have both search and full entries.
  const key = `${scored.mode}:${scored.fingerprint}`;
  if (state.archive.some((a) => `${a.mode}:${a.fingerprint}` === key)) return;
  state.archive.push(cloneScored(scored));
  if (state.archive.length > ARCHIVE_CAP) {
    // Trim lowest search scores first; keep all valid full entries when possible.
    state.archive.sort((a, b) => {
      if (a.mode !== b.mode) return a.mode === "full" ? -1 : 1;
      return b.robustScore - a.robustScore;
    });
    state.archive.length = ARCHIVE_CAP;
  }
}

function cloneScored(scored: ScoredBar): ScoredBar {
  return { ...scored, bar: [...scored.bar] };
}

export function compareScored(a: ScoredBar, b: ScoredBar): number {
  if (a.mode !== b.mode) {
    // Full ranks above search only when both claim final ranking; never mix scales.
    if (a.validForFinalRanking !== b.validForFinalRanking) {
      return a.validForFinalRanking ? -1 : 1;
    }
  }
  if (a.robustScore !== b.robustScore) return b.robustScore - a.robustScore;
  if (a.bar.length !== b.bar.length) return a.bar.length - b.bar.length;
  return a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0;
}

export function swapAt(bar: readonly string[], i: number, j: number): string[] {
  const next = bar.slice();
  const t = next[i]!;
  next[i] = next[j]!;
  next[j] = t;
  return next;
}

export function moveAt(bar: readonly string[], from: number, to: number): string[] {
  if (from === to) return bar.slice();
  const next = bar.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function insertAt(bar: readonly string[], index: number, id: string): string[] {
  const next = bar.slice();
  next.splice(index, 0, id);
  return next;
}

export function removeAt(bar: readonly string[], index: number): string[] {
  const next = bar.slice();
  next.splice(index, 1);
  return next;
}

export function replaceAt(bar: readonly string[], index: number, id: string): string[] {
  const next = bar.slice();
  next[index] = id;
  return next;
}
