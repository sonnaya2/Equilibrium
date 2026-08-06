import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import type { PlayerPoisonProfile } from "../../poison/mechanics";
import { PLAYER_POISON_EFFECT_ID } from "../../poison/mechanics";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { resolveLeagueRules } from "../../league/ruleset";

const profile = (patch: Partial<PlayerPoisonProfile> = {}): PlayerPoisonProfile => ({
  potion: "weapon",
  potionUntilTick: 250,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
  bik: false,
  targetPoisonImmune: false,
  vulnerability: false,
  ...patch,
});

describe("player poison simulation", () => {
  it("branches one qualifying landed hit at 12.5% and weights its poison ledger", () => {
    const result = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    const poison = result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID);
    expect(result.ok).toBe(true);
    expect(result.rng?.probabilityMass).toBeCloseTo(1, 12);
    expect(result.rng?.residualWeight).toBe(0);
    expect(poison?.expectedTriggerRolls).toBe(1);
    expect(poison?.expectedActivations).toBeCloseTo(0.125, 12);
    expect(poison?.expectedSeparateHits).toBeCloseTo(18 * 0.125, 12);
    expect(result.playerPoison).toMatchObject({
      procChance: 0.125,
      applicationAttempts: 1,
      successfulApplications: 0.125,
      separateHits: 2.25,
      supportStatus: "modeled",
    });
  });

  it("uses 17.5% for Laniakea without creating a source by itself", () => {
    const active = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile({ laniakea: true }),
    });
    expect(active.playerPoison?.successfulApplications).toBeCloseTo(0.175, 12);
    const inactive = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile({ potion: "none", potionUntilTick: 0, laniakea: true }),
    });
    expect(inactive.playerPoison).toBeUndefined();
    expect(inactive.analysis.byEffect.some((row) => row.id === PLAYER_POISON_EFFECT_ID)).toBe(
      false,
    );
  });

  it("applies Bik before the delayed poison hit and blocks all output on immunity", () => {
    const ordinary = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile(),
    });
    const bik = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
      playerPoison: profile({ bik: true }),
    });
    expect(bik.playerPoison?.expectedDamage).toBeGreaterThan(
      ordinary.playerPoison?.expectedDamage ?? 0,
    );
    expect(bik.playerPoison?.expectedDamage).toBeLessThan(
      (ordinary.playerPoison?.expectedDamage ?? 0) * 1.03,
    );
    const immune = simulate({
      ...baseInput,
      startingAdrenaline: 100,
      rotation: rotationOf("attack"),
      playerPoison: profile({ targetPoisonImmune: true }),
    });
    expect(immune.playerPoison).toBeUndefined();
    expect(immune.perAbility[PLAYER_POISON_EFFECT_ID]).toBeUndefined();
  });

  it("makes one application attempt per independent Hurricane hit", () => {
    const result = simulate({
      ...baseInput,
      startingAdrenaline: 100,
      rotation: rotationOf("hurricane"),
      playerPoison: profile(),
    });
    const poison = result.analysis.byEffect.find((row) => row.id === PLAYER_POISON_EFFECT_ID);
    expect(poison?.expectedTriggerRolls).toBe(2);
  });

  it("rolls from player damage-over-time hits", () => {
    const result = simulate({
      ...baseInput,
      rotation: rotationOf("dismember"),
      playerPoison: profile(),
    });
    expect(result.playerPoison?.applicationAttempts).toBe(8);
  });

  it("lets the triggering Envenomed hit bypass and refresh poison immunity", () => {
    const league = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Order", "Balance", "Order", "Order", "Order", "Balance"],
      },
      { herbloreLevel: 99 },
    );
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
      playerPoison: profile({ targetPoisonImmune: true }),
    });
    expect(result.playerPoison?.successfulApplications).toBeCloseTo(0.125, 12);
    expect(result.playerPoison?.expectedDamage).toBeGreaterThan(0);
  });

  it("matches the bounded Cinderbane continuation oracle for base and Laniakea chance", () => {
    for (const [laniakea, chance] of [
      [false, 0.125],
      [true, 0.175],
    ] as const) {
      const ctx = createCastContext({
        ...baseInput,
        horizonTicks: 17,
        playerPoison: profile({
          potion: "none",
          potionUntilTick: 0,
          cinderbane: true,
          laniakea,
        }),
      });
      expect(ctx.performCast(ctx.byId.get("attack")!, 0, false)).toEqual({ ok: true });
      const result = ctx.finish(undefined, 17);
      const boundedOracle = Array.from({ length: 9 }, (_, index) => chance ** (index + 1)).reduce(
        (sum, value) => sum + value,
        0,
      );
      expect(result.playerPoison?.successfulApplications).toBeCloseTo(boundedOracle, 10);
      expect(result.playerPoison).toMatchObject({
        supportStatus: "partially-modeled",
        supportNote: expect.stringMatching(/guaranteed activation/i),
      });
      expect((result.rng?.concreteMass ?? 1) + (result.rng?.residualWeight ?? 0)).toBeCloseTo(
        1,
        10,
      );
    }
  });

  it("keeps full-analysis and score-only totals aligned for multi-hit Cinderbane plus Bik", () => {
    const run = (detailLevel: "full-analysis" | "score-only") => {
      const ctx = createCastContext({
        ...baseInput,
        horizonTicks: 40,
        detailLevel,
        startingAdrenaline: 100,
        playerPoison: profile({
          potion: "weapon-plus-plus-plus",
          potionUntilTick: 1_200,
          cinderbane: true,
          bik: true,
        }),
      });
      expect(ctx.performCast(ctx.byId.get("hurricane")!, 0, false)).toEqual({ ok: true });
      return ctx.finish(undefined, 40);
    };
    const full = run("full-analysis");
    const score = run("score-only");
    expect(score.totalExpected).toBeCloseTo(full.totalExpected, 10);
    expect(score.damage.concreteMass ?? 1).toBeCloseTo(full.damage.concreteMass ?? 1, 12);
    expect(score.damage.residualMass ?? 0).toBeCloseTo(full.damage.residualMass ?? 0, 12);
  });

  it("discloses residual mass when the poison branch cap is exhausted", () => {
    const ctx = createCastContext(
      {
        ...baseInput,
        horizonTicks: 20,
        startingAdrenaline: 100,
        playerPoison: profile({ cinderbane: true, bik: true }),
      },
      { maxLiveBranches: 1, maxIntermediateBranches: 1, maximumResidualWeight: 0 },
    );
    expect(ctx.performCast(ctx.byId.get("hurricane")!, 0, false)).toEqual({ ok: true });
    const result = ctx.finish(undefined, 20);
    expect(result.rng?.residualWeight).toBeGreaterThan(0);
    expect((result.rng?.concreteMass ?? 0) + (result.rng?.residualWeight ?? 0)).toBeCloseTo(1, 10);
    expect(result.rng?.exactness).toBe("approximated");
    expect(result.damage.scope).toBe("known-mass-contribution");
  });
});
