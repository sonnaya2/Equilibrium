/**
 * Labels for stochastic / residual / failure metadata on rotation results.
 * residualWeight + exactness may be absent until branch-cap engine work lands;
 * helpers tolerate missing fields via optional chaining.
 */

import { formatProofLabel } from "./revoPanelFormat";

const MASS_EPS = 1e-12;

/** Structural view; does not require engine types to already carry residual/exactness. */
export type StochasticLabelSource = {
  ok?: boolean;
  totalExpected?: number;
  damage?: {
    /** Mirrors rng.totalsBasis when present. */
    scope?: string;
    conditionalConcreteMean?: number;
    knownMassExpectedDamage?: number;
  } | null;
  failure?: {
    failedWeight?: number;
    successfulWeight?: number;
    totalsScope?: string;
    primaryReason?: string;
  } | null;
  rng?: {
    residualWeight?: number;
    exactness?: string;
    failedWeight?: number;
    /** Concrete expanded mass; same as concreteMass when both present. */
    probabilityMass?: number;
    concreteMass?: number;
    /**
     * unit-mass | known-mass-contribution | concrete-terminals (engine wire tokens).
     * Prefer over residual wording alone.
     */
    totalsBasis?: string;
    failure?: {
      failedWeight?: number;
      successfulWeight?: number;
      totalsScope?: string;
      primaryReason?: string;
    };
  } | null;
  metric?: { type?: string } | null;
};

function finiteMass(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function residualWeightOf(source: StochasticLabelSource): number {
  const w = finiteMass(source.rng?.residualWeight);
  return w > MASS_EPS ? w : 0;
}

export function failedWeightOf(source: StochasticLabelSource): number {
  const w = finiteMass(
    source.failure?.failedWeight ?? source.rng?.failure?.failedWeight ?? source.rng?.failedWeight,
  );
  return w > MASS_EPS ? w : 0;
}

export function successfulWeightOf(source: StochasticLabelSource): number {
  return finiteMass(source.failure?.successfulWeight ?? source.rng?.failure?.successfulWeight);
}

export function branchExactnessOf(source: StochasticLabelSource): string | undefined {
  const ex = source.rng?.exactness;
  return typeof ex === "string" && ex.length > 0 ? ex : undefined;
}

/** Cap / sample approximations - not exact branch expansion. */
export function isApproxExactness(exactness: string | null | undefined): boolean {
  return (
    exactness === "approximated" ||
    exactness === "bounded-approximation" ||
    exactness === "truncated" ||
    exactness === "resampled"
  );
}

export function isApproximatedRun(source: StochasticLabelSource): boolean {
  if (residualWeightOf(source) > 0) return true;
  return isApproxExactness(branchExactnessOf(source));
}

/**
 * True only when primary totals were success-renormalized (legacy / never
 * emitted by current engine). Live partial failure uses unconditional-all-mass
 * (concrete success+fail, residual separate) and must not be labeled as success-only.
 */
export function totalsAreSuccessConditional(source: StochasticLabelSource): boolean {
  const scope = source.failure?.totalsScope ?? source.rng?.failure?.totalsScope;
  return scope === "successful-branches-renormalized";
}

/** Concrete expanded mass (probabilityMass / concreteMass); 0 when absent. */
export function concreteMassOf(source: StochasticLabelSource): number {
  const w = finiteMass(source.rng?.concreteMass ?? source.rng?.probabilityMass);
  return w > MASS_EPS ? w : 0;
}

export type TotalsBasisLabel = "concrete-terminals" | "unit-mass" | "known-mass-contribution";

/**
 * Machine-readable primary totals basis.
 * residual > 0 without a field defaults to known-mass-contribution (Phase 2 primary).
 * Legacy residual payloads without scope used concrete-terminals (conditional mean).
 */
export function totalsBasisOf(source: StochasticLabelSource): TotalsBasisLabel | undefined {
  const raw = source.rng?.totalsBasis ?? source.damage?.scope;
  if (raw === "concrete-terminals" || raw === "unit-mass" || raw === "known-mass-contribution") {
    return raw;
  }
  // Phase 2 primary under residual is known-mass contribution, not conditional mean.
  if (residualWeightOf(source) > 0) return "known-mass-contribution";
  return undefined;
}

/** Short chrome next to primary score; null when ordinary exact EV. */
export function runScoreBadge(
  source: StochasticLabelSource,
): "Approximated" | "Conditional" | null {
  if (isApproximatedRun(source)) return "Approximated";
  if (totalsAreSuccessConditional(source)) return "Conditional";
  return null;
}

/**
 * Score strip visibility for revo + manual RotationPlanner.
 * Partial failure and residual mass still carry unconditional banked totals;
 * only pure empty hard-fails stay strip-hidden.
 */
export function shouldShowRunScoreChrome(
  source: StochasticLabelSource | null | undefined,
): boolean {
  if (source == null) return false;
  if (source.ok) return true;
  if (finiteMass(source.totalExpected) > 0) return true;
  if (failedWeightOf(source) > 0) return true;
  if (residualWeightOf(source) > 0) return true;
  return false;
}

export function formatPercentMass(weight: number): string {
  const pct = Math.max(0, weight) * 100;
  if (pct >= 9.95) return `${Math.round(pct)}%`;
  if (pct >= 0.95) return `${pct.toFixed(1)}%`;
  if (pct >= 0.095) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(3)}%`;
}

export function exactnessLabel(exactness: string | null | undefined): string | null {
  if (exactness == null || exactness === "") return null;
  switch (exactness) {
    case "exact":
      return "Exact";
    case "approximated":
      return "Approximated";
    case "merged-exactly":
      return "Exact merge";
    case "bounded-approximation":
      return "Bounded approximation";
    case "truncated":
      return "Truncated";
    case "resampled":
      return "Resampled";
    default:
      return exactness
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
  }
}

/** Optional live-cap / adaptive ladder bits for residual under-count chrome. */
export type BranchCapDiagnosticsOpts = {
  maxLiveBranches?: number;
  attempts?: number;
};

/**
 * Compact residual under-count fragment when residual > 0.
 * concrete mass from source; live cap / attempts only when opts provide them.
 * Never invents unit-mass EV.
 */
export function branchCapDiagnosticsNote(
  source: StochasticLabelSource,
  opts?: BranchCapDiagnosticsOpts,
): string | null {
  if (residualWeightOf(source) <= 0) return null;
  const bits: string[] = [];
  const concrete = concreteMassOf(source);
  if (concrete > 0) {
    bits.push(`concrete mass ${formatPercentMass(concrete)}`);
  }
  const maxLive = opts?.maxLiveBranches;
  if (typeof maxLive === "number" && Number.isFinite(maxLive) && maxLive > 0) {
    bits.push(`live cap ${Math.floor(maxLive)}`);
  }
  const attempts = opts?.attempts;
  if (typeof attempts === "number" && Number.isFinite(attempts) && attempts > 1) {
    bits.push(`${Math.floor(attempts)} attempts`);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

export function residualNote(source: StochasticLabelSource): string | null {
  const residual = residualWeightOf(source);
  if (residual <= 0) return null;
  return `${formatPercentMass(residual)} of probability mass was discarded by branch caps;`;
}

export function failureNote(source: StochasticLabelSource): string | null {
  const failed = failedWeightOf(source);
  if (failed <= 0) return null;
  if (totalsAreSuccessConditional(source)) {
    const success = successfulWeightOf(source);
    const successBit = success > 0 ? ` (${formatPercentMass(success)} success mass)` : "";
    return `${formatPercentMass(failed)} of paths failed${successBit}; damage and DPS are renormalized over successful paths only.`;
  }
  const success = successfulWeightOf(source);
  const scope = source.failure?.totalsScope ?? source.rng?.failure?.totalsScope;
  const reason = source.failure?.primaryReason ?? source.rng?.failure?.primaryReason;
  if (scope === "unconditional-all-mass" && success > 0) {
    // Failure axis is success+fail concrete; residual axis is totalsBasis (separate note).
    const residual = residualWeightOf(source);
    const base =
      residual > 0
        ? `${formatPercentMass(failed)} of paths failed (${formatPercentMass(success)} success); damage and DPS stay unconditional over concrete success and fail paths (residual excluded; not unit-mass EV).`
        : `${formatPercentMass(failed)} of paths failed (${formatPercentMass(success)} success); damage and DPS stay unconditional over concrete success and fail paths (not success-renormalized).`;
    return reason ? `${base} ${reason}.` : base;
  }
  return reason
    ? `${formatPercentMass(failed)} of paths failed (${reason}).`
    : `${formatPercentMass(failed)} of paths failed.`;
}

/**
 * Combined note under the primary stat strip.
 * Optional opts append compact concrete-mass / live-cap under-count bits after residual honesty.
 */
export function runDiagnosticsNote(
  source: StochasticLabelSource,
  opts?: BranchCapDiagnosticsOpts,
): string | null {
  const residual = residualNote(source);
  const cap = branchCapDiagnosticsNote(source, opts);
  const residualBlock =
    residual && cap ? `${residual} ${cap}.` : (residual ?? (cap ? `${cap}.` : null));
  const parts = [residualBlock, failureNote(source)].filter(
    (part): part is string => part != null && part.length > 0,
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Primary damage field label. Numbers still come from result.totalExpected
 * (engine primary); wording marks conditional / approx so they are not read as
 * ordinary unconditional EV.
 */
export function primaryDamageLabel(source: StochasticLabelSource): string {
  if (totalsAreSuccessConditional(source)) return "Damage (success paths)";
  if (isApproximatedRun(source)) return "Damage (approx.)";
  return "Damage";
}

export function primaryDpsLabel(source: StochasticLabelSource): string {
  if (totalsAreSuccessConditional(source)) return "DPS (success paths)";
  if (isApproximatedRun(source)) return "Fixed-window DPS (approx.)";
  return "Fixed-window DPS";
}

/** Manual RotationPlanner uses Expected wording instead of Damage. */
export function primaryExpectedLabel(source: StochasticLabelSource): string {
  if (totalsAreSuccessConditional(source)) return "Expected (success paths)";
  if (isApproximatedRun(source)) return "Expected (approx.)";
  return "Expected";
}

/** Manual / natural-completion DPS label (fixed-window still uses primaryDpsLabel). */
export function primaryManualDpsLabel(source: StochasticLabelSource): string {
  if (source.metric?.type === "fixed-window") return primaryDpsLabel(source);
  if (totalsAreSuccessConditional(source)) return "Natural DPS (success paths)";
  const core = source.rng ? "Expected natural DPS" : "Natural DPS";
  return isApproximatedRun(source) ? `${core} (approx.)` : core;
}

/** Exact proof chrome only when the run is not an approximation. */
export function mayShowExactProofChrome(source: StochasticLabelSource): boolean {
  return !isApproximatedRun(source);
}

export function isExactClaimProofLabel(label: string | null | undefined): boolean {
  return (
    label === "full-objective-global-optimum" ||
    label === "globally-optimal" ||
    label === "search-objective-exhaustive"
  );
}

/**
 * Product proof chrome: residual / non-exact never shows Global optimum / Exhaustive.
 * Prefer over bare formatProofLabel at UI call sites.
 */
export function formatProofChrome(
  label: string | null | undefined,
  source?: StochasticLabelSource | null,
): string {
  const stoch = source ?? {};
  return formatProofLabel(label, {
    approximated: !mayShowExactProofChrome(stoch),
    residualWeight: stoch.rng?.residualWeight,
    exactness: stoch.rng?.exactness,
  });
}

/**
 * Assumption-panel rows for residual / exactness / failure.
 * Empty when there is nothing stochastic to disclose.
 * Optional live-cap opts add a Live branch cap row when residual remains.
 */
export function stochasticAssumptionRows(
  source: StochasticLabelSource,
  opts?: BranchCapDiagnosticsOpts,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const exactness = exactnessLabel(branchExactnessOf(source));
  if (exactness) rows.push(["Branch exactness", exactness]);

  const residual = residualWeightOf(source);
  if (residual > 0) rows.push(["Residual mass", formatPercentMass(residual)]);

  const concrete = concreteMassOf(source);
  if (residual > 0 && concrete > 0) {
    rows.push(["Concrete mass", formatPercentMass(concrete)]);
  }

  const maxLive = opts?.maxLiveBranches;
  if (residual > 0 && typeof maxLive === "number" && Number.isFinite(maxLive) && maxLive > 0) {
    rows.push(["Live branch cap", String(Math.floor(maxLive))]);
  }

  const basis = totalsBasisOf(source);
  if (basis === "concrete-terminals") {
    rows.push(["Totals basis", "Concrete terminals (E[D|concrete])"]);
  } else if (basis === "unit-mass") {
    rows.push(["Totals basis", "Unit mass"]);
  }

  const failed = failedWeightOf(source);
  if (failed > 0) {
    rows.push(["Failed path mass", formatPercentMass(failed)]);
    const success = successfulWeightOf(source);
    if (success > 0) rows.push(["Success path mass", formatPercentMass(success)]);
  }

  const scope = source.failure?.totalsScope ?? source.rng?.failure?.totalsScope;
  if (scope === "successful-branches-renormalized") {
    rows.push(["Totals scope", "Successful paths only (renormalized)"]);
  } else if (scope === "unconditional-all-mass") {
    rows.push([
      "Totals scope",
      residual > 0
        ? "Unconditional over concrete path mass (residual excluded)"
        : "Unconditional over concrete path mass",
    ]);
  } else if (scope === "none" && failed > 0) {
    rows.push(["Totals scope", "None (all paths failed)"]);
  }

  const reason = source.failure?.primaryReason ?? source.rng?.failure?.primaryReason;
  if (reason && failed > 0) rows.push(["Failure reason", reason]);

  return rows;
}
