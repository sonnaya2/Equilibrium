import { describe, expect, it } from "vitest";
import { bandOf } from "../../core/abilityDamage";
import { capabilitiesOf } from "../../shared/damageProvenance";
import { mulFloor } from "../../core/rounding";
import type { CombatModifier } from "../../types";
import { activateBalanceByForce, newRangedRotationState } from "./effects";
import {
  balanceByForceTriggersPerfectEquilibrium,
  perfectEquilibriumHitEligible,
  PERFECT_EQUILIBRIUM_ABILITY_DAMAGE_BAND,
  PERFECT_EQUILIBRIUM_TRIGGER_DAMAGE_BAND,
  recordPerfectEquilibriumHit,
  resolveBalanceByForcePrecast,
  resolvePerfectEquilibriumDamage,
} from "./botlg";

describe("Perfect Equilibrium stack mechanics", () => {
  it("uses eight stacks normally and four during Balance by Force", () => {
    let state = newRangedRotationState();
    for (let i = 0; i < 7; i++) {
      const result = recordPerfectEquilibriumHit(state, {
        style: "ranged",
        provenance: { kind: "player_direct" },
        tick: i,
      });
      state = { ...state, perfectEquilibriumStacks: result.stacks };
    }
    expect(state.perfectEquilibriumStacks).toBe(7);
    const normalTrigger = recordPerfectEquilibriumHit(state, {
      style: "ranged",
      provenance: { kind: "player_direct" },
      tick: 7,
    });
    expect(normalTrigger).toEqual({ stacks: 0, triggered: true });

    state = { ...newRangedRotationState(), balanceByForce: activateBalanceByForce(0) };
    for (let i = 0; i < 3; i++) {
      const result = recordPerfectEquilibriumHit(state, {
        style: "ranged",
        provenance: { kind: "player_direct" },
        tick: i,
      });
      state = { ...state, perfectEquilibriumStacks: result.stacks };
    }
    expect(
      recordPerfectEquilibriumHit(state, {
        style: "ranged",
        provenance: { kind: "player_direct" },
        tick: 3,
      }),
    ).toEqual({ stacks: 0, triggered: true });
  });

  it("excludes DoT, poison, invention, melee, and the separate PE hit", () => {
    const excluded = [
      { style: "ranged" as const, provenance: { kind: "player_dot" as const } },
      { style: "ranged" as const, provenance: { kind: "player_poison" as const } },
      { style: "ranged" as const, provenance: { kind: "invention_proc" as const } },
      { style: "melee" as const, provenance: { kind: "player_direct" as const } },
      {
        style: "ranged" as const,
        provenance: { kind: "botlg_perfect_equilibrium" as const },
      },
    ];
    for (const args of excluded) expect(perfectEquilibriumHitEligible(args)).toBe(false);
    expect(
      perfectEquilibriumHitEligible({ style: "ranged", provenance: { kind: "player_direct" } }),
    ).toBe(true);
    expect(capabilitiesOf({ kind: "botlg_perfect_equilibrium" })).toMatchObject({
      canApplyAmmunition: true,
      canGeneratePerfectEquilibrium: false,
      canTriggerProcs: false,
      directHit: false,
      playerAttack: false,
    });
  });

  it("separates Balance pre-cast spending from physical stack ownership", () => {
    expect(balanceByForceTriggersPerfectEquilibrium({ stacks: 3 })).toBe(true);
    expect(balanceByForceTriggersPerfectEquilibrium({ stacks: 2 })).toBe(false);
    expect(balanceByForceTriggersPerfectEquilibrium({ stacks: 8 })).toBe(true);

    expect(
      [0, 2, 3, 7].map((stacks) => resolveBalanceByForcePrecast({ stacks, physicalBow: true })),
    ).toEqual([
      { stacks: 1, perfectEquilibriumTriggered: false },
      { stacks: 3, perfectEquilibriumTriggered: false },
      { stacks: 0, perfectEquilibriumTriggered: true },
      { stacks: 0, perfectEquilibriumTriggered: true },
    ]);
    expect(
      [0, 3].map((stacks) => resolveBalanceByForcePrecast({ stacks, physicalBow: false })),
    ).toEqual([
      { stacks: 0, perfectEquilibriumTriggered: false },
      { stacks: 0, perfectEquilibriumTriggered: true },
    ]);
  });
});

describe("Perfect Equilibrium damage staging", () => {
  const common = {
    abilityDamage: 100,
    preDplMultiplier: 1.23,
    postDplMultiplier: 1.17,
    level: 90,
    accuracy: 1,
    crit: { chance: 0 },
  } as const;

  function independentlyStagedExpected(
    abilityDamage: number,
    sourceDamages: readonly number[],
    cap = Number.POSITIVE_INFINITY,
  ): number {
    const abilityBand = bandOf(abilityDamage, PERFECT_EQUILIBRIUM_ABILITY_DAMAGE_BAND);
    let total = 0;
    for (const sourceDamage of sourceDamages) {
      const triggerBand = bandOf(sourceDamage, PERFECT_EQUILIBRIUM_TRIGGER_DAMAGE_BAND);
      let sourceTotal = 0;
      for (let abilityRaw = abilityBand.min; abilityRaw <= abilityBand.max; abilityRaw++) {
        const abilityTerm = Math.floor(abilityRaw * 1.23);
        for (let triggerRaw = triggerBand.min; triggerRaw <= triggerBand.max; triggerRaw++) {
          const triggerTerm = Math.floor(triggerRaw * 1.23);
          sourceTotal += Math.min(cap, Math.floor((abilityTerm + triggerTerm) * 1.17));
        }
      }
      total +=
        sourceTotal /
        ((abilityBand.max - abilityBand.min + 1) * (triggerBand.max - triggerBand.min + 1));
    }
    return total / sourceDamages.length;
  }

  function legacyFivePointExpected(abilityDamage: number, sourceDamage: number): number {
    let total = 0;
    for (let abilityPercent = 12; abilityPercent <= 16; abilityPercent++) {
      const abilityTerm = Math.floor(Math.floor((abilityDamage * abilityPercent) / 100) * 1.23);
      for (let triggerPercent = 33; triggerPercent <= 37; triggerPercent++) {
        const triggerTerm = Math.floor(Math.floor((sourceDamage * triggerPercent) / 100) * 1.23);
        total += Math.floor((abilityTerm + triggerTerm) * 1.17);
      }
    }
    return total / 25;
  }

  it("applies pre-DPL effects to each source outcome before post-DPL combination", () => {
    const concentrated = resolvePerfectEquilibriumDamage({
      ...common,
      sourcePrecritDistribution: [{ damage: 100, weight: 1 }],
      cap: { cap: 70 },
    });
    const spread = resolvePerfectEquilibriumDamage({
      ...common,
      sourcePrecritDistribution: [
        { damage: 0, weight: 1 },
        { damage: 200, weight: 1 },
      ],
      cap: { cap: 70 },
    });

    expect(concentrated.combined.expected).toBeCloseTo(
      independentlyStagedExpected(100, [100], 70),
      12,
    );
    expect(spread.combined.expected).toBeCloseTo(
      independentlyStagedExpected(100, [0, 200], 70),
      12,
    );
    expect(spread.combined.expected).not.toBe(concentrated.combined.expected);
    const oldFloorOfMean = Math.min(
      70,
      Math.floor((Math.floor((100 * 14) / 100) + Math.floor((100 * 35) / 100)) * 1.23 * 1.17),
    );
    expect(concentrated.combined.expected).not.toBe(oldFloorOfMean);
  });

  it("enumerates every inclusive integer point in large AD and source bands", () => {
    const result = resolvePerfectEquilibriumDamage({
      abilityDamage: 10_000,
      sourcePrecritDistribution: [{ damage: 10_000, weight: 1 }],
      preDplMultiplier: 1.23,
      postDplMultiplier: 1.17,
      level: 90,
      accuracy: 1,
      crit: { chance: 0 },
    });
    const abilityBand = bandOf(10_000, PERFECT_EQUILIBRIUM_ABILITY_DAMAGE_BAND);
    const triggerBand = bandOf(10_000, PERFECT_EQUILIBRIUM_TRIGGER_DAMAGE_BAND);
    const naivePointCount =
      (abilityBand.max - abilityBand.min + 1) * (triggerBand.max - triggerBand.min + 1);

    expect(naivePointCount).toBe(401 * 401);
    expect(result.abilityTerms).toHaveLength(401);
    expect(result.triggeringAttackTerms).toHaveLength(401);
    expect(result.outcomes.length).toBeLessThan(naivePointCount / 10);
    expect(result.abilityTerms.reduce((sum, outcome) => sum + outcome.weight, 0)).toBeCloseTo(
      1,
      12,
    );
    expect(
      result.triggeringAttackTerms.reduce((sum, outcome) => sum + outcome.weight, 0),
    ).toBeCloseTo(1, 12);
    expect(result.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0)).toBeCloseTo(1, 12);
    expect(result.combined.expected).toBeCloseTo(independentlyStagedExpected(10_000, [10_000]), 10);
    expect(result.combined.expected).not.toBeCloseTo(legacyFivePointExpected(10_000, 10_000), 12);
  });

  it("mixes broad source bands through one bounded weighted interval scan", () => {
    const sourceOutcomes = Array.from({ length: 50_000 }, (_, index) => ({
      damage: 10_000 + index,
      weight: 1,
    }));
    sourceOutcomes.push({ damage: 10_000, weight: 1 });
    const result = resolvePerfectEquilibriumDamage({
      abilityDamage: 100,
      sourcePrecritDistribution: sourceOutcomes,
      preDplMultiplier: 1,
      postDplMultiplier: 1,
      level: 90,
      accuracy: 1,
      crit: { chance: 0 },
    });
    const abilityBand = bandOf(100, PERFECT_EQUILIBRIUM_ABILITY_DAMAGE_BAND);
    const totalWeight = sourceOutcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
    const expectedTrigger = sourceOutcomes.reduce((sum, outcome) => {
      const band = bandOf(outcome.damage, PERFECT_EQUILIBRIUM_TRIGGER_DAMAGE_BAND);
      return sum + ((band.min + band.max) / 2) * (outcome.weight / totalWeight);
    }, 0);
    const naiveTriggerPointCount = sourceOutcomes.reduce((sum, outcome) => {
      const band = bandOf(outcome.damage, PERFECT_EQUILIBRIUM_TRIGGER_DAMAGE_BAND);
      return sum + band.max - band.min + 1;
    }, 0);

    expect(result.abilityTerms.reduce((sum, outcome) => sum + outcome.weight, 0)).toBeCloseTo(
      1,
      12,
    );
    expect(
      result.triggeringAttackTerms.reduce((sum, outcome) => sum + outcome.weight, 0),
    ).toBeCloseTo(1, 12);
    expect(result.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0)).toBeCloseTo(1, 12);
    expect(result.triggeringAttackTerms.length).toBeLessThan(naiveTriggerPointCount / 100);
    expect(result.combined.expected).toBeCloseTo(
      (abilityBand.min + abilityBand.max) / 2 + expectedTrigger,
      10,
    );
  });

  it("rejects non-integer source damage and oversized exact bands before expansion", () => {
    expect(() =>
      resolvePerfectEquilibriumDamage({
        ...common,
        sourcePrecritDistribution: [{ damage: 1.5, weight: 1 }],
      }),
    ).toThrow(/must be an integer/);
    expect(() =>
      resolvePerfectEquilibriumDamage({
        abilityDamage: 1_000_000,
        sourcePrecritDistribution: [{ damage: 1_000_000, weight: 1 }],
        level: 90,
        accuracy: 1,
        crit: { chance: 0 },
      }),
    ).toThrow(/exact band|exact term convolution/);
  });

  it("resolves PE crit and cap from its own layers", () => {
    const nonCritical = resolvePerfectEquilibriumDamage({
      ...common,
      abilityDamage: 10_000,
      sourcePrecritDistribution: [{ damage: 10_000, weight: 1 }],
    });
    const critical = resolvePerfectEquilibriumDamage({
      ...common,
      abilityDamage: 10_000,
      sourcePrecritDistribution: [{ damage: 10_000, weight: 1 }],
      crit: { chance: 1 },
    });
    const cappedCritical = resolvePerfectEquilibriumDamage({
      ...common,
      abilityDamage: 10_000,
      sourcePrecritDistribution: [{ damage: 10_000, weight: 1 }],
      crit: { chance: 1 },
      cap: { cap: 100 },
    });

    expect(critical.triggeringAttack.expected).toBe(nonCritical.triggeringAttack.expected);
    expect(critical.critChance).toBe(1);
    expect(critical.expected).toBeGreaterThan(nonCritical.expected);
    expect(cappedCritical.combined.max).toBe(100);
    expect(cappedCritical.uncappedExpected).toBeGreaterThan(cappedCritical.expected);
  });

  it("keeps pre-term floors separate from one post-combination on-hit floor", () => {
    const multiplier = (id: string, stage: CombatModifier["stage"], value: number) =>
      ({
        id,
        stage,
        priority: 0,
        applies: () => true,
        apply: (state) => ({ ...state, damage: mulFloor(state.damage, value) }),
        source: {
          source: "derived",
          url: `https://example.invalid/${id}`,
          verifiedAt: "2026-08-09",
        },
      }) satisfies CombatModifier;
    const pre = [
      multiplier("test:pre-base", "base", 1.1),
      multiplier("test:pre-roll", "roll", 1.2),
    ];
    const post = [multiplier("test:post-on-hit", "onHit", 1.3)];
    const result = resolvePerfectEquilibriumDamage({
      abilityDamage: 100,
      sourcePrecritDistribution: [{ damage: 100, weight: 1 }],
      level: 90,
      accuracy: 1,
      crit: { chance: 0 },
      context: {
        style: "ranged",
        provenance: { kind: "botlg_perfect_equilibrium" },
      },
      preModifiers: pre,
      postModifiers: post,
    });
    let expected = 0;
    for (let abilityRaw = 12; abilityRaw <= 16; abilityRaw++) {
      const abilityTerm = mulFloor(mulFloor(abilityRaw, 1.1), 1.2);
      for (let triggerRaw = 33; triggerRaw <= 37; triggerRaw++) {
        expected += mulFloor(abilityTerm + mulFloor(mulFloor(triggerRaw, 1.1), 1.2), 1.3);
      }
    }
    expected /= 25;
    expect(result.nonCritExpected).toBe(expected);
    expect(result.nonCritExpected).not.toBe(
      mulFloor(mulFloor(14 + 35, 1.1), mulFloor(1.2 * 1.3, 1)),
    );
  });

  it("does not apply an ability-base modifier whose PE provenance predicate rejects it", () => {
    const striking: CombatModifier = {
      id: "blessing:striking-light",
      stage: "ability",
      priority: 900,
      abilityBaseMultiplier: 1.4,
      applies: (context) => context.provenance?.kind === "player_direct",
      apply: (state) => ({ ...state, damage: mulFloor(state.damage, 1.4) }),
      source: {
        source: "derived",
        url: "https://example.invalid/striking",
        verifiedAt: "2026-08-09",
      },
    };
    const plain = resolvePerfectEquilibriumDamage({
      ...common,
      preDplMultiplier: 1,
      postDplMultiplier: 1,
      sourcePrecritDistribution: [{ damage: 100, weight: 1 }],
      context: { style: "ranged", provenance: { kind: "botlg_perfect_equilibrium" } },
    });
    const rejected = resolvePerfectEquilibriumDamage({
      ...common,
      preDplMultiplier: 1,
      postDplMultiplier: 1,
      sourcePrecritDistribution: [{ damage: 100, weight: 1 }],
      context: { style: "ranged", provenance: { kind: "botlg_perfect_equilibrium" } },
      modifiers: [striking],
    });
    expect(rejected.nonCritExpected).toBe(plain.nonCritExpected);
  });
});
