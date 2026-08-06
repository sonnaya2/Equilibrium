/**
 * Vigour A/B: reevaluate the no-Vigour winner under Vigour; never trust stale scores.
 */
import type {
  EvaluateFn,
  EvalMode,
  EvalResult,
  PoolAbility,
  SizeBounds,
  SolveResult,
  SolveTier,
} from "./contracts";
import { normalizeAuthoredSeed } from "./seeds";
import { solve, type SolveInput } from "./solve";

export interface VigourEvalContext {
  /** Evaluate already bound to a ringOfVigour-active sim context. */
  evaluate: EvaluateFn;
  mode?: EvalMode;
}

/**
 * Fresh evaluation of an old no-Vigour winner with Vigour active.
 * Callers must supply a Vigour-on evaluate; any stored score is ignored.
 */
export function reevaluateIncumbentBar(
  bar: readonly string[],
  contextWithVigour: VigourEvalContext,
): EvalResult {
  return contextWithVigour.evaluate({
    bar,
    mode: contextWithVigour.mode ?? "full",
  });
}

export interface CompareVigourSearchInput {
  /** Bar that won without Vigour. Any prior score is ignored. */
  incumbentBar: readonly string[];
  /**
   * Stale no-Vigour score if the caller still holds one.
   * Accepted only so call sites do not invent comparisons; never used as truth.
   */
  staleIncumbentScore?: number;
  /** Vigour-on evaluate used for reeval and search. */
  evaluate: EvaluateFn;
  pool: readonly PoolAbility[];
  sizeBounds: SizeBounds;
  tier?: SolveTier;
  seed?: number;
  otherAuthoredSeeds?: readonly (readonly string[])[];
  config?: SolveInput["config"];
}

export interface CompareVigourSearchResult {
  incumbentBar: readonly string[];
  /**
   * Bar that actually enters search as the incumbent seed after size-bound
   * truncate / exclusive-group filter / pad-to-min (null if unseedable).
   */
  seededIncumbentBar: string[] | null;
  /** Fresh Vigour-on full eval of the seeded incumbent (aligned seed form). */
  reevaluatedIncumbent: EvalResult;
  /** Finite score from reeval, or -Infinity when not rankable / unseedable. */
  reevaluatedScore: number;
  search: SolveResult;
  /** Winner robustScore strictly above fresh incumbent reeval. */
  winnerBeatsIncumbent: boolean;
  winnerTiesIncumbent: boolean;
  /** Winner matches the seeded (legalized) incumbent bar. */
  winnerIsIncumbentBar: boolean;
}

function finiteEvalScore(result: EvalResult): number {
  if (result.finite === false) return Number.NEGATIVE_INFINITY;
  if (result.validForFinalRanking === false) return Number.NEGATIVE_INFINITY;
  if (!Number.isFinite(result.score)) return Number.NEGATIVE_INFINITY;
  return result.score;
}

function barsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

const UNRANKABLE_EVAL: EvalResult = {
  score: Number.NEGATIVE_INFINITY,
  finite: false,
  mode: "full",
  exploratory: false,
  validForFinalRanking: false,
};

/**
 * Reevaluate the old no-Vigour winner under Vigour, seed it as authored incumbent,
 * run search, and compare the final winner only to the fresh reeval (never stale score).
 *
 * Seed and reeval use the same legalized bar (size-bounds truncate, exclusive-group
 * filter, pad-to-min) so comparison is not against a bar search never scored.
 */
export function compareVigourSearch(input: CompareVigourSearchInput): CompareVigourSearchResult {
  void input.staleIncumbentScore;

  const seededIncumbentBar = normalizeAuthoredSeed(
    input.incumbentBar,
    input.pool,
    input.sizeBounds,
  );

  const reevaluatedIncumbent = seededIncumbentBar
    ? reevaluateIncumbentBar(seededIncumbentBar, {
        evaluate: input.evaluate,
        mode: "full",
      })
    : UNRANKABLE_EVAL;
  const reevaluatedScore = seededIncumbentBar
    ? finiteEvalScore(reevaluatedIncumbent)
    : Number.NEGATIVE_INFINITY;

  const authoredSeeds: string[][] = [
    ...(seededIncumbentBar ? [seededIncumbentBar] : []),
    ...(input.otherAuthoredSeeds ?? []).map((s) => [...s]),
  ];

  const search = solve({
    pool: input.pool,
    sizeBounds: input.sizeBounds,
    evaluate: input.evaluate,
    tier: input.tier,
    seed: input.seed,
    authoredSeeds,
    config: input.config,
  });

  const winner = search.best;
  // Only full-rankable winners compare; exploratory/degraded scores are different scale.
  const winnerRankable =
    winner != null &&
    winner.validForFinalRanking === true &&
    winner.mode === "full" &&
    Number.isFinite(winner.robustScore);
  const winnerScore = winnerRankable ? winner!.robustScore : Number.NEGATIVE_INFINITY;
  const winnerIsIncumbentBar =
    winner != null && seededIncumbentBar != null && barsEqual(winner.bar, seededIncumbentBar);
  const bothRankable =
    Number.isFinite(winnerScore) &&
    winnerScore > Number.NEGATIVE_INFINITY &&
    Number.isFinite(reevaluatedScore) &&
    reevaluatedScore > Number.NEGATIVE_INFINITY;

  return {
    incumbentBar: [...input.incumbentBar],
    seededIncumbentBar: seededIncumbentBar ? [...seededIncumbentBar] : null,
    reevaluatedIncumbent,
    reevaluatedScore,
    search,
    winnerBeatsIncumbent: bothRankable && winnerScore > reevaluatedScore + 1e-12,
    winnerTiesIncumbent: bothRankable && Math.abs(winnerScore - reevaluatedScore) <= 1e-12,
    winnerIsIncumbentBar,
  };
}
