import { EvalCache } from "../cache";
import type {
  EvaluateFn,
  EvalMode,
  PoolAbility,
  ScoredBar,
  SizeBounds,
  SolveTier,
} from "../contracts";
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
  seed: number;
  exhaustiveMax: number;
  profileId?: ScoredBar["profileId"];
}

export interface SearchState {
  pool: readonly PoolAbility[];
  byId: ReadonlyMap<string, PoolAbility>;
  sizeBounds: SizeBounds;
  evaluate: EvaluateFn;
  rng: Rng;
  config: SearchConfig;
  budget: { remaining: number; used: number; total: number };
  cache: EvalCache<{ score: number; scored: ScoredBar }>;
  best: ScoredBar | null;
  archive: ScoredBar[];
  seeds: string[][];
  exhaustiveCompleted: boolean;
  startedAt: number;
  tryEval(bar: readonly string[], mode?: EvalMode, source?: string): ScoredBar | null;
  forceEval(bar: readonly string[], mode?: EvalMode, source?: string): ScoredBar | null;
  canEval(): boolean;
}

const ARCHIVE_CAP = 256;

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
    best: null,
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
  _source: string | undefined,
  force: boolean,
): ScoredBar | null {
  if (!force && state.budget.remaining <= 0) return null;
  if (bar.length < state.sizeBounds.min || bar.length > state.sizeBounds.max) return null;
  for (let i = 0; i < bar.length; i++) {
    if (!canAdd(bar.slice(0, i), bar[i]!, state.byId)) return null;
  }

  const fp = fingerprintBar(bar);
  const cacheKey = `${mode}:${fp}`;
  const cached = state.cache.get(cacheKey);
  if (cached) {
    touchBest(state, cached.scored);
    return cached.scored;
  }

  if (state.budget.remaining <= 0 && !force) return null;
  if (state.budget.remaining > 0) {
    state.budget.remaining -= 1;
    state.budget.used += 1;
  } else if (force) {
    state.budget.used += 1;
  } else {
    return null;
  }

  const result = state.evaluate({ bar, mode });
  if (result.finite === false) {
    const bad = emptyScored(bar, state.config.profileId ?? "balanced", Number.NEGATIVE_INFINITY);
    state.cache.set(cacheKey, { score: bad.robustScore, scored: bad });
    return bad;
  }
  const scored = toScoredBar(bar, result, state.config.profileId ?? "balanced");
  state.cache.set(cacheKey, { score: scored.robustScore, scored });
  if (isFiniteEval({ score: scored.robustScore })) {
    touchBest(state, scored);
    pushArchive(state, scored);
  }
  return scored;
}

export function toScoredBar(
  bar: readonly string[],
  result: { score: number; objective?: ScoredBar | { ok?: boolean; robustScore?: number; minDpm?: number; weightedMean?: number; profileId?: ScoredBar["profileId"]; openingDpm?: number; developedDpm?: number; steadyDpm?: number } },
  profileId: ScoredBar["profileId"],
): ScoredBar {
  const obj = result.objective;
  if (obj && "ok" in obj && obj.ok === false) {
    return emptyScored(bar, profileId, Number.NEGATIVE_INFINITY);
  }
  if (obj && "robustScore" in obj && typeof obj.robustScore === "number" && "openingDpm" in obj) {
    const robustScore = obj.robustScore;
    return {
      bar: [...bar],
      fingerprint: fingerprintBar(bar),
      minDpm: obj.minDpm ?? 0,
      weightedMean: obj.weightedMean ?? robustScore,
      robustScore,
      score: robustScore,
      profileId: obj.profileId ?? profileId,
      openingDpm: obj.openingDpm ?? 0,
      developedDpm: obj.developedDpm ?? 0,
      steadyDpm: obj.steadyDpm ?? 0,
    };
  }
  return {
    bar: [...bar],
    fingerprint: fingerprintBar(bar),
    minDpm: result.score,
    weightedMean: result.score,
    robustScore: result.score,
    score: result.score,
    profileId,
    openingDpm: result.score,
    developedDpm: result.score,
    steadyDpm: result.score,
  };
}

function emptyScored(bar: readonly string[], profileId: ScoredBar["profileId"], score: number): ScoredBar {
  return {
    bar: [...bar],
    fingerprint: fingerprintBar(bar),
    minDpm: 0,
    weightedMean: 0,
    robustScore: score,
    score,
    profileId,
    openingDpm: 0,
    developedDpm: 0,
    steadyDpm: 0,
  };
}

function touchBest(state: SearchState, scored: ScoredBar): void {
  if (!Number.isFinite(scored.robustScore)) return;
  if (!state.best || scored.robustScore > state.best.robustScore) {
    state.best = { ...scored, bar: [...scored.bar] };
  }
}

function pushArchive(state: SearchState, scored: ScoredBar): void {
  if (!Number.isFinite(scored.robustScore)) return;
  if (state.archive.some((a) => a.fingerprint === scored.fingerprint)) return;
  state.archive.push({ ...scored, bar: [...scored.bar] });
  if (state.archive.length > ARCHIVE_CAP) {
    state.archive.sort((a, b) => b.robustScore - a.robustScore);
    state.archive.length = ARCHIVE_CAP;
  }
}

export function compareScored(a: ScoredBar, b: ScoredBar): number {
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
