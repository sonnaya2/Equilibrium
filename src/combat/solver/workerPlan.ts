/** Worker assignment plan for parallel Revolution solvers. */

import type { SearchTier } from "./contracts";
import { agentBarSizeBounds, clampSolverBarSizes, type SolverBarSizeBounds } from "./barPolicy";

export type WorkerRecipe = "default" | "evolutionary" | "anneal_local";

/** Tier MAX agent ceilings - Thorough 4 · Extreme 6 · Unhinged 6. */
export const TIER_MAX_AGENTS: Record<SearchTier, number> = {
  thorough: 4,
  extreme: 6,
  unhinged: 6,
};

/** Hard cap across every tier (matches Unhinged ceiling). */
export const SAFE_GLOBAL_AGENT_CEILING = 6;

/**
 * Whether preferredAgentCount may hold back a logical core for the UI main thread.
 *
 * MUST stay paired with the guard in preferredAgentCount: reserve only when
 * `hardwareCores > tierMax + 1`. That keeps agent count (and total evaluation
 * capacity N * TIER_BUDGETS) identical to the no-reserve path whenever cores
 * would otherwise force a drop (e.g. cores=4 + thorough tierMax=4 still
 * launches 4 agents, never 3).
 *
 * Do NOT flip this true with a naive `max(1, cores-1)` alone: on low-core
 * machines that lowers N and therefore total capacity. Prefer this flag true
 * only with the tierMax+1 spare-core guard (as implemented below).
 */
export const RESERVES_UI_CORE = true;

export interface WorkerPlanInput {
  minBarSize: number;
  maxBarSize: number;
  tier: SearchTier;
  /** Base RNG seed from the packed request. */
  baseSeed?: number;
  /** Override hardware concurrency (tests / host). */
  hardwareCores?: number;
  /** Optional hard cap (e.g. pool slot limit). */
  maxAgents?: number;
  /** Explicit agent count override (still clamped to ceilings). */
  agents?: number;
}

export interface WorkerAssignment {
  agentIndex: number;
  minBarSize: number;
  maxBarSize: number;
  /** Fixed target length for this agent (equals min=max band). */
  targetLength: number;
  recipe: WorkerRecipe;
  seed: number;
}

export interface WorkerPlan {
  tier: SearchTier;
  bounds: SolverBarSizeBounds;
  agentCount: number;
  assignments: readonly WorkerAssignment[];
}

/** Detect logical cores; safe default 4 when navigator is missing. */
export function detectHardwareCores(): number {
  try {
    const n =
      typeof navigator !== "undefined" &&
      navigator &&
      typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : undefined;
    if (typeof n === "number" && Number.isFinite(n) && n >= 1) return Math.floor(n);
  } catch {
    // ignore
  }
  return 4;
}

/**
 * True when a UI-core reserve would not reduce agent count below the no-reserve
 * tier/hardware cap. Requires at least one spare core beyond tierMax + the UI.
 */
export function shouldReserveUiCore(tierMax: number, hardwareCores: number): boolean {
  if (!RESERVES_UI_CORE) return false;
  const hw = Math.max(1, Math.floor(hardwareCores) || 1);
  const cap = Math.max(1, Math.floor(tierMax) || 1);
  return hw > cap + 1;
}

/**
 * How many agents to launch for a tier.
 * Tier value is a ceiling; hardwareCores (or detected) may lower it.
 *
 * UI-core reserve uses max(1, cores-1) ONLY when hardwareCores > tierMax+1 so
 * total capacity N * TIER_BUDGETS never drops vs the previous no-reserve plan
 * on tight core counts (cores=4 thorough stays 4 agents).
 */
export function preferredAgentCount(tier: SearchTier, hardwareAgents?: number): number {
  const tierMax = TIER_MAX_AGENTS[tier] ?? TIER_MAX_AGENTS.thorough;
  const hw = Math.max(1, Math.floor(hardwareAgents ?? detectHardwareCores()) || 1);
  const reserved = shouldReserveUiCore(tierMax, hw) ? 1 : 0;
  const usable = Math.max(1, hw - reserved);
  return Math.max(1, Math.min(tierMax, usable, SAFE_GLOBAL_AGENT_CEILING));
}

/** Recipes available at each tier (thorough stays ensemble-only). */
export function recipesForTier(tier: SearchTier): readonly WorkerRecipe[] {
  if (tier === "extreme") return ["default", "evolutionary"];
  if (tier === "unhinged") return ["default", "evolutionary", "anneal_local"];
  return ["default"];
}

/**
 * Recipe for plan index i under a tier - spreads available recipes across agents
 * without requiring legacy blocks of 6.
 */
export function planRecipe(agentIndex: number, tier: SearchTier): WorkerRecipe {
  const recipes = recipesForTier(tier);
  const i = Math.max(0, Math.floor(Number(agentIndex)) || 0);
  return recipes[i % recipes.length]!;
}

function assignmentKey(
  a: Pick<WorkerAssignment, "minBarSize" | "maxBarSize" | "recipe" | "seed">,
): string {
  return `${a.minBarSize}:${a.maxBarSize}|${a.recipe}|${a.seed}`;
}

/**
 * Build a unique multi-agent plan inside the request size window.
 * Uniqueness key: bar bounds + recipe + seed (no duplicate assignments).
 */
export function planWorkers(input: WorkerPlanInput): WorkerPlan {
  const bounds = clampSolverBarSizes(input.minBarSize, input.maxBarSize);
  const tier = input.tier ?? "thorough";
  const hw = input.hardwareCores ?? detectHardwareCores();
  const tierCap = preferredAgentCount(tier, hw);
  const poolCap =
    typeof input.maxAgents === "number" && Number.isFinite(input.maxAgents)
      ? Math.max(1, Math.floor(input.maxAgents))
      : SAFE_GLOBAL_AGENT_CEILING;
  let want = tierCap;
  if (typeof input.agents === "number" && Number.isFinite(input.agents)) {
    want = Math.max(1, Math.floor(input.agents));
  }
  const agentCount = Math.max(1, Math.min(want, tierCap, poolCap, SAFE_GLOBAL_AGENT_CEILING));

  const baseSeed = Math.floor(input.baseSeed ?? 1) || 1;
  const assignments: WorkerAssignment[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < agentCount; i++) {
    const band = agentBarSizeBounds(bounds.minBarSize, bounds.maxBarSize, i, agentCount);
    let seed = baseSeed + i * 9973;
    let recipe = planRecipe(i, tier);
    let candidate: WorkerAssignment = {
      agentIndex: i,
      minBarSize: band.minBarSize,
      maxBarSize: band.maxBarSize,
      targetLength: band.maxBarSize,
      recipe,
      seed,
    };
    // Guarantee uniqueness even if length+recipe collide (fixed window).
    let guard = 0;
    while (seen.has(assignmentKey(candidate)) && guard < 64) {
      seed += 1;
      candidate = { ...candidate, seed };
      guard++;
    }
    // Extremely defensive: if still colliding, also rotate recipe.
    if (seen.has(assignmentKey(candidate))) {
      const recipes = recipesForTier(tier);
      recipe = recipes[(i + guard) % recipes.length]!;
      candidate = { ...candidate, recipe, seed: seed + 17 };
    }
    seen.add(assignmentKey(candidate));
    assignments.push(candidate);
  }

  return { tier, bounds, agentCount: assignments.length, assignments };
}
