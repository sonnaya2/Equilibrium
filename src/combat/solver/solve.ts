import type {
  EvaluateFn,
  PoolAbility,
  SizeBounds,
  SolveResult,
  SolveTier,
} from "./contracts";
import { createRng } from "./rng";
import { buildSeeds } from "./seeds";
import { createSearchState, type SearchConfig } from "./search/types";
import { runExhaustive } from "./search/exhaustive";
import { runConstructiveBeam } from "./search/constructiveBeam";
import { runEvolutionary } from "./search/evolutionary";
import { runLargeNeighborhood } from "./search/largeNeighborhood";
import { runAnnealing } from "./search/annealing";
import { runLocalSearch } from "./search/localSearch";
import { finalizeSearch } from "./search/finalize";

/** A16-scaled budgets (thorough reduced for CI). */
export const TIER_BUDGETS: Record<SolveTier, number> = {
  thorough: 500,
  extreme: 5_000,
  unhinged: 25_000,
};

export function configForTier(tier: SolveTier, seed = 1): SearchConfig {
  const evaluationBudget = TIER_BUDGETS[tier];
  const scale = evaluationBudget / TIER_BUDGETS.thorough;
  return {
    tier,
    evaluationBudget,
    seed,
    beamWidth: tier === "thorough" ? 8 : tier === "extreme" ? 16 : 24,
    beamInsertAllPositions: tier !== "thorough",
    evoPopulation: Math.round(12 * Math.min(scale, 4)),
    evoGenerations: Math.round(6 * Math.min(scale, 4)),
    evoElite: 2,
    lnsRounds: Math.round(10 * Math.min(scale, 4)),
    lnsDestroyK: 2,
    annealSteps: Math.round(40 * Math.min(scale, 4)),
    localIterations: Math.round(30 * Math.min(scale, 4)),
    topK: 5,
    exhaustiveMax: tier === "thorough" ? 2_000 : tier === "extreme" ? 20_000 : 100_000,
    profileId: "balanced",
  };
}

export interface SolveInput {
  pool: readonly PoolAbility[];
  sizeBounds: SizeBounds;
  evaluate: EvaluateFn;
  tier?: SolveTier;
  seed?: number;
  authoredSeeds?: readonly (readonly string[])[];
  config?: Partial<SearchConfig>;
}

/**
 * Orchestrator:
 * 1 seeds → 2 exhaustive (if small) → 3 beam → 4 evolutionary →
 * 5 LNS → 6 annealing → 7 local → 8 finalize
 */
export function solve(input: SolveInput): SolveResult {
  const tier = input.tier ?? "thorough";
  const base = configForTier(tier, input.seed ?? 1);
  const config: SearchConfig = { ...base, ...input.config, tier };

  const rng = createRng(config.seed);
  const seeds = buildSeeds({
    pool: input.pool,
    sizeBounds: input.sizeBounds,
    rng,
    authored: input.authoredSeeds,
    count: tier === "thorough" ? 8 : 16,
  });

  const state = createSearchState({
    pool: input.pool,
    sizeBounds: input.sizeBounds,
    evaluate: input.evaluate,
    config,
    seeds,
  });

  for (const seed of seeds) {
    if (!state.canEval()) break;
    state.tryEval(seed, "search", "seed");
  }

  if (state.canEval()) runExhaustive(state);
  if (state.canEval()) runConstructiveBeam(state);
  if (state.canEval()) runEvolutionary(state);
  if (state.canEval()) runLargeNeighborhood(state);
  if (state.canEval()) runAnnealing(state);
  if (state.canEval()) runLocalSearch(state);

  return finalizeSearch(state, { tier, topK: config.topK });
}
