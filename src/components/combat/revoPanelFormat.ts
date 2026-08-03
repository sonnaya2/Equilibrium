/**
 * Pure labels/formatters for Revolution panel UI.
 * No React; safe to unit-test without the solver host.
 */
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { ticksToSeconds } from "@/combat/core/ticks";
import {
  clampSolverBarSizes,
  MIN_SOLVER_BAR_SIZE,
  type ObjectiveProfileId,
  type SolverAgentRecipe,
  type SolverProgress,
  type SolverSearchTier,
} from "@/combat/solver";

/** Non-final best-so-far after cancel/error (not a SolverResultDTO). */
export type SolverStoppedPreview = {
  bar: readonly string[];
  evaluations: number;
  uniqueCandidates: number;
  bestExploratoryScore?: number;
  bestFullScore?: number;
  phase: SolverProgress["phase"];
  reason: "stopped-early" | "error";
  profileId: ObjectiveProfileId;
  tier: SolverSearchTier;
};

/** Fixed length n, or a min..max search window. */
export type BarSizePresetId =
  | "fixed4"
  | "fixed5"
  | "fixed6"
  | "fixed7"
  | "fixed8"
  | "fixed9"
  | "fixed10"
  | "fixed11"
  | "range4_6"
  | "range4_10"
  | "range4_11"
  | "range5_8"
  | "range8_11";

export type BarSizeBounds = { minBarSize: number; maxBarSize: number };

function fixedPreset(n: number): BarSizeBounds & { label: string } {
  return { minBarSize: n, maxBarSize: n, label: String(n) };
}

export const BAR_SIZE_PRESETS: Record<
  BarSizePresetId,
  BarSizeBounds & { label: string }
> = {
  fixed4: fixedPreset(4),
  fixed5: fixedPreset(5),
  fixed6: fixedPreset(6),
  fixed7: fixedPreset(7),
  fixed8: fixedPreset(8),
  fixed9: fixedPreset(9),
  fixed10: fixedPreset(10),
  fixed11: fixedPreset(11),
  range4_6: { minBarSize: 4, maxBarSize: 6, label: "4-6" },
  range4_10: { minBarSize: 4, maxBarSize: 10, label: "4-10" },
  range4_11: { minBarSize: 4, maxBarSize: 11, label: "4-11" },
  range5_8: { minBarSize: 5, maxBarSize: 8, label: "5-8" },
  range8_11: { minBarSize: 8, maxBarSize: 11, label: "8-11" },
};

/** Default: full product window. */
export const DEFAULT_BAR_SIZE_PRESET: BarSizePresetId = "range4_11";

export function barBoundsFromPreset(id: BarSizePresetId): BarSizeBounds {
  const p = BAR_SIZE_PRESETS[id] ?? BAR_SIZE_PRESETS[DEFAULT_BAR_SIZE_PRESET];
  return { minBarSize: p.minBarSize, maxBarSize: p.maxBarSize };
}

export function clampedBarBoundsFromPreset(id: BarSizePresetId): BarSizeBounds {
  const raw = barBoundsFromPreset(id);
  return clampSolverBarSizes(raw.minBarSize, raw.maxBarSize);
}

/** Facts from live progress only; null if no bar preview. */
export function stoppedPreviewFromProgress(
  partial: SolverProgress,
  profileId: ObjectiveProfileId,
  tier: SolverSearchTier,
  reason: SolverStoppedPreview["reason"],
): SolverStoppedPreview | null {
  const bar = (partial.topBarPreview ?? []).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  if (bar.length === 0) return null;

  const exp = partial.bestExploratoryScore ?? partial.bestScore;
  const full = partial.bestFullScore;
  return {
    bar: [...bar],
    evaluations: partial.evaluations,
    uniqueCandidates: partial.uniqueCandidates,
    phase: partial.phase,
    reason,
    profileId,
    tier,
    ...(Number.isFinite(exp) ? { bestExploratoryScore: exp } : {}),
    ...(Number.isFinite(full) ? { bestFullScore: full } : {}),
  };
}

export function isLiveSolverSession(opts: {
  sessionGen: number;
  currentGen: number;
  sessionIdentity: string;
  currentIdentity: string;
  cancelled?: boolean;
}): boolean {
  if (opts.sessionGen !== opts.currentGen) return false;
  if (opts.cancelled) return false;
  return opts.sessionIdentity === opts.currentIdentity;
}

export type SolveSettlementAction = "apply-final" | "stopped-preview" | "ignore";

/** Resolve/catch settlement: stale gen or identity always ignore. */
export function settlementActionForSolve(opts: {
  sessionGen: number;
  currentGen: number;
  sessionIdentity: string;
  currentIdentity: string;
  cancelled: boolean;
  hasFinalDto: boolean;
}): SolveSettlementAction {
  if (opts.sessionGen !== opts.currentGen) return "ignore";
  if (opts.sessionIdentity !== opts.currentIdentity) return "ignore";
  if (opts.cancelled) return "stopped-preview";
  if (opts.hasFinalDto) return "apply-final";
  return "ignore";
}

export function mayPublishStoppedPreview(action: SolveSettlementAction): boolean {
  return action === "stopped-preview";
}

export function mayWriteVerifiedSolveArtifacts(action: SolveSettlementAction): boolean {
  return action === "apply-final";
}

/** Catch path (abort vs hard error) using the same identity/gen gates. */
export function settlementActionForCatch(opts: {
  sessionGen: number;
  currentGen: number;
  sessionIdentity: string;
  currentIdentity: string;
  aborted: boolean;
}): SolveSettlementAction {
  if (opts.aborted) {
    return settlementActionForSolve({
      ...opts,
      cancelled: true,
      hasFinalDto: false,
    });
  }
  if (opts.sessionGen !== opts.currentGen) return "ignore";
  if (opts.sessionIdentity !== opts.currentIdentity) return "ignore";
  return "stopped-preview";
}

export function productBarSizeFloor(): number {
  return MIN_SOLVER_BAR_SIZE;
}

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

export function formatProofLabel(label: string | null | undefined): string {
  if (label == null || label === "") return "Best found";
  switch (label) {
    case "heuristic-best-found":
    case "best-found":
      return "Best found";
    case "full-objective-global-optimum":
    case "globally-optimal":
      return "Global optimum";
    case "search-objective-exhaustive":
      return "Exhaustive";
    case "full-shortlist-best":
      return "Shortlist best";
    case "degraded-exploratory-fallback":
      return "Exploratory";
    case "failed":
      return "Failed";
    case "stopped-early":
      return "Stopped early";
    case "heuristic-complete":
      return "Heuristic complete";
    case "budget-not-exhausted":
      return "Budget not exhausted";
    case "converged":
      return "Converged";
    default:
      return label
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
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
