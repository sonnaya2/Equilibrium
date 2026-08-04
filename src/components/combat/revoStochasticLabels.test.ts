import { describe, expect, it } from "vitest";
import { formatProofLabel } from "./revoPanelFormat";
import {
  branchExactnessOf,
  exactnessLabel,
  failedWeightOf,
  failureNote,
  formatPercentMass,
  isApproxExactness,
  isApproximatedRun,
  isExactClaimProofLabel,
  mayShowExactProofChrome,
  primaryDamageLabel,
  primaryDpsLabel,
  residualNote,
  residualWeightOf,
  runDiagnosticsNote,
  runScoreBadge,
  stochasticAssumptionRows,
  successfulWeightOf,
  totalsAreSuccessConditional,
  type StochasticLabelSource,
} from "./revoStochasticLabels";

describe("revoStochasticLabels", () => {
  it("treats missing residual/exactness as ordinary exact", () => {
    const empty: StochasticLabelSource = {};
    expect(residualWeightOf(empty)).toBe(0);
    expect(failedWeightOf(empty)).toBe(0);
    expect(isApproximatedRun(empty)).toBe(false);
    expect(runScoreBadge(empty)).toBeNull();
    expect(runDiagnosticsNote(empty)).toBeNull();
    expect(primaryDamageLabel(empty)).toBe("Damage");
    expect(primaryDpsLabel(empty)).toBe("Fixed-window DPS");
    expect(mayShowExactProofChrome(empty)).toBe(true);
    expect(stochasticAssumptionRows(empty)).toEqual([]);
  });

  it("flags residual mass as Approximated and writes a residual note", () => {
    const source: StochasticLabelSource = {
      rng: { residualWeight: 0.12, exactness: "bounded-approximation", probabilityMass: 0.88 },
    };
    expect(residualWeightOf(source)).toBeCloseTo(0.12);
    expect(isApproximatedRun(source)).toBe(true);
    expect(runScoreBadge(source)).toBe("Approximated");
    expect(mayShowExactProofChrome(source)).toBe(false);
    expect(primaryDamageLabel(source)).toBe("Damage (approx.)");
    expect(primaryDpsLabel(source)).toBe("Fixed-window DPS (approx.)");
    expect(residualNote(source)).toMatch(/12%/);
    expect(residualNote(source)).toMatch(/discarded by branch caps/);
    expect(runDiagnosticsNote(source)).toContain("kept paths only");
  });

  it("flags approx exactness without residualWeight", () => {
    for (const exactness of [
      "approximated",
      "bounded-approximation",
      "truncated",
      "resampled",
    ] as const) {
      expect(isApproxExactness(exactness)).toBe(true);
      expect(isApproximatedRun({ rng: { exactness } })).toBe(true);
      expect(runScoreBadge({ rng: { exactness } })).toBe("Approximated");
    }
    expect(isApproxExactness("exact")).toBe(false);
    expect(isApproxExactness("merged-exactly")).toBe(false);
    expect(isApproxExactness(undefined)).toBe(false);
  });

  it("does not treat live unconditional-all-mass partial failure as success-conditional", () => {
    const source: StochasticLabelSource = {
      failure: {
        failedWeight: 0.95,
        successfulWeight: 0.05,
        totalsScope: "unconditional-all-mass",
        primaryReason: "unpayable assault",
      },
    };
    expect(totalsAreSuccessConditional(source)).toBe(false);
    expect(runScoreBadge(source)).toBeNull();
    expect(primaryDamageLabel(source)).toBe("Damage");
    expect(primaryDpsLabel(source)).toBe("Fixed-window DPS");
    expect(failureNote(source)).toMatch(/95%/);
    expect(failureNote(source)).toMatch(/unconditional over all path mass/);
    expect(failureNote(source)).not.toMatch(/renormalized over successful paths/);
  });

  it("labels legacy success-renormalized totals without calling them ordinary DPS", () => {
    const source: StochasticLabelSource = {
      failure: {
        failedWeight: 0.8,
        successfulWeight: 0.2,
        totalsScope: "successful-branches-renormalized",
        primaryReason: "unpayable assault",
      },
    };
    expect(totalsAreSuccessConditional(source)).toBe(true);
    expect(isApproximatedRun(source)).toBe(false);
    expect(runScoreBadge(source)).toBe("Conditional");
    expect(primaryDamageLabel(source)).toBe("Damage (success paths)");
    expect(primaryDpsLabel(source)).toBe("DPS (success paths)");
    expect(failureNote(source)).toMatch(/80%/);
    expect(failureNote(source)).toMatch(/renormalized over successful paths/);
    expect(failureNote(source)).toMatch(/20% success mass/);
  });

  it("prefers Approximated over Conditional when residual and failure both present", () => {
    const source: StochasticLabelSource = {
      failure: {
        failedWeight: 0.1,
        successfulWeight: 0.7,
        totalsScope: "successful-branches-renormalized",
        primaryReason: "starved",
      },
      rng: {
        residualWeight: 0.2,
        exactness: "bounded-approximation",
        failure: {
          failedWeight: 0.1,
          successfulWeight: 0.7,
          totalsScope: "successful-branches-renormalized",
          primaryReason: "starved",
        },
      },
    };
    expect(runScoreBadge(source)).toBe("Approximated");
    expect(primaryDamageLabel(source)).toBe("Damage (success paths)");
    const note = runDiagnosticsNote(source);
    expect(note).toMatch(/discarded by branch caps/);
    expect(note).toMatch(/renormalized over successful paths/);
  });

  it("reads failedWeight from rng legacy field and nested failure", () => {
    expect(failedWeightOf({ rng: { failedWeight: 0.25 } })).toBeCloseTo(0.25);
    expect(
      failedWeightOf({
        rng: { failure: { failedWeight: 0.4, successfulWeight: 0.6, totalsScope: "none" } },
      }),
    ).toBeCloseTo(0.4);
    expect(successfulWeightOf({ failure: { successfulWeight: 0.55 } })).toBeCloseTo(0.55);
  });

  it("formats mass percents compactly", () => {
    expect(formatPercentMass(0.5)).toBe("50%");
    expect(formatPercentMass(0.123)).toBe("12%");
    expect(formatPercentMass(0.083)).toBe("8.3%");
    expect(formatPercentMass(0.004)).toBe("0.40%");
  });

  it("maps exactness labels and assumption rows", () => {
    expect(exactnessLabel("exact")).toBe("Exact");
    expect(exactnessLabel("merged-exactly")).toBe("Exact merge");
    expect(exactnessLabel("bounded-approximation")).toBe("Bounded approximation");
    expect(exactnessLabel(undefined)).toBeNull();

    const rows = stochasticAssumptionRows({
      failure: {
        failedWeight: 0.3,
        successfulWeight: 0.7,
        totalsScope: "successful-branches-renormalized",
        primaryReason: "unpayable",
      },
      rng: {
        residualWeight: 0.05,
        exactness: "truncated",
      },
    });
    expect(rows).toContainEqual(["Branch exactness", "Truncated"]);
    expect(rows).toContainEqual(["Residual mass", "5.0%"]);
    expect(rows).toContainEqual(["Failed path mass", "30%"]);
    expect(rows).toContainEqual(["Success path mass", "70%"]);
    expect(rows).toContainEqual(["Totals scope", "Successful paths only (renormalized)"]);
    expect(rows).toContainEqual(["Failure reason", "unpayable"]);
    expect(branchExactnessOf({ rng: { exactness: "truncated" } })).toBe("truncated");
  });

  it("suppresses exact proof chrome wording when approximated", () => {
    expect(isExactClaimProofLabel("full-objective-global-optimum")).toBe(true);
    expect(isExactClaimProofLabel("search-objective-exhaustive")).toBe(true);
    expect(isExactClaimProofLabel("heuristic-best-found")).toBe(false);

    expect(
      formatProofLabel("full-objective-global-optimum", { approximated: true }),
    ).toBe("Approximated");
    expect(formatProofLabel("search-objective-exhaustive", { approximated: true })).toBe(
      "Approximated",
    );
    expect(formatProofLabel("full-objective-global-optimum")).toBe("Global optimum");
    expect(formatProofLabel("heuristic-best-found", { approximated: true })).toBe("Best found");
  });
});
