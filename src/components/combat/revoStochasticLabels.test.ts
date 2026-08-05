import { describe, expect, it } from "vitest";
import { formatProofLabel } from "./revoPanelFormat";
import {
  branchExactnessOf,
  exactnessLabel,
  failedWeightOf,
  failureNote,
  formatPercentMass,
  formatProofChrome,
  isApproxExactness,
  isApproximatedRun,
  isExactClaimProofLabel,
  mayShowExactProofChrome,
  primaryDamageLabel,
  primaryDpsLabel,
  primaryExpectedLabel,
  primaryManualDpsLabel,
  residualNote,
  residualWeightOf,
  runDiagnosticsNote,
  runScoreBadge,
  shouldShowRunScoreChrome,
  stochasticAssumptionRows,
  successfulWeightOf,
  totalsAreSuccessConditional,
  totalsBasisOf,
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
      damage: { scope: "concrete-terminals" },
      rng: {
        residualWeight: 0.12,
        exactness: "bounded-approximation",
        probabilityMass: 0.88,
        concreteMass: 0.88,
        totalsBasis: "concrete-terminals",
      },
    };
    expect(residualWeightOf(source)).toBeCloseTo(0.12);
    expect(totalsBasisOf(source)).toBe("concrete-terminals");
    expect(isApproximatedRun(source)).toBe(true);
    expect(runScoreBadge(source)).toBe("Approximated");
    expect(mayShowExactProofChrome(source)).toBe(false);
    expect(primaryDamageLabel(source)).toBe("Damage (approx.)");
    expect(primaryDpsLabel(source)).toBe("Fixed-window DPS (approx.)");
    expect(residualNote(source)).toMatch(/12%/);
    expect(residualNote(source)).toMatch(/discarded by branch caps/);
    expect(residualNote(source)).toMatch(/kept paths only/);
    expect(residualNote(source)).toMatch(/concrete-terminal/);
    expect(residualNote(source)).toMatch(/not unit-mass EV/);
    expect(runDiagnosticsNote(source)).toContain("kept paths only");
    expect(stochasticAssumptionRows(source)).toContainEqual([
      "Totals basis",
      "Concrete terminals (E[D|concrete])",
    ]);
  });

  it("defaults residual without totalsBasis to known-mass-contribution (Phase 2)", () => {
    const source: StochasticLabelSource = {
      rng: { residualWeight: 0.2, exactness: "approximated", probabilityMass: 0.8 },
    };
    expect(totalsBasisOf(source)).toBe("known-mass-contribution");
    expect(residualNote(source)).toMatch(/known-mass contribution/);
    expect(residualNote(source)).toMatch(/not unit-mass EV/);
    expect(residualNote(source)).toMatch(/not the survivor-conditional mean/);
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
    expect(failureNote(source)).toMatch(/unconditional over concrete success and fail paths/);
    expect(failureNote(source)).not.toMatch(/unit-mass/);
    expect(failureNote(source)).not.toMatch(/renormalized over successful paths/);
  });

  it("residual + unconditional-all-mass never claims unit-mass EV", () => {
    const source: StochasticLabelSource = {
      damage: { scope: "concrete-terminals" },
      failure: {
        failedWeight: 0.1,
        successfulWeight: 0.7,
        totalsScope: "unconditional-all-mass",
        primaryReason: "starved",
      },
      rng: {
        residualWeight: 0.2,
        concreteMass: 0.8,
        probabilityMass: 0.8,
        totalsBasis: "concrete-terminals",
        exactness: "approximated",
      },
    };
    const residual = residualNote(source)!;
    const failure = failureNote(source)!;
    const note = runDiagnosticsNote(source)!;
    expect(totalsBasisOf(source)).toBe("concrete-terminals");
    expect(residual).toMatch(/not unit-mass EV/);
    expect(residual).toMatch(/kept paths only/);
    expect(failure).toMatch(/concrete success and fail/);
    expect(failure).toMatch(/residual excluded/);
    expect(failure).toMatch(/not unit-mass EV/);
    expect(failure).not.toMatch(/all path mass/);
    expect(note).toContain(residual);
    expect(note).toContain(failure);
    const rows = stochasticAssumptionRows(source);
    expect(rows).toContainEqual(["Residual mass", "20%"]);
    expect(rows).toContainEqual(["Concrete mass", "80%"]);
    expect(rows).toContainEqual([
      "Totals basis",
      "Concrete terminals (E[D|concrete])",
    ]);
    expect(rows).toContainEqual([
      "Totals scope",
      "Unconditional over concrete path mass (residual excluded)",
    ]);
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

    const concreteRows = stochasticAssumptionRows({
      failure: {
        failedWeight: 0.3,
        successfulWeight: 0.65,
        totalsScope: "unconditional-all-mass",
        primaryReason: "unpayable",
      },
      rng: { residualWeight: 0.05, probabilityMass: 0.95, exactness: "approximated" },
    });
    expect(concreteRows).toContainEqual([
      "Totals scope",
      "Unconditional over concrete path mass (residual excluded)",
    ]);
    expect(concreteRows).toContainEqual(["Concrete mass", "95%"]);
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

  it("formatProofChrome demotes exact claims when residual-tainted", () => {
    const residual: StochasticLabelSource = {
      rng: { residualWeight: 0.08, exactness: "bounded-approximation" },
    };
    expect(mayShowExactProofChrome(residual)).toBe(false);
    expect(formatProofChrome("full-objective-global-optimum", residual)).toBe("Approximated");
    expect(formatProofChrome("globally-optimal", residual)).toBe("Approximated");
    expect(formatProofChrome("search-objective-exhaustive", residual)).toBe("Approximated");
    expect(formatProofChrome("heuristic-best-found", residual)).toBe("Best found");
    expect(formatProofChrome("full-shortlist-best", residual)).toBe("Shortlist best");

    // Product solver call-site shape: DTO with proofLabel + rng.
    const dtoLike = {
      proofLabel: "full-objective-global-optimum" as const,
      rng: { residualWeight: 0.01, exactness: "approximated" },
    };
    expect(formatProofChrome(dtoLike.proofLabel, dtoLike)).toBe("Approximated");
    // Nested summary.rng merged to StochasticLabelSource (RevoSolverSection).
    expect(
      formatProofChrome("full-objective-global-optimum", {
        rng: { residualWeight: 0.02, exactness: "truncated" },
      }),
    ).toBe("Approximated");
    expect(formatProofChrome("full-objective-global-optimum", {})).toBe("Global optimum");
    expect(formatProofChrome("full-objective-global-optimum", null)).toBe("Global optimum");
    expect(formatProofChrome("full-objective-global-optimum")).toBe("Global optimum");
    expect(mayShowExactProofChrome({})).toBe(true);
  });

  it("shows score chrome for partial-fail and residual even when ok is false", () => {
    expect(shouldShowRunScoreChrome(null)).toBe(false);
    expect(shouldShowRunScoreChrome({})).toBe(false);
    expect(shouldShowRunScoreChrome({ ok: true })).toBe(true);

    // Hard fail with nothing banked: hide strip (error path only).
    expect(
      shouldShowRunScoreChrome({
        ok: false,
        totalExpected: 0,
        failure: {
          failedWeight: 0,
          successfulWeight: 0,
          totalsScope: "none",
          primaryReason: "empty queue",
        },
      }),
    ).toBe(false);

    // Live partial failure: ok false but failed mass present.
    const partialFail: StochasticLabelSource = {
      ok: false,
      totalExpected: 1200,
      failure: {
        failedWeight: 0.4,
        successfulWeight: 0.6,
        totalsScope: "unconditional-all-mass",
        primaryReason: "unpayable assault",
      },
    };
    expect(shouldShowRunScoreChrome(partialFail)).toBe(true);
    expect(runScoreBadge(partialFail)).toBeNull();
    expect(primaryExpectedLabel(partialFail)).toBe("Expected");
    expect(primaryManualDpsLabel(partialFail)).toBe("Natural DPS");
    expect(runDiagnosticsNote(partialFail)).toMatch(/40%/);
    expect(runDiagnosticsNote(partialFail)).toMatch(/unconditional over concrete/);

    // Residual-only (often still ok true) must show approx chrome + strip.
    const residualOnly: StochasticLabelSource = {
      ok: true,
      totalExpected: 900,
      rng: { residualWeight: 0.15, exactness: "approximated", probabilityMass: 0.85 },
      metric: { type: "natural-completion" },
    };
    expect(shouldShowRunScoreChrome(residualOnly)).toBe(true);
    expect(runScoreBadge(residualOnly)).toBe("Approximated");
    expect(primaryExpectedLabel(residualOnly)).toBe("Expected (approx.)");
    expect(primaryManualDpsLabel(residualOnly)).toBe("Expected natural DPS (approx.)");
    expect(runDiagnosticsNote(residualOnly)).toMatch(/15%/);
    expect(runDiagnosticsNote(residualOnly)).toMatch(/known-mass contribution/);
    expect(runDiagnosticsNote(residualOnly)).toMatch(/not unit-mass EV/);
    expect(runDiagnosticsNote(residualOnly)).toMatch(/not the survivor-conditional mean/);
    expect(totalsBasisOf(residualOnly)).toBe("known-mass-contribution");

    // ok false + residual only (no failure block) still shows strip.
    expect(
      shouldShowRunScoreChrome({
        ok: false,
        totalExpected: 0,
        rng: { residualWeight: 0.08, exactness: "truncated" },
      }),
    ).toBe(true);

    // Combined residual + partial fail (manual planner path labels).
    const combined: StochasticLabelSource = {
      ok: false,
      totalExpected: 500,
      failure: {
        failedWeight: 0.25,
        successfulWeight: 0.55,
        totalsScope: "unconditional-all-mass",
        primaryReason: "starved",
      },
      rng: {
        residualWeight: 0.2,
        exactness: "bounded-approximation",
        probabilityMass: 0.8,
      },
      metric: { type: "natural-completion" },
    };
    expect(shouldShowRunScoreChrome(combined)).toBe(true);
    expect(runScoreBadge(combined)).toBe("Approximated");
    expect(primaryExpectedLabel(combined)).toBe("Expected (approx.)");
    expect(primaryManualDpsLabel(combined)).toBe("Expected natural DPS (approx.)");
    const note = runDiagnosticsNote(combined)!;
    expect(note).toMatch(/discarded by branch caps/);
    expect(note).toMatch(/25%/);
    expect(note).toMatch(/concrete success and fail/);
    expect(note).not.toMatch(/renormalized over successful paths/);
  });

  it("manual fixed-window DPS labels reuse revo wording", () => {
    const source: StochasticLabelSource = {
      metric: { type: "fixed-window" },
      rng: { residualWeight: 0.1, exactness: "approximated" },
    };
    expect(primaryManualDpsLabel(source)).toBe("Fixed-window DPS (approx.)");
    expect(primaryManualDpsLabel({ metric: { type: "fixed-window" } })).toBe(
      "Fixed-window DPS",
    );
    expect(primaryExpectedLabel({})).toBe("Expected");
    expect(
      primaryExpectedLabel({
        failure: {
          failedWeight: 0.5,
          successfulWeight: 0.5,
          totalsScope: "successful-branches-renormalized",
        },
      }),
    ).toBe("Expected (success paths)");
  });
});
