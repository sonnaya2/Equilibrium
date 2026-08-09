import { describe, expect, it } from "vitest";
import {
  exactnessEligibleForExactProof,
  isNonExactStochasticExactness,
  isNonUnitMassTotalsBasis,
  MIN_RANKABLE_HORIZON_TICKS,
  OBJECTIVE_HORIZON_TICKS,
  OBJECTIVE_WINDOWS,
  objectiveWindowsForHorizon,
  resolveTotalsBasis,
  scoreFromDamageByTick,
  scoreSummary,
  sumDamageInTickRange,
  summaryEligibleForObjectiveScore,
  summaryObjectiveIneligibilityReason,
  windowDpmFromDamageByTick,
} from "./objective";

describe("objective windows", () => {
  it("uses half-open tick ranges opening/developed/steady", () => {
    expect(OBJECTIVE_WINDOWS.map((w) => [w.id, w.startTick, w.endTick])).toEqual([
      ["opening", 0, 100],
      ["developed", 100, 300],
      ["steady", 300, 500],
    ]);
  });

  it("counts a boundary tick only in the later window", () => {
    const ledger = { 99: 10, 100: 20, 299: 30, 300: 40, 499: 50, 500: 999 };
    expect(sumDamageInTickRange(ledger, 0, 100)).toBe(10);
    expect(sumDamageInTickRange(ledger, 100, 300)).toBe(20 + 30);
    expect(sumDamageInTickRange(ledger, 300, 500)).toBe(40 + 50);
    // tick 500 is outside the horizon half-open end
    expect(sumDamageInTickRange(ledger, 0, 500)).toBe(10 + 20 + 30 + 40 + 50);
  });

  it("scales open/mid/steady proportionally for a 30s (50-tick) horizon", () => {
    const w = objectiveWindowsForHorizon(MIN_RANKABLE_HORIZON_TICKS);
    expect(w.map((x) => [x.id, x.startTick, x.endTick])).toEqual([
      ["opening", 0, 10],
      ["developed", 10, 30],
      ["steady", 30, 50],
    ]);
    // Rankable short horizon scores (not hard-failed as insufficient).
    const s = scoreFromDamageByTick({ 5: 1000 }, "balanced", undefined, 50);
    expect(s.ok).toBe(true);
  });
});

describe("windowDpmFromDamageByTick", () => {
  it("converts window damage to DPM", () => {
    // 60s opening window, 6000 damage → 6000/60*60 = 6000 DPM
    expect(windowDpmFromDamageByTick({ 0: 6000 }, 0, 100)).toBe(6000);
    // 120s developed, 1200 damage → 600 DPM
    expect(windowDpmFromDamageByTick({ 100: 1200 }, 100, 300)).toBe(600);
  });
});

describe("scoreFromDamageByTick", () => {
  it("scores an empty ledger as zero", () => {
    const s = scoreFromDamageByTick({}, "balanced", undefined, OBJECTIVE_HORIZON_TICKS);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.openingDpm).toBe(0);
    expect(s.developedDpm).toBe(0);
    expect(s.steadyDpm).toBe(0);
    expect(s.minDpm).toBe(0);
    expect(s.weightedMean).toBe(0);
    expect(s.robustScore).toBe(0);
  });

  it("applies the balanced robust formula", () => {
    // Craft flat DPM per window via full-window damage:
    // opening 60s @ 1000 DPM → damage = 1000
    // developed 120s @ 2000 DPM → damage = 4000
    // steady 120s @ 3000 DPM → damage = 6000
    const damageByTick: Record<number, number> = {
      0: 1000,
      100: 4000,
      300: 6000,
    };
    const s = scoreFromDamageByTick(damageByTick, "balanced", undefined, OBJECTIVE_HORIZON_TICKS);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    expect(s.openingDpm).toBeCloseTo(1000);
    expect(s.developedDpm).toBeCloseTo(2000);
    expect(s.steadyDpm).toBeCloseTo(3000);
    // equal window weights → mean 2000; min 1000
    // robustScore = 2000 * 0.80 + 1000 * 0.20 = 1800
    expect(s.weightedMean).toBeCloseTo(2000);
    expect(s.minDpm).toBeCloseTo(1000);
    expect(s.robustScore).toBeCloseTo(1800);
  });

  it("rejects insufficient horizon below min rankable", () => {
    const s = scoreFromDamageByTick({ 0: 1 }, "balanced", undefined, 40);
    expect(s).toEqual({
      ok: false,
      reason: `insufficient horizon: need ${MIN_RANKABLE_HORIZON_TICKS} ticks, got 40`,
      robustScore: 0,
      profileId: "balanced",
    });
  });

  it("rejects invalid custom weights", () => {
    const s = scoreFromDamageByTick(
      {},
      "custom",
      {
        opening: 1,
        developed: 0,
        steady: 0,
        robustMean: 0,
        robustMin: 0,
      },
      OBJECTIVE_HORIZON_TICKS,
    );
    expect(s.ok).toBe(false);
    if (s.ok) return;
    expect(s.reason).toMatch(/robustMean \+ robustMin/);
  });
});

describe("scoreSummary", () => {
  it("rejects simulation errors", () => {
    const s = scoreSummary(
      { ok: false, error: "out of adrenaline", damageByTick: { 0: 999 } },
      "burst",
    );
    expect(s).toEqual({
      ok: false,
      reason: "out of adrenaline",
      robustScore: 0,
      profileId: "burst",
    });
  });

  it("rejects failedWeight > 0", () => {
    const s = scoreSummary(
      {
        ok: true,
        damageByTick: {},
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        rng: { failedWeight: 0.25 },
      },
      "sustained",
    );
    expect(s.ok).toBe(false);
    if (s.ok) return;
    expect(s.reason).toMatch(/failedWeight/);
    expect(s.robustScore).toBe(0);
  });

  it("rejects residualWeight > 0", () => {
    const s = scoreSummary(
      {
        ok: true,
        damageByTick: { 0: 1000 },
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        rng: { residualWeight: 0.1, exactness: "approximated" },
      },
      "sustained",
    );
    expect(s.ok).toBe(false);
    if (s.ok) return;
    expect(s.reason).toMatch(/residualWeight/);
    expect(s.robustScore).toBe(0);
    expect(
      summaryEligibleForObjectiveScore({
        ok: true,
        damageByTick: { 0: 1000 },
        rng: { residualWeight: 0.1 },
      }),
    ).toBe(false);
  });

  it("rejects approximated totals even when residualWeight is 0", () => {
    const exactness = "approximated";
    const s = scoreSummary(
      {
        ok: true,
        damageByTick: { 0: 1000 },
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        rng: { residualWeight: 0, exactness },
      },
      "balanced",
    );
    expect(s.ok).toBe(false);
    if (s.ok) return;
    expect(s.reason).toMatch(/exactness=approximated/);
    expect(isNonExactStochasticExactness(exactness)).toBe(true);
    expect(exactnessEligibleForExactProof(exactness)).toBe(false);
  });

  it("rejects concrete-terminals / known-mass-contribution totals basis (not unit-mass)", () => {
    for (const basis of ["concrete-terminals", "known-mass-contribution"] as const) {
      const viaRng = scoreSummary(
        {
          ok: true,
          damageByTick: { 0: 1000 },
          horizonTicks: OBJECTIVE_HORIZON_TICKS,
          rng: { residualWeight: 0, totalsBasis: basis, exactness: "exact" },
        },
        "balanced",
      );
      expect(viaRng.ok, `rng ${basis}`).toBe(false);
      if (viaRng.ok) return;
      expect(viaRng.reason).toMatch(new RegExp(`totalsBasis=${basis}`));
      expect(isNonUnitMassTotalsBasis(basis)).toBe(true);

      const viaDamage = scoreSummary(
        {
          ok: true,
          damageByTick: { 0: 1000 },
          horizonTicks: OBJECTIVE_HORIZON_TICKS,
          damage: { scope: basis },
          rng: { residualWeight: 0, exactness: "exact" },
        },
        "burst",
      );
      expect(viaDamage.ok, `damage.scope ${basis}`).toBe(false);
      if (viaDamage.ok) return;
      expect(viaDamage.reason).toMatch(new RegExp(`totalsBasis=${basis}`));
      expect(resolveTotalsBasis({ ok: true, damageByTick: {}, damage: { scope: basis } })).toBe(
        basis,
      );
      expect(
        summaryEligibleForObjectiveScore({
          ok: true,
          damageByTick: { 0: 1 },
          damage: { scope: basis },
        }),
      ).toBe(false);
    }
  });

  it("prefers damage.scope over rng.totalsBasis when both present", () => {
    const reason = summaryObjectiveIneligibilityReason({
      ok: true,
      damageByTick: { 0: 1 },
      damage: { scope: "concrete-terminals" },
      rng: { residualWeight: 0, totalsBasis: "unit-mass", exactness: "exact" },
    });
    expect(reason).toMatch(/totalsBasis=concrete-terminals/);
  });

  it("does not rank conditionalConcreteMean / knownMassExpectedDamage alone", () => {
    // Residual present: conditional diagnostics must not unlock scoring.
    const s = scoreSummary(
      {
        ok: true,
        damageByTick: { 0: 9999 },
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        totalExpected: 9999,
        conditionalConcreteMean: 9999,
        knownMassExpectedDamage: 1500,
        rng: {
          residualWeight: 0.4,
          concreteMass: 0.6,
          probabilityMass: 0.6,
          totalsBasis: "concrete-terminals",
          exactness: "approximated",
        },
        damage: {
          scope: "concrete-terminals",
          conditionalConcreteMean: 9999,
          knownMassExpectedDamage: 1500,
        },
      },
      "balanced",
    );
    expect(s.ok).toBe(false);
    if (s.ok) return;
    expect(s.reason).toMatch(/residualWeight/);
    expect(s.robustScore).toBe(0);
  });

  it("allows exact and missing exactness for scoring and exact proof", () => {
    for (const exactness of [undefined, "exact"] as const) {
      const s = scoreSummary(
        {
          ok: true,
          damageByTick: { 0: 6000 },
          horizonTicks: OBJECTIVE_HORIZON_TICKS,
          rng: exactness === undefined ? {} : { residualWeight: 0, exactness },
        },
        "burst",
      );
      expect(s.ok, String(exactness)).toBe(true);
      expect(exactnessEligibleForExactProof(exactness)).toBe(true);
    }
  });

  it("ranks a residual-free fixed-lane estimate without claiming exact proof", () => {
    const s = scoreSummary(
      {
        ok: true,
        damageByTick: { 0: 6000 },
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        rng: { residualWeight: 0, exactness: "estimated" },
      },
      "burst",
    );
    expect(s.ok).toBe(true);
    expect(exactnessEligibleForExactProof("estimated")).toBe(false);
  });

  it("allows unit-mass totalsBasis when residual is 0", () => {
    const s = scoreSummary(
      {
        ok: true,
        damageByTick: { 0: 6000 },
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        rng: { residualWeight: 0, totalsBasis: "unit-mass", exactness: "exact" },
        damage: { scope: "unit-mass" },
      },
      "burst",
    );
    expect(s.ok).toBe(true);
    expect(
      summaryEligibleForObjectiveScore({
        ok: true,
        damageByTick: {},
        rng: { residualWeight: 0, totalsBasis: "unit-mass", exactness: "exact" },
      }),
    ).toBe(true);
  });

  it("scores a successful summary from damageByTick", () => {
    const s = scoreSummary(
      {
        ok: true,
        horizonTicks: OBJECTIVE_HORIZON_TICKS,
        damageByTick: { 0: 6000 }, // 6000 DPM opening, 0 elsewhere
      },
      "burst",
    );
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    // burst: 0.70/0.20/0.10, robustMean 1, robustMin 0
    // weightedMean = 6000*0.7 + 0 + 0 = 4200; min=0; score=4200
    expect(s.openingDpm).toBeCloseTo(6000);
    expect(s.weightedMean).toBeCloseTo(4200);
    expect(s.robustScore).toBeCloseTo(4200);
  });
});
