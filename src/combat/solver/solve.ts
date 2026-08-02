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
/** Evaluation budgets per agent (scaled up so longer ladder bands stay competitive). */
export const TIER_BUDGETS: Record<SolveTier, number> = {
  thorough: 2_400,
  extreme: 4_000,
  unhinged: 10_000,
};

/** Per-tier sim horizons (game-time seconds, not wall clock). */
export const TIER_HORIZON_SECONDS: Record<
  SolveTier,
  { exploreSeconds: number; fullSeconds: number }
> = {
  thorough: { exploreSeconds: 24, fullSeconds: 90 },
  extreme: { exploreSeconds: 36, fullSeconds: 150 },
  unhinged: { exploreSeconds: 36, fullSeconds: 300 },
};

/** Thorough 6 · Extreme 12 · Unhinged 18 (recipe blocks of 6 × lengths 5–10). */
export const TIER_AGENT_COUNT: Record<SolveTier, number> = {
  thorough: 6,
  extreme: 12,
  unhinged: 18,
};

/** How many agents to launch for a tier (6 / 12 / 18). */
export function preferredAgentCount(tier: SolveTier, _hardwareAgents?: number): number {
  return TIER_AGENT_COUNT[tier] ?? TIER_AGENT_COUNT.thorough;
}

export function configForTier(tier: SolveTier, seed = 1): SearchConfig {
  const evaluationBudget = TIER_BUDGETS[tier];
  const scale = evaluationBudget / TIER_BUDGETS.thorough;
  const capped = Math.min(scale, 4);
  const isThorough = tier === "thorough";
  const isExtreme = tier === "extreme";

  let beamWidth = 32;
  let topK = 10;
  let exhaustiveMax = 80_000;
  if (isThorough) {
    beamWidth = 18;
    topK = 6;
    exhaustiveMax = 8_000;
  } else if (isExtreme) {
    beamWidth = 22;
    topK = 8;
    exhaustiveMax = 16_000;
  }

  return {
    tier,
    evaluationBudget,
    seed,
    // Wider beam + insert-all so longer constructive bands are not a single prefix.
    beamWidth,
    beamInsertAllPositions: true,
    // Thorough: beam + local only. Extreme+: full ensemble.
    evoPopulation: isThorough ? 0 : Math.round(16 * capped),
    evoGenerations: isThorough ? 0 : Math.round(8 * capped),
    evoElite: 2,
    lnsRounds: isThorough ? 0 : Math.round(14 * capped),
    lnsDestroyK: 2,
    annealSteps: isThorough ? 0 : Math.round(50 * capped),
    localIterations: isThorough ? 40 : Math.round(56 * capped),
    topK,
    fullShortlistSize: topK,
    exhaustiveMax,
    profileId: "balanced",
  };
}

/**
 * Parallel-agent search recipe — blocks of {@link AGENTS_PER_RECIPE} (6):
 *   indices 0–5   → ensemble (default)
 *   indices 6–11  → evolutionary
 *   indices 12–17 → anneal+local
 * Tier caps total agents (6 / 12 / 18), so Extreme never reaches anneal,
 * Thorough never leaves ensemble. Overflow rolls into the next block.
 */
export type SolverAgentRecipe = "default" | "evolutionary" | "anneal_local";

/** Hard cap per algorithm block before rolling into the next recipe. */
export const AGENTS_PER_RECIPE = 6;

export function agentSearchRecipe(
  agentIndex: number,
  _tier?: SolveTier,
): SolverAgentRecipe {
  const i = Math.max(0, Math.floor(Number(agentIndex)) || 0);
  const block = Math.floor(i / AGENTS_PER_RECIPE);
  if (block <= 0) return "default";
  if (block === 1) return "evolutionary";
  return "anneal_local";
}

/** Config overrides applied on top of {@link configForTier} for a specialized agent. */
export function configPatchForRecipe(
  tier: SolveTier,
  recipe: SolverAgentRecipe,
): Partial<SearchConfig> {
  if (recipe === "default") return {};

  const base = configForTier(tier, 1);
  if (recipe === "evolutionary") {
    // Evo path even on Thorough (tier default zeros evo). Cut LNS/anneal.
    return {
      evoPopulation: Math.max(12, base.evoPopulation || 12),
      evoGenerations: Math.max(6, base.evoGenerations || 6),
      evoElite: 2,
      lnsRounds: 0,
      annealSteps: 0,
      beamWidth: Math.max(6, Math.floor(base.beamWidth * 0.65)),
      localIterations: Math.max(4, Math.floor(base.localIterations * 0.5)),
      exhaustiveMax: Math.max(200, Math.floor(base.exhaustiveMax * 0.25)),
    };
  }

  // anneal_local — Unhinged third recipe block (indices 12–17)
  return {
    evoPopulation: 0,
    lnsRounds: 0,
    annealSteps: Math.max(80, Math.round(base.annealSteps * 2) || 80),
    localIterations: Math.max(60, Math.round(base.localIterations * 2) || 60),
    beamWidth: Math.max(4, Math.floor(base.beamWidth * 0.4)),
    exhaustiveMax: Math.max(100, Math.floor(base.exhaustiveMax * 0.15)),
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
