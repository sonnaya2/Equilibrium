/**
 * Pure labels/formatters for Revolution panel UI.
 * No React; safe to unit-test without the solver host.
 */
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { ticksToSeconds } from "@/combat/core/ticks";
import {
  ABSOLUTE_MAX_BAR_SIZE,
  clampSolverBarSizes,
  MIN_SOLVER_BAR_SIZE,
  type ObjectiveProfileId,
  type SolverAgentRecipe,
  type SolverProgress,
  type SolverSearchTier,
} from "@/combat/solver";

/** Non-final best-so-far after cancel/error — never a SolverResultDTO. */
export type SolverStoppedPreview = {
  bar: readonly string[];
  evaluations: number;
  uniqueCandidates: number;
  /** Exploratory/search score when known — not a verified final score. */
  bestExploratoryScore?: number;
  /** Full-horizon score if finalize published one mid-run — still non-final. */
  bestFullScore?: number;
  phase: SolverProgress["phase"];
  reason: "stopped-early" | "error";
  profileId: ObjectiveProfileId;
  tier: SolverSearchTier;
};

/** Compact bar-length presets for the solver UI (raw; packer clamps to product floor). */
export type BarSizePresetId = "fixed4" | "range4_6" | "fixed6" | "range4_10";

export type BarSizeBounds = { minBarSize: number; maxBarSize: number };

export const BAR_SIZE_PRESETS: Record<
  BarSizePresetId,
  BarSizeBounds & { label: string }
> = {
  fixed4: { minBarSize: 4, maxBarSize: 4, label: "4" },
  range4_6: { minBarSize: 4, maxBarSize: 6, label: "4–6" },
  fixed6: { minBarSize: 6, maxBarSize: 6, label: "6" },
  range4_10: { minBarSize: 4, maxBarSize: 10, label: "4–10" },
};

/** Default product window after clamp (MIN..ABSOLUTE). */
export const DEFAULT_BAR_SIZE_PRESET: BarSizePresetId = "range4_10";

/** Raw bounds from a preset — may be below MIN_SOLVER_BAR_SIZE until clamped. */
export function barBoundsFromPreset(id: BarSizePresetId): BarSizeBounds {
  const p = BAR_SIZE_PRESETS[id] ?? BAR_SIZE_PRESETS[DEFAULT_BAR_SIZE_PRESET];
  return { minBarSize: p.minBarSize, maxBarSize: p.maxBarSize };
}

/** Clamped product bounds for display / docs (floor may raise 4 → MIN). */
export function clampedBarBoundsFromPreset(id: BarSizePresetId): BarSizeBounds {
  const raw = barBoundsFromPreset(id);
  return clampSolverBarSizes(raw.minBarSize, raw.maxBarSize);
}

/**
 * Live progress facts only — no invented seed/duration/windowDpms/proof.
 * Returns null when there is no bar preview to show.
 */
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

/** Session still owns progress/completion when gen matches and material inputs match. */
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

/**
 * What the host may do when a solve promise settles (resolve or catch).
 * Stale generation or identity always wins: never publish final/stopped artifacts.
 * cancel with live identity → stopped-preview only (no verified writes).
 */
export type SolveSettlementAction = "apply-final" | "stopped-preview" | "ignore";

export function settlementActionForSolve(opts: {
  sessionGen: number;
  currentGen: number;
  sessionIdentity: string;
  currentIdentity: string;
  cancelled: boolean;
  hasFinalDto: boolean;
}): SolveSettlementAction {
  if (opts.sessionGen !== opts.currentGen) return "ignore";
  // Identity first — abort/error after equipment/perk/target/bounds drift must not publish.
  if (opts.sessionIdentity !== opts.currentIdentity) return "ignore";
  if (opts.cancelled) return "stopped-preview";
  if (opts.hasFinalDto) return "apply-final";
  return "ignore";
}

/** True only when a non-final stopped/error preview may be published. */
export function mayPublishStoppedPreview(action: SolveSettlementAction): boolean {
  return action === "stopped-preview";
}

/** Verified cache/recent writes only for completed finals. */
export function mayWriteVerifiedSolveArtifacts(action: SolveSettlementAction): boolean {
  return action === "apply-final";
}

/**
 * Pure settle for AbortError / failure catch paths (same rules as resolve).
 * cancelled=true for abort; cancelled=false + hasFinalDto=false for hard error → ignore
 * unless we treat error as stopped-preview when identity still matches.
 */
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
  // Hard error with live session: allow non-final preview (same as cancelled stop).
  if (opts.sessionGen !== opts.currentGen) return "ignore";
  if (opts.sessionIdentity !== opts.currentIdentity) return "ignore";
  return "stopped-preview";
}

/** Document product floor used when UI requests 4-slot bars. */
export function productBarSizeFloor(): number {
  return MIN_SOLVER_BAR_SIZE;
}

export function productBarSizeCeiling(): number {
  return ABSOLUTE_MAX_BAR_SIZE;
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
