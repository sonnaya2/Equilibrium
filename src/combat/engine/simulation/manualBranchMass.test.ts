/**
 * Manual rotation branch mass: conservation, residual disclosure, failed-weight honesty.
 * Primary totals are unconditional-all-mass when any path succeeds.
 */
import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import { rotationOf, type RotationSummary } from "./contracts";
import { simulate } from "./simulate";
import { isNearOne, PROB_TOLERANCE } from "./stats";

/** Concrete terminals + residual (unexpanded cap discards). Together ~1. */
function conservedMass(s: RotationSummary): number {
  const rng = s.rng;
  if (!rng) return 1;
  return rng.probabilityMass + (rng.residualWeight ?? 0);
}

describe("manual branch mass conservation", () => {
  it("Impatient only: probability mass ~1", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf("attack", "attack", "attack", "attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng).toBeDefined();
    expect(isNearOne(conservedMass(s))).toBe(true);
    expect(s.rng!.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(s.rng!.exactness).toBe("exact");
    expect(s.failure).toBeUndefined();
    expect(s.rng!.failedClasses).toBe(0);
    expect(s.rng!.successfulClasses).toBe(s.rng!.terminalClasses);
  });

  it("Relentless only: probability mass ~1 (including partial failure)", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault", "assault"),
    });
    expect(s.ok).toBe(false);
    expect(s.rng).toBeDefined();
    expect(isNearOne(conservedMass(s))).toBe(true);
    expect(s.rng!.residualWeight).toBeLessThanOrEqual(PROB_TOLERANCE);
    expect(s.failure!.failedWeight + s.failure!.successfulWeight).toBeCloseTo(
      s.rng!.probabilityMass,
      10,
    );
    expect(s.failure!.failedWeight).toBeCloseTo(0.95, 10);
    expect(s.failure!.successfulWeight).toBeCloseTo(0.05, 10);
  });

  it("Impatient + Relentless together: concrete + residual mass ~1", () => {
    const cycle = ["attack", "attack", "attack", "attack", "assault"];
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4, relentlessRank: 5 },
      rotation: rotationOf(...Array.from({ length: 4 }, () => cycle).flat()),
    });
    expect(s.rng).toBeDefined();
    expect(isNearOne(conservedMass(s))).toBe(true);
    // Live cap may leave residual; it is disclosed, not folded into success/fail.
    expect(s.rng!.residualWeight).toBeGreaterThanOrEqual(0);
    if (s.rng!.residualWeight > PROB_TOLERANCE) {
      expect(s.rng!.exactness).toBe("approximated");
      expect(s.rng!.probabilityMass).toBeLessThan(1);
    }
    const failed = s.failure?.failedWeight ?? 0;
    const successful = s.failure?.successfulWeight ?? s.rng!.probabilityMass;
    expect(failed + successful).toBeCloseTo(s.rng!.probabilityMass, 8);
    // Residual is neither success nor failure.
    expect(failed + successful + s.rng!.residualWeight).toBeCloseTo(conservedMass(s), 8);
  });
});

describe("manual branch failed probability preserved", () => {
  it("failed weight stays failed (not absorbed into success)", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault", "assault"),
    });
    expect(s.ok).toBe(false);
    expect(s.failure).toBeDefined();
    expect(s.failure!.failedWeight).toBeCloseTo(0.95, 10);
    expect(s.failure!.successfulWeight).toBeCloseTo(0.05, 10);
    expect(s.failure!.successfulWeight).toBeLessThan(0.5);
    expect(s.failure!.failedWeight).toBeGreaterThan(s.failure!.successfulWeight);
    expect(s.rng?.failedWeight).toBeCloseTo(s.failure!.failedWeight, 10);
    expect(s.failure!.failedWeight + s.failure!.successfulWeight).toBeCloseTo(
      s.rng!.probabilityMass,
      10,
    );
  });

  it("failed mass never becomes successful; primary is unconditional", () => {
    const s = simulate({
      ...baseInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault", "assault"),
    });
    expect(s.failure!.totalsScope).toBe("unconditional-all-mass");
    // History prefers successful class for display; primary is not success-only.
    expect(s.history.selectionReason).toBe("highest-successful-mass");
    expect(s.history.classWeight).toBeCloseTo(s.failure!.successfulWeight, 10);
    expect(s.totalExpected).toBeGreaterThan(0);
    expect(s.failure!.conditionalOnSuccessExpectedDamage).toBeDefined();
    expect(s.failure!.failedPathExpectedDamage).toBeDefined();
    // Unconditional primary E[D] is below success-conditional (failed banks less).
    expect(s.totalExpected).toBeLessThan(s.failure!.conditionalOnSuccessExpectedDamage!);
    expect(s.dps).toBeCloseTo(s.dpsDetail.primary, 10);
    expect(Number.isFinite(s.dpsDetail.primary)).toBe(true);
    expect(s.dpsDetail.primary).toBeGreaterThan(0);
    // Failed weight stays disclosed separately.
    expect(s.failure!.failedWeight).toBeCloseTo(0.95, 10);
  });

  it("residual disclosed when present; never counted as success", () => {
    const cycle = ["attack", "attack", "attack", "attack", "assault"];
    const s = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4, relentlessRank: 5 },
      rotation: rotationOf(...Array.from({ length: 6 }, () => cycle).flat()),
    });
    expect(s.rng).toBeDefined();
    expect(isNearOne(conservedMass(s))).toBe(true);
    const residual = s.rng!.residualWeight;
    const failed = s.failure?.failedWeight ?? 0;
    const successful =
      s.failure?.successfulWeight ??
      (s.ok ? s.rng!.probabilityMass : Math.max(0, s.rng!.probabilityMass - failed));
    // Residual is unexpanded measure - not success, not failure.
    expect(failed + successful).toBeCloseTo(s.rng!.probabilityMass, 8);
    expect(failed + successful + residual).toBeCloseTo(1, 8);
    if (residual > PROB_TOLERANCE) {
      expect(s.rng!.exactness).toBe("approximated");
    }
  });

  it("all-failed keeps failedWeight 1 and success 0", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(false);
    expect(s.failure?.failedWeight).toBe(1);
    expect(s.failure?.successfulWeight).toBe(0);
    expect(s.failure?.totalsScope).toBe("none");
    expect(s.totalExpected).toBe(0);
    expect(Number.isFinite(s.dpsDetail.primary)).toBe(true);
    expect(s.dpsDetail.primary).toBe(0);
  });
});
