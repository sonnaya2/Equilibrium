import type { EvaluateFn, PoolAbility, SizeBounds, SolveResult, SolveTier } from "./contracts";
import { createRng } from "./rng";
import { buildSeeds } from "./seeds";
import { createSearchState, type SearchConfig } from "./search/types";
import { runExhaustive, runExhaustiveAsync } from "./search/exhaustive";
import { runConstructiveBeam, runConstructiveBeamAsync } from "./search/constructiveBeam";
import { runEvolutionary, runEvolutionaryAsync } from "./search/evolutionary";
import { runLargeNeighborhood, runLargeNeighborhoodAsync } from "./search/largeNeighborhood";
import { runAnnealing, runAnnealingAsync } from "./search/annealing";
import { runLocalSearch, runLocalSearchAsync } from "./search/localSearch";
import { finalizeSearch, finalizeSearchAsync } from "./search/finalize";
import { createYieldCtx, maybeYield, yieldEveryForTier } from "./search/yield";

/**
 * Evaluation budgets. Thorough is tuned for interactive UI (~few seconds of
 * explore sims), not overnight research. Extreme/Unhinged scale up.
 */
export const TIER_BUDGETS: Record<SolveTier, number> = {
  // Thorough ~ half of Extreme search budget; still the interactive default.
  thorough: 900,
  extreme: 1_800,
  unhinged: 8_000,
};

/**
 * Per-tier sim horizons (game-time seconds, not wall clock).
 */
export const TIER_HORIZON_SECONDS: Record<
  SolveTier,
  { exploreSeconds: number; fullSeconds: number }
> = {
  thorough: { exploreSeconds: 15, fullSeconds: 60 },
  extreme: { exploreSeconds: 30, fullSeconds: 120 },
  unhinged: { exploreSeconds: 30, fullSeconds: 300 },
};

/** Parallel agents by depth — host merges best score / bars across workers. */
export const TIER_AGENT_COUNT: Record<SolveTier, number> = {
  thorough: 4,
  extreme: 6,
  unhinged: 8,
};

/**
 * How many parallel agents to launch for a tier.
 * `hardwareAgents` is usually solverPoolSize() (cores−1, capped at pool max).
 */
export function preferredAgentCount(tier: SolveTier, hardwareAgents: number): number {
  const want = TIER_AGENT_COUNT[tier] ?? TIER_AGENT_COUNT.thorough;
  return Math.max(1, Math.min(want, Math.max(1, hardwareAgents)));
}

export function configForTier(tier: SolveTier, seed = 1): SearchConfig {
  const evaluationBudget = TIER_BUDGETS[tier];
  const scale = evaluationBudget / TIER_BUDGETS.thorough;
  return {
    tier,
    evaluationBudget,
    seed,
    beamWidth: tier === "thorough" ? 10 : tier === "extreme" ? 18 : 28,
    beamInsertAllPositions: tier !== "thorough",
    // Thorough: beam + local only. Extreme+: full ensemble.
    evoPopulation: tier === "thorough" ? 0 : Math.round(16 * Math.min(scale, 4)),
    evoGenerations: tier === "thorough" ? 0 : Math.round(8 * Math.min(scale, 4)),
    evoElite: 2,
    lnsRounds: tier === "thorough" ? 0 : Math.round(14 * Math.min(scale, 4)),
    lnsDestroyK: 2,
    annealSteps: tier === "thorough" ? 0 : Math.round(50 * Math.min(scale, 4)),
    localIterations: tier === "thorough" ? 12 : Math.round(40 * Math.min(scale, 4)),
    topK: tier === "thorough" ? 5 : tier === "extreme" ? 6 : 8,
    // Finalize shortlist: Thorough 4 · Extreme 6 · Unhinged 8
    fullShortlistSize: tier === "thorough" ? 4 : tier === "extreme" ? 6 : 8,
    exhaustiveMax: tier === "thorough" ? 6_000 : tier === "extreme" ? 12_000 : 80_000,
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

export type SolvePhaseName =
  "seed" | "exhaustive" | "beam" | "evolutionary" | "lns" | "anneal" | "local" | "finalize";

export interface SolveAsyncHooks {
  /** Called before each search phase (for progress labels). */
  onPhase?: (phase: SolvePhaseName) => void;
  /** Cooperative yield so the UI can paint / cancel. */
  yieldSlice?: () => Promise<void>;
  /** Full-horizon finalize step progress (N of M). */
  onFinalizeStep?: (info: {
    done: number;
    total: number;
    label: string;
    bar?: readonly string[];
  }) => void;
  /** Cooperative cancel for finalize shortlist loop. */
  isCancelled?: () => boolean;
}

/**
 * Synchronous orchestrator (tests / workers that own the thread).
 * 1 seeds → 2 exhaustive? → 3 beam → 4 evo → 5 LNS → 6 anneal → 7 local → 8 finalize
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
  if (state.canEval() && config.evoPopulation > 0) runEvolutionary(state);
  if (state.canEval() && config.lnsRounds > 0) runLargeNeighborhood(state);
  if (state.canEval() && config.annealSteps > 0) runAnnealing(state);
  if (state.canEval()) runLocalSearch(state);

  return finalizeSearch(state, { tier, topK: config.topK });
}

/**
 * Async orchestrator: yields between phases so main-thread UI can paint.
 * Strategy bodies are still synchronous, but shorter thorough budgets keep
 * each phase snappy; yield between them restores interactivity.
 */
export async function solveAsync(input: SolveInput, hooks?: SolveAsyncHooks): Promise<SolveResult> {
  const tier = input.tier ?? "thorough";
  const base = configForTier(tier, input.seed ?? 1);
  const config: SearchConfig = { ...base, ...input.config, tier };
  const yieldSlice = hooks?.yieldSlice ?? (async () => undefined);
  const onPhase = hooks?.onPhase;

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

  const yieldCtx = createYieldCtx(hooks?.yieldSlice, yieldEveryForTier(tier));

  onPhase?.("seed");
  for (let i = 0; i < seeds.length; i++) {
    if (!state.canEval()) break;
    state.tryEval(seeds[i]!, "search", "seed");
    await maybeYield(state, yieldCtx);
  }
  await yieldSlice();

  if (state.canEval()) {
    onPhase?.("exhaustive");
    await runExhaustiveAsync(state, yieldCtx);
    await yieldSlice();
  }
  if (state.canEval()) {
    onPhase?.("beam");
    await runConstructiveBeamAsync(state, yieldCtx);
    await yieldSlice();
  }
  if (state.canEval() && config.evoPopulation > 0) {
    onPhase?.("evolutionary");
    await runEvolutionaryAsync(state, yieldCtx);
    await yieldSlice();
  }
  if (state.canEval() && config.lnsRounds > 0) {
    onPhase?.("lns");
    await runLargeNeighborhoodAsync(state, yieldCtx);
    await yieldSlice();
  }
  if (state.canEval() && config.annealSteps > 0) {
    onPhase?.("anneal");
    await runAnnealingAsync(state, yieldCtx);
    await yieldSlice();
  }
  if (state.canEval()) {
    onPhase?.("local");
    await runLocalSearchAsync(state, yieldCtx);
    await yieldSlice();
  }

  onPhase?.("finalize");
  const result = await finalizeSearchAsync(state, {
    tier,
    topK: config.topK,
    yieldSlice,
    isCancelled: hooks?.isCancelled,
    onStep: (info) => {
      onPhase?.("finalize");
      hooks?.onFinalizeStep?.(info);
    },
  });
  await yieldSlice();
  return result;
}
