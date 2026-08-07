/**
 * REPRO (Phase 2 progress) - real engine residual mass + evaluate path.
 *
 * Dual Leng + Icy Tempest + Impatient 4 L20 + Relentless 5 L20.
 * Residual is live-branch-cap discard (MAX_LIVE_BRANCHES=64), not a mock.
 *
 * Phase 2: short explore no longer ranks residual conditional means.
 * Do not weaken residual honesty engine tests.
 *
 * Run:
 *   npx vitest run src/combat/solver/repro/survivorBiasEngine.repro.test.ts
 *   npx vitest run src/combat/solver/repro
 */
import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { TICK_SECONDS } from "../../core/ticks";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { buildCandidatePool } from "../candidatePool";
import { evaluateRevolutionBar } from "../evaluate";
import { budgetForLiveCap } from "../branchFidelity";
import { MIN_RANKABLE_HORIZON_TICKS, scoreSummary } from "../objective";
import {
  measureResidualStats,
  residualStatsFromSummary,
  survivorBiasExtremeFixture,
  survivorBiasPrimaryFixture,
  SURVIVOR_BIAS_BAR_IDS,
} from "./survivorBiasRanking.repro";

function exploratoryDpm(totalExpected: number, ticks: number): number {
  const minutes = (ticks * TICK_SECONDS) / 60;
  return minutes > 0 ? totalExpected / minutes : 0;
}

describe("REPRO: real engine residual mass (Leng+Impatient+Relentless)", () => {
  let cachedPrimary: ReturnType<typeof measureResidualStats> | undefined;
  const primaryStats = () =>
    (cachedPrimary ??= measureResidualStats(survivorBiasPrimaryFixture(), {
      detailLevel: "score-only",
    }));

  it("primary fixture has residual fraction >= 0.5 and concrete-terminals basis", () => {
    const stats = primaryStats();
    console.warn(
      "[engine residual PRIMARY]",
      JSON.stringify(
        {
          label: stats.label,
          ok: stats.ok,
          concreteMass: stats.concreteMass,
          residualWeight: stats.residualWeight,
          residualFraction: stats.residualFraction,
          totalsBasis: stats.totalsBasis,
          exactness: stats.exactness,
          totalExpected_conditional: stats.totalExpected,
          knownMassDamage: stats.knownMassDamage,
          survivorRenormFactor: stats.survivorRenormFactor,
          terminalClasses: stats.terminalClasses,
          failedWeight: stats.failedWeight,
          dps: stats.dps,
        },
        null,
        2,
      ),
    );

    expect(stats.ok).toBe(true);
    expect(stats.residualFraction).toBeGreaterThanOrEqual(0.5);
    expect(stats.concreteMass + stats.residualWeight).toBeCloseTo(1, 8);
    expect(["concrete-terminals", "known-mass-contribution"]).toContain(stats.totalsBasis);
    // Phase 2: totalExpected is known-mass contribution under residual (not conditional * mass again).
    expect(stats.knownMassDamage).toBeCloseTo(stats.totalExpected, 4);
    expect(stats.knownMassDamage).toBeCloseTo(
      stats.conditionalConcreteMean * stats.concreteMass,
      4,
    );

    const scored = scoreSummary(
      {
        ok: true,
        damageByTick: stats.summary.damageByTick ?? {},
        horizonTicks: 100,
        rng: {
          residualWeight: stats.residualWeight,
          exactness: stats.exactness,
        },
      },
      "balanced",
    );
    expect(scored.ok).toBe(false);
    if (!scored.ok) expect(scored.reason).toMatch(/residualWeight/);
  });

  it("extreme fixture residual fraction is higher than primary", () => {
    const primary = primaryStats();
    const extreme = measureResidualStats(survivorBiasExtremeFixture());
    console.warn(
      "[engine residual EXTREME]",
      JSON.stringify(
        {
          concreteMass: extreme.concreteMass,
          residualWeight: extreme.residualWeight,
          residualFraction: extreme.residualFraction,
          totalExpected_conditional: extreme.totalExpected,
          knownMassDamage: extreme.knownMassDamage,
        },
        null,
        2,
      ),
    );
    expect(extreme.residualFraction).toBeGreaterThan(primary.residualFraction);
    expect(extreme.residualFraction).toBeGreaterThan(0.5);
  }, 15_000);

  it("same bar without Impatient/Relentless is residual-free at the first sufficient cap", () => {
    const fx = survivorBiasPrimaryFixture();
    const clean = simulateRevolution(
      {
        ...fx.revoInput,
        adrenaline: undefined,
      },
      {
        detailLevel: "score-only",
        branchBudget: budgetForLiveCap(128, 1e-12),
      },
    );
    const stats = residualStatsFromSummary("user-no-rng-perks", clean);
    console.warn(
      "[engine residual USER CLEAN]",
      JSON.stringify(
        {
          concreteMass: stats.concreteMass,
          residualWeight: stats.residualWeight,
          residualFraction: stats.residualFraction,
          totalsBasis: stats.totalsBasis,
          totalExpected: stats.totalExpected,
          knownMassDamage: stats.knownMassDamage,
          dps: stats.dps,
          ok: stats.ok,
        },
        null,
        2,
      ),
    );
    expect(stats.ok).toBe(true);
    expect(stats.residualWeight).toBeLessThan(1e-9);
    expect(stats.totalsBasis).toBe("unit-mass");
  });

  it("evaluate short path: residual proposed non-rankable; full fails residual; user full better", () => {
    const fx = survivorBiasPrimaryFixture();
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "dualwield",
      equipmentIds: fx.revoInput.equipmentIds,
    });
    const searchTicks = 40;
    expect(searchTicks).toBeLessThan(MIN_RANKABLE_HORIZON_TICKS);

    const proposedShort = evaluateRevolutionBar({
      bar: [...SURVIVOR_BIAS_BAR_IDS],
      style: "melee",
      durationTicks: searchTicks,
      pool,
      sim: fx.revoInput,
      profileId: "balanced",
      detailLevel: "score-only",
      size: { min: 2, max: 8 },
    });
    const userShort = evaluateRevolutionBar({
      bar: [...SURVIVOR_BIAS_BAR_IDS],
      style: "melee",
      durationTicks: searchTicks,
      pool,
      sim: { ...fx.revoInput, adrenaline: undefined },
      profileId: "balanced",
      detailLevel: "score-only",
      size: { min: 2, max: 8 },
    });

    const proposedFull = evaluateRevolutionBar({
      bar: [...SURVIVOR_BIAS_BAR_IDS],
      style: "melee",
      durationTicks: 100,
      pool,
      sim: fx.revoInput,
      profileId: "balanced",
      detailLevel: "score-only",
      size: { min: 2, max: 8 },
    });
    const userFull = evaluateRevolutionBar({
      bar: [...SURVIVOR_BIAS_BAR_IDS],
      style: "melee",
      durationTicks: 100,
      pool,
      sim: { ...fx.revoInput, adrenaline: undefined },
      profileId: "balanced",
      detailLevel: "score-only",
      branchFidelityMode: "full",
      branchFidelityOverrides: { full: { liveCaps: [128] } },
      size: { min: 2, max: 8 },
    });

    const proposedResidual =
      proposedFull.summary?.damage?.residualMass ?? proposedFull.summary?.rng?.residualWeight ?? 0;
    const proposedConcrete =
      proposedFull.summary?.damage?.concreteMass ??
      proposedFull.summary?.rng?.concreteMass ??
      proposedFull.summary?.rng?.probabilityMass ??
      0;
    const proposedConditional = proposedFull.summary?.damage?.conditionalConcreteMean ?? 0;
    const proposedKnownMass =
      proposedFull.summary?.damage?.knownMassExpectedDamage ??
      proposedFull.summary?.totalExpected ??
      0;
    const userFullScore = userFull.score;
    const userKnownMass = userFull.summary?.totalExpected ?? 0;

    const phase2 = {
      survivingConcreteMass_proposed: proposedConcrete,
      residualMass_proposed: proposedResidual,
      conditionalConcreteMean_proposed: proposedConditional,
      knownMassExpectedDamage_proposed: proposedKnownMass,
      primaryTotalExpected_proposed: proposedFull.summary?.totalExpected,
      knownMassDamage_user: userKnownMass,
      exploratoryScore_proposed: proposedShort.score,
      exploratoryScore_user: userShort.score,
      proposedShortOk: proposedShort.ok,
      userShortOk: userShort.ok,
      proposedShortFailure: proposedShort.failureReason,
      fullScore_proposed: proposedFull.validForFinalRanking
        ? proposedFull.score
        : Number.NEGATIVE_INFINITY,
      fullScore_user: userFull.validForFinalRanking ? userFullScore : Number.NEGATIVE_INFINITY,
      fullRankable_proposed: proposedFull.validForFinalRanking === true,
      fullRankable_user: userFull.validForFinalRanking === true,
      proposedFailureReason: proposedFull.failureReason,
      totalsBasis_proposed: proposedFull.summary?.rng?.totalsBasis,
      // What the old bug would have ranked: DPM of conditional mean (must not rank).
      legacyConditionalDpm_proposed: exploratoryDpm(proposedConditional, searchTicks),
    };

    console.warn(
      "[evaluate PHASE-2]",
      JSON.stringify(phase2, (_k, v) => (v === Number.NEGATIVE_INFINITY ? "-Infinity" : v), 2),
    );

    // 1. Substantial residual on proposed full-horizon sim.
    expect(proposedResidual).toBeGreaterThan(0.5);
    expect(["concrete-terminals", "known-mass-contribution"]).toContain(
      phase2.totalsBasis_proposed,
    );

    // 2. Phase 2 progress: short explore must not rank residual conditional mean.
    expect(proposedShort.ok).toBe(false);
    expect(proposedShort.exploratory).toBe(true);
    expect(proposedShort.validForFinalRanking).toBe(false);
    expect(proposedShort.score).toBe(Number.NEGATIVE_INFINITY);
    expect(proposedShort.failureReason ?? "").toMatch(/residualWeight|totalsBasis|exactness/);
    expect(proposedShort.summary?.rng?.residualWeight ?? 0).toBeGreaterThan(0);
    // Residual-free user short path remains finite rankable exploratory.
    expect(userShort.ok).toBe(true);
    expect(userShort.exploratory).toBe(true);
    expect(Number.isFinite(userShort.score) && userShort.score > 0).toBe(true);
    expect(userShort.summary?.rng?.residualWeight ?? 0).toBeLessThan(1e-9);

    // 3. Full: proposed unrankable (residual); user rankable and higher known-mass.
    expect(proposedFull.validForFinalRanking).toBe(false);
    expect(proposedFull.failureReason ?? "").toMatch(/residualWeight/);
    expect(userFull.validForFinalRanking).toBe(true);
    expect(userKnownMass).toBeGreaterThan(proposedKnownMass);

    // Primary total under residual is known-mass, not conditional mean.
    expect(phase2.primaryTotalExpected_proposed).toBeCloseTo(proposedKnownMass, 4);
    expect(proposedKnownMass).toBeCloseTo(proposedConditional * proposedConcrete, 4);
    expect(phase2.legacyConditionalDpm_proposed).toBeGreaterThan(0);
    expect(userKnownMass).toBeGreaterThan(proposedKnownMass);
  });
});
