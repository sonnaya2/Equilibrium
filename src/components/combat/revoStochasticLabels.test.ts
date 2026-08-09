import { describe, expect, it } from "vitest";
import {
  failureNote,
  formatProofChrome,
  isApproximatedRun,
  primaryDamageLabel,
  residualNote,
  runScoreBadge,
  stochasticAssumptionRows,
  stochasticExactnessOf,
  type StochasticLabelSource,
} from "./revoStochasticLabels";

describe("revoStochasticLabels", () => {
  it("discloses the fixed-lane estimate without claiming discarded mass", () => {
    const source: StochasticLabelSource = {
      ok: true,
      rng: {
        exactness: "estimated",
        probabilityMass: 1,
        concreteMass: 1,
        residualWeight: 0,
        totalsBasis: "unit-mass",
      },
    };

    expect(stochasticExactnessOf(source)).toBe("estimated");
    expect(isApproximatedRun(source)).toBe(true);
    expect(runScoreBadge(source)).toBe("Approximated");
    expect(primaryDamageLabel(source)).toBe("Damage (approx.)");
    expect(residualNote(source)).toBeNull();
    expect(stochasticAssumptionRows(source)).toContainEqual([
      "Stochastic model",
      "Fixed-lane estimate",
    ]);
  });

  it("keeps defensive residual and failed-path disclosure generic", () => {
    const source: StochasticLabelSource = {
      rng: { residualWeight: 0.1 },
      failure: {
        failedWeight: 0.2,
        successfulWeight: 0.8,
        totalsScope: "unconditional-all-mass",
        primaryReason: "cast failed",
      },
    };

    expect(residualNote(source)).toBe("10% mass not expanded.");
    expect(failureNote(source)).toMatch(/20% paths failed/);
  });

  it("suppresses exact proof wording for estimated runs", () => {
    expect(
      formatProofChrome("full-objective-global-optimum", {
        rng: { exactness: "estimated" },
      }),
    ).not.toMatch(/Global optimum/i);
  });
});
