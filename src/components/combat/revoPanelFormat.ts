/**
 * Pure labels/formatters for Revolution panel UI.
 * No React; safe to unit-test without the solver host.
 */
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";
import { ticksToSeconds } from "@/combat/core/ticks";
import {
  clampSolverBarSizes,
  isVerifiedCacheableResult,
  MIN_SOLVER_BAR_SIZE,
  VERIFIED_CACHEABLE_PROOFS,
  type ObjectiveProfileId,
  type ProofLabel,
  type SerializableSolverRequest,
  type SolverAgentRecipe,
  type SolverProgress,
  type SolverResultDTO,
  type SolverSearchTier,
} from "@/combat/solver";
import { dtoAllowsApply, residualMassOfDto } from "@/combat/solver/solverDtoHonesty";

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

/**
 * Fail-closed DTO stamp for apply-final (same as verified cache).
 * Empty/missing or !== live blocks verified apply.
 */
export function mayApplyFinalDtoStamp(opts: {
  dtoSolveIdentity: string | null | undefined;
  liveIdentity: string;
}): boolean {
  const stamped = opts.dtoSolveIdentity;
  if (typeof stamped !== "string" || stamped.length === 0) return false;
  return stamped === opts.liveIdentity;
}

/** Surface when live session completes with empty/mismatched DTO stamp. */
export const APPLY_FINAL_STAMP_REJECT_MESSAGE =
  "Solve result identity missing or mismatched; result discarded";

/**
 * Phase 4: resultBuilder / pool failure for no full-horizon winner.
 * Catch path surfaces error only - no stopped-preview Apply / onActiveBar.
 */
export function isNoValidatedUpgradeError(message: string): boolean {
  return (
    message.includes("no validated full-horizon upgrade") ||
    message.includes("no valid candidate")
  );
}

/** Soft outcome when no validated candidate beats the incumbent. */
export const CURRENT_BAR_REMAINS_BEST = "current bar remains best";

/**
 * Phase 4/5 Apply gate for completed result DTOs.
 * Delegates to dtoAllowsApply so UI and solver stay on one fail-closed policy.
 */
export function mayApplySolverResultBar(
  dto: SolverResultDTO | null | undefined,
): boolean {
  return dtoAllowsApply(dto);
}

/**
 * Phase 5: whether applyFinalDto should replace the bar / remember as upgrade.
 * Same fail-closed policy as Apply (including residual / fullyValidated / proof).
 */
export function shouldAdoptSolverResultBar(
  dto: SolverResultDTO | null | undefined,
): boolean {
  return dtoAllowsApply(dto);
}

/** True when Apply may target this top row (winner bar only). */
export function mayApplySolverResultRow(
  dto: SolverResultDTO | null | undefined,
  rowBar: readonly string[] | null | undefined,
): boolean {
  if (!mayApplySolverResultBar(dto)) return false;
  if (!dto?.bar?.length || !rowBar?.length) return false;
  return barsMatch(dto.bar, rowBar);
}

/** Stopped / cancel previews are never Apply-eligible (unverified estimates). */
export function mayApplyStoppedPreview(): boolean {
  return false;
}

/** Upgrade / remains-best fragment for results chrome; null when nothing to add. */
export function formatSolverUpgradeChrome(dto: {
  isUpgrade?: boolean;
  scoreImprovement?: number;
  percentImprovement?: number | null;
  validForApply?: boolean;
  honesty?: {
    residualMass?: number;
    applyAllowed?: boolean;
    beatsBar?: boolean;
  };
  rng?: { residualWeight?: number };
  summary?: { rng?: { residualWeight?: number } };
}): string | null {
  const residual = residualMassOfDto(dto as SolverResultDTO);
  if (residual > 0) return "residual blocks apply";
  if (dto.isUpgrade === false || dto.honesty?.beatsBar === false) {
    return CURRENT_BAR_REMAINS_BEST;
  }
  if (dto.isUpgrade !== true && dto.honesty?.beatsBar !== true) return null;
  const abs = dto.scoreImprovement;
  if (typeof abs !== "number" || !Number.isFinite(abs) || abs <= 0) return null;
  const pct = dto.percentImprovement;
  if (typeof pct === "number" && Number.isFinite(pct)) {
    return `+${formatNumber(abs)} (+${pct.toFixed(1)}%)`;
  }
  return `+${formatNumber(abs)}`;
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

/** Exact ordered bar id equality (empty/null never match). */
export function barsMatch(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  if (!a?.length || !b?.length) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Verified permanent save only when live identity matches the completed DTO
 * stamp, the bar is still that result bar, and the proof is cacheable.
 * Degraded / stopped / failed proofs never qualify.
 */
export function maySaveVerified(opts: {
  liveIdentity: string | null | undefined;
  resultSolveIdentity: string | null | undefined;
  finalBar: readonly string[] | null | undefined;
  currentBar: readonly string[] | null | undefined;
  solving?: boolean;
  /** proofLabel (or proof.label) from the completed DTO; required for verified. */
  proofLabel?: string | null;
}): boolean {
  if (opts.solving) return false;
  const proof = opts.proofLabel;
  if (typeof proof !== "string" || proof.length === 0) return false;
  if (!VERIFIED_CACHEABLE_PROOFS.has(proof as ProofLabel)) return false;
  const live = opts.liveIdentity;
  const stamped = opts.resultSolveIdentity;
  if (typeof live !== "string" || live.length === 0) return false;
  if (typeof stamped !== "string" || stamped.length === 0) return false;
  if (live !== stamped) return false;
  return barsMatch(opts.finalBar, opts.currentBar);
}

/**
 * Recent-library verified flags for a completed final.
 * Only isVerifiedCacheableResult finals get verified:true + scoreContext;
 * degraded proofs keep score as estimate with scoreContext:null.
 */
export function recentLibraryVerifiedFields(
  request: SerializableSolverRequest,
  dto: SolverResultDTO,
): { verified: boolean; scoreContext: string | null } {
  if (!isVerifiedCacheableResult(request, dto)) {
    return { verified: false, scoreContext: null };
  }
  const stamped = dto.solveIdentity;
  return {
    verified: true,
    scoreContext: typeof stamped === "string" && stamped.length > 0 ? stamped : null,
  };
}

/** Completed DTO is stale when stamp is empty/missing or no longer matches live. */
export function isCompletedResultStale(opts: {
  liveIdentity: string;
  resultSolveIdentity: string | null | undefined;
}): boolean {
  const stamped = opts.resultSolveIdentity;
  // Fail-closed: product results without a stamp are not verified presentation.
  if (typeof stamped !== "string" || stamped.length === 0) return true;
  return stamped !== opts.liveIdentity;
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

const PROOF_MASS_EPS = 1e-12;

function isExactClaimProofId(label: string | null | undefined): boolean {
  return (
    label === "full-objective-global-optimum" ||
    label === "globally-optimal" ||
    label === "search-objective-exhaustive"
  );
}

function optsTaintExactProof(opts?: {
  approximated?: boolean;
  residualWeight?: number;
  exactness?: string;
}): boolean {
  if (opts?.approximated) return true;
  const residual = opts?.residualWeight;
  if (typeof residual === "number" && Number.isFinite(residual) && residual > PROOF_MASS_EPS) {
    return true;
  }
  const ex = opts?.exactness;
  return (
    ex === "approximated" ||
    ex === "bounded-approximation" ||
    ex === "truncated" ||
    ex === "resampled"
  );
}

/**
 * Human proof label for solver chrome.
 * Residual / non-exact exactness never shows global optimum / exhaustive chrome.
 */
export function formatProofLabel(
  label: string | null | undefined,
  opts?: { approximated?: boolean; residualWeight?: number; exactness?: string },
): string {
  if (optsTaintExactProof(opts) && isExactClaimProofId(label)) {
    return "Approximated";
  }
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
