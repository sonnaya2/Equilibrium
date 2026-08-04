/**
 * Labels for stochastic / residual / failure metadata on rotation results.
 * residualWeight + exactness may be absent until branch-cap engine work lands;
 * helpers tolerate missing fields via optional chaining.
 */

const MASS_EPS = 1e-12;

/** Structural view; does not require engine types to already carry residual/exactness. */
export type StochasticLabelSource = {
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
    probabilityMass?: number;
    failure?: {
      failedWeight?: number;
      successfulWeight?: number;
      totalsScope?: string;
      primaryReason?: string;
    };
  } | null;
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
    source.failure?.failedWeight ??
      source.rng?.failure?.failedWeight ??
      source.rng?.failedWeight,
  );
  return w > MASS_EPS ? w : 0;
}

export function successfulWeightOf(source: StochasticLabelSource): number {
  return finiteMass(
    source.failure?.successfulWeight ?? source.rng?.failure?.successfulWeight,
  );
}

export function branchExactnessOf(source: StochasticLabelSource): string | undefined {
  const ex = source.rng?.exactness;
  return typeof ex === "string" && ex.length > 0 ? ex : undefined;
}

/** Cap / sample approximations - not exact branch expansion. */
export function isApproxExactness(exactness: string | null | undefined): boolean {
  return (
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
 * Engine renormalized totals over successful branches only.
 * Those numbers are not ordinary unconditional expected damage/DPS.
 */
export function totalsAreSuccessConditional(source: StochasticLabelSource): boolean {
  const scope = source.failure?.totalsScope ?? source.rng?.failure?.totalsScope;
  if (scope === "successful-branches-renormalized") return true;
  const failed = failedWeightOf(source);
  const success = successfulWeightOf(source);
  return failed > 0 && success > 0;
}

/** Short chrome next to primary score; null when ordinary exact EV. */
export function runScoreBadge(
  source: StochasticLabelSource,
): "Approximated" | "Conditional" | null {
  if (isApproximatedRun(source)) return "Approximated";
  if (totalsAreSuccessConditional(source)) return "Conditional";
  return null;
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

export function residualNote(source: StochasticLabelSource): string | null {
  const residual = residualWeightOf(source);
  if (residual <= 0) return null;
  return `${formatPercentMass(residual)} of probability mass was discarded by branch caps; damage and DPS cover the kept paths only.`;
}

export function failureNote(source: StochasticLabelSource): string | null {
  const failed = failedWeightOf(source);
  if (failed <= 0) return null;
  if (totalsAreSuccessConditional(source)) {
    const success = successfulWeightOf(source);
    const successBit =
      success > 0 ? ` (${formatPercentMass(success)} success mass)` : "";
    return `${formatPercentMass(failed)} of paths failed${successBit}; damage and DPS are renormalized over successful paths only.`;
  }
  const reason = source.failure?.primaryReason ?? source.rng?.failure?.primaryReason;
  return reason
    ? `${formatPercentMass(failed)} of paths failed (${reason}).`
    : `${formatPercentMass(failed)} of paths failed.`;
}

/** Combined note under the primary stat strip. */
export function runDiagnosticsNote(source: StochasticLabelSource): string | null {
  const parts = [residualNote(source), failureNote(source)].filter(
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
 * Assumption-panel rows for residual / exactness / failure.
 * Empty when there is nothing stochastic to disclose.
 */
export function stochasticAssumptionRows(
  source: StochasticLabelSource,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const exactness = exactnessLabel(branchExactnessOf(source));
  if (exactness) rows.push(["Branch exactness", exactness]);

  const residual = residualWeightOf(source);
  if (residual > 0) rows.push(["Residual mass", formatPercentMass(residual)]);

  const failed = failedWeightOf(source);
  if (failed > 0) {
    rows.push(["Failed path mass", formatPercentMass(failed)]);
    const success = successfulWeightOf(source);
    if (success > 0) rows.push(["Success path mass", formatPercentMass(success)]);
  }

  const scope = source.failure?.totalsScope ?? source.rng?.failure?.totalsScope;
  if (scope === "successful-branches-renormalized") {
    rows.push(["Totals scope", "Successful paths only (renormalized)"]);
  } else if (scope === "none" && failed > 0) {
    rows.push(["Totals scope", "None (all paths failed)"]);
  }

  const reason = source.failure?.primaryReason ?? source.rng?.failure?.primaryReason;
  if (reason && failed > 0) rows.push(["Failure reason", reason]);

  return rows;
}
