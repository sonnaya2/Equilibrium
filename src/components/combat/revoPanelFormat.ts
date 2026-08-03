/**
 * Pure labels/formatters for Revolution panel UI.
 * No React; safe to unit-test without the solver host.
 */
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { ticksToSeconds } from "@/combat/core/ticks";
import type {
  ObjectiveProfileId,
  SolverAgentRecipe,
  SolverProgress,
  SolverResultDTO,
  SolverSearchTier,
} from "@/combat/solver";
import type { ProofLabel } from "@/combat/solver/contracts";

export function solverPhaseLabel(
  phase: SolverProgress["phase"] | undefined,
  opts?: { stopping?: boolean; scoringLabel?: string },
): string {
  if (opts?.stopping) return "Stopping";
  if (phase === "finalize") return "Scoring";
  switch (phase) {
    case "seed":
      return "Seeding";
    case "explore":
      return "Search";
    case "exploit":
      return "Refine";
    case "paused":
      return "Paused";
    default:
      return "Search";
  }
}

export function previewCategory(
  category: AbilitySpec["category"] | undefined,
): "basic" | "threshold" | "ultimate" | "utility" | undefined {
  if (category === "enhanced") return "threshold";
  if (category === "basic" || category === "ultimate" || category === "utility") return category;
  return undefined;
}

export function workerPhaseLabel(
  phase: SolverProgress["phase"] | undefined,
  finished?: boolean,
): string {
  if (finished) return "done";
  switch (phase) {
    case "seed":
      return "seed";
    case "explore":
      return "search";
    case "exploit":
      return "refine";
    case "finalize":
      return "score";
    case "paused":
      return "paused";
    default:
      return "search";
  }
}

export function workerRecipeLabel(recipe: SolverAgentRecipe | undefined): string {
  if (recipe === "evolutionary") return "evo";
  if (recipe === "anneal_local") return "anneal";
  return "ensemble";
}

export function workerRecipeGroupLabel(recipe: SolverAgentRecipe): string {
  if (recipe === "evolutionary") return "Evo";
  if (recipe === "anneal_local") return "Anneal";
  return "Ensemble";
}

/** Partial/stop/error DTO from live progress when a full winner is unavailable. */
export function partialDtoFromProgress(
  partial: SolverProgress,
  profileId: ObjectiveProfileId,
  tier: SolverSearchTier,
  proofLabel: ProofLabel,
): SolverResultDTO {
  const exp = partial.bestExploratoryScore ?? partial.bestScore;
  const full = partial.bestFullScore;
  return {
    bar: [...(partial.topBarPreview ?? [])],
    score: Number.isFinite(full) ? full! : exp,
    windowDpms: 0,
    evaluations: partial.evaluations,
    uniqueCandidates: partial.uniqueCandidates,
    seed: 1,
    profileId,
    tier,
    durationTicks: 500,
    proofLabel,
    ...(Number.isFinite(exp) ? { bestExploratoryScore: exp } : {}),
    ...(Number.isFinite(full) ? { bestFullScore: full } : {}),
  };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

/** Compact wall-clock for cast rows (e.g. 3.6s). */
export function formatTime(ticks: number): string {
  const seconds = ticksToSeconds(ticks);
  return `${seconds.toFixed(1)}s`;
}

export function castCritLabel(result: RotationSummary["casts"][number]["result"]): string | null {
  const chance = Math.max(0, ...result.hits.map((hit) => hit.critChance));
  if (chance >= 1) return "Crit";
  return chance > 0 ? `${Math.round(chance * 1000) / 10}% crit EV` : null;
}

export function progressFillFromState(
  solving: boolean,
  solverProgress: SolverProgress | null,
  solverTierBudget: number,
): number {
  let progressFill = 0;
  if (solving) {
    if (solverProgress?.progressRatio != null) {
      progressFill = Math.min(0.995, solverProgress.progressRatio);
    } else if (solverProgress) {
      const budget = Math.max(1, solverProgress.evaluationBudget ?? solverTierBudget);
      progressFill = Math.min(0.995, 0.82 * Math.min(0.98, solverProgress.evaluations / budget));
    } else {
      progressFill = 0.04;
    }
  } else if (solverProgress) {
    progressFill = 1;
  }
  return progressFill;
}

export function trackLiveClassName(
  solving: boolean,
  stopping: boolean,
  solverProgress: SolverProgress | null,
): string {
  if (stopping) {
    return "revo-solver-track revo-solver-track--live revo-solver-track--stopping";
  }
  if (solving && solverProgress?.phase === "finalize") {
    return "revo-solver-track revo-solver-track--live revo-solver-track--finalize";
  }
  if (solving) {
    return "revo-solver-track revo-solver-track--live";
  }
  if (solverProgress) {
    return "revo-solver-track revo-solver-track--done";
  }
  return "revo-solver-track";
}
