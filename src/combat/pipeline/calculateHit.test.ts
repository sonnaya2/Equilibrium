import { describe, expect, it } from "vitest";
import type { CombatModifier } from "../types";
import {
  baseCritDamageMultiplier,
  critProbability,
  discreteUniformCritDamageValues,
} from "../core/critical";
import { applyDamagePotential } from "../core/damagePotential";
import { applyHitCap, normalizeHitCapRule, standardHitCap } from "../core/hitCaps";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_WIKI } from "../data/sources";
import { contextWithProvenance } from "../shared/damageProvenance";
import {
  calculateHit,
  calculateNonCriticalHitDistribution,
  calculateRawHitBand,
  type HitInput,
  type RawHitBandInput,
} from "./calculateHit";
import { runPipeline } from "./modifierPipeline";

const baseInput: HitInput = {
  base: 1000,
  band: { minPct: 110, maxPct: 130 },
  level: 90,
  accuracy: 1,
  crit: { chance: 0 },
};

/** Slow oracle: sort+filter modifiers on every roll via runPipeline (pre-Phase-5 path). */
function oracleCritMod(multiplier: number): CombatModifier {
  return {
    id: "core:critical-damage",
    stage: "critical",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source: MODERNISATION_WIKI,
  };
}

function oracleRunPass(
  damage: number,
  critMult: number | null,
  input: RawHitBandInput,
  cap = true,
): number {
  const mods =
    critMult === null
      ? (input.modifiers ?? [])
      : [...(input.modifiers ?? []), oracleCritMod(critMult)];
  const context = contextWithProvenance(input.context, input.provenance);
  const state = runPipeline({ damage }, mods, context);
  const scaled = applyDamagePotential(state.damage, input.accuracy);
  const resolved = Math.floor(scaled);
  const rule = normalizeHitCapRule(input.cap ?? standardHitCap);
  return cap ? applyHitCap(resolved, rule) : resolved;
}

function oracleExactMean(
  min: number,
  max: number,
  critMult: number | null,
  input: RawHitBandInput,
  cap = true,
): number {
  const count = max - min + 1;
  let total = 0;
  for (let roll = min; roll <= max; roll++) total += oracleRunPass(roll, critMult, input, cap);
  return total / count;
}

function oracleHitResult(input: RawHitBandInput) {
  const p = critProbability(input.crit);
  const critMult =
    p > 0 ? baseCritDamageMultiplier(input.level, input.crit.damageBonus ?? 0) : null;
  const min = oracleRunPass(input.min, null, input);
  const max = oracleRunPass(input.max, null, input);
  const critMin = critMult === null ? min : oracleRunPass(input.min, critMult, input);
  const critMax = critMult === null ? max : oracleRunPass(input.max, critMult, input);
  const nonCritExpected = oracleExactMean(input.min, input.max, null, input);
  const critExpected =
    critMult === null ? nonCritExpected : oracleExactMean(input.min, input.max, critMult, input);
  const expected = (1 - p) * nonCritExpected + p * critExpected;
  const capRule = normalizeHitCapRule(input.cap ?? standardHitCap);
  const uncappedMaxNonCrit = oracleRunPass(input.max, null, input, false);
  const uncappedMaxCrit = oracleRunPass(input.max, critMult, input, false);
  const canClip = !capRule.bypass && Math.max(uncappedMaxNonCrit, uncappedMaxCrit) > capRule.cap;
  const uncappedExpected = canClip
    ? (1 - p) * oracleExactMean(input.min, input.max, null, input, false) +
      p * oracleExactMean(input.min, input.max, critMult, input, false)
    : expected;
  return {
    min,
    max,
    critMin,
    critMax,
    critChance: p,
    nonCritExpected,
    critExpected,
    expected,
    uncappedExpected,
    capLoss: Math.max(0, uncappedExpected - expected),
  };
}

function expectExactHitMatch(
  optimized: ReturnType<typeof calculateRawHitBand>,
  oracle: ReturnType<typeof oracleHitResult>,
) {
  expect(optimized.min).toBe(oracle.min);
  expect(optimized.max).toBe(oracle.max);
  expect(optimized.critMin).toBe(oracle.critMin);
  expect(optimized.critMax).toBe(oracle.critMax);
  expect(optimized.critChance).toBe(oracle.critChance);
  expect(optimized.nonCritExpected).toBe(oracle.nonCritExpected);
  expect(optimized.critExpected).toBe(oracle.critExpected);
  expect(optimized.expected).toBe(oracle.expected);
  expect(optimized.uncappedExpected).toBe(oracle.uncappedExpected);
  expect(optimized.capLoss).toBe(oracle.capLoss);
}

describe("calculateHit", () => {
  it("computes band min/max with no crit", () => {
    const r = calculateHit(baseInput);
    expect(r.min).toBe(1100);
    expect(r.max).toBe(1300);
    expect(r.expected).toBe(1200);
    expect(r.critChance).toBe(0);
  });

  it("Precise raises the min hit by 1.5% of max per rank", () => {
    // band max 1300; Precise 6 → +1.5%×6×1300 = 117 → min 1100+117 = 1217
    const r = calculateHit({ ...baseInput, preciseRank: 6 });
    expect(r.max).toBe(1300);
    expect(r.min).toBe(1217);
  });

  it("Precise does not raise min on true DoT hits", () => {
    const bare = calculateHit(baseInput);
    for (const context of [
      { style: "melee" as const, provenance: { kind: "player_dot" as const } },
      { style: "melee" as const, damageSource: "dot" as const },
      { style: "melee" as const, dotKind: "bleed" as const },
      { style: "magic" as const, dotKind: "burn" as const },
      { style: "melee" as const, provenance: { kind: "derived_tail" as const } },
    ]) {
      const r = calculateHit({ ...baseInput, preciseRank: 6, context });
      expect(r.min).toBe(bare.min);
      expect(r.max).toBe(bare.max);
    }
  });

  it("Precise still applies to converted channels (not true DoTs)", () => {
    const r = calculateHit({
      ...baseInput,
      preciseRank: 6,
      context: {
        style: "melee",
        provenance: { kind: "player_converted_channel" },
        damageSource: "dot",
      },
    });
    expect(r.min).toBe(1217);
    expect(r.max).toBe(1300);
  });

  it("guaranteed crits use the level-90 multiplier", () => {
    const r = calculateHit({ ...baseInput, crit: { chance: 0, guaranteed: true } });
    expect(r.critMin).toBe(1650);
    expect(r.critMax).toBe(1950);
    expect(r.expected).toBeCloseTo(1799.7512437810944, 10);
  });

  it("chance-weighted expectation mixes noncrit and crit", () => {
    const r = calculateHit({ ...baseInput, crit: { chance: 0.5 } });
    expect(r.expected).toBeCloseTo(1499.8756218905473, 10);
  });

  it("scales by Damage Potential instead of missing", () => {
    const r = calculateHit({ ...baseInput, accuracy: 0.7 });
    expect(r.potential).toBeCloseTo(0.7);
    expect(r.min).toBe(770);
    expect(r.max).toBe(909);
  });

  it("applies the standard hit cap", () => {
    const r = calculateHit({ ...baseInput, base: 30_000, band: { minPct: 520, maxPct: 570 } });
    expect(r.max).toBe(30_000);
    expect(r.uncappedExpected).toBeGreaterThan(r.expected);
    expect(r.capLoss).toBeCloseTo(r.uncappedExpected - r.expected, 10);
  });

  it("uses the exact clipped integer distribution for partial caps", () => {
    const r = calculateHit({
      ...baseInput,
      base: 20_000,
      band: { minPct: 100, maxPct: 200 },
    });
    // Uniform integers 20,000..40,000: 20,000..29,999 retain their rolls and
    // 30,000..40,000 each contribute 30,000.
    expect(r.nonCritExpected).toBeCloseTo(550_025_000 / 20_001, 10);
    expect(r.min).toBe(20_000);
    expect(r.max).toBe(30_000);
  });

  it.each([
    [29_999, 29_999],
    [30_000, 30_000],
    [30_001, 30_000],
  ])("clips a deterministic %i roll to %i", (base, expected) => {
    const r = calculateHit({ ...baseInput, base, band: { minPct: 100, maxPct: 100 } });
    expect(r.expected).toBe(expected);
  });

  it("supports an explicit uncapped rule for normal and critical damage", () => {
    const r = calculateHit({
      ...baseInput,
      base: 35_000,
      band: { minPct: 100, maxPct: 100 },
      crit: { chance: 0, guaranteed: true },
      cap: { cap: 30_000, bypass: true },
    });
    expect(r.min).toBe(35_000);
    expect(r.critMin).toBeGreaterThan(35_000);
    expect(r.expected).toBe(r.critExpected);
    expect(r.capLoss).toBe(0);
  });

  it("evaluates every Surging Storm point through floors and caps", () => {
    const distribution = { minBonus: 0.15, maxBonus: 0.25, points: 101 };
    const input: RawHitBandInput = {
      min: 17_000,
      max: 20_000,
      level: 90,
      accuracy: 1,
      crit: { chance: 0, guaranteed: true },
      cap: { cap: 30_000, bypass: false },
      critDamageDistribution: distribution,
    };
    const exact = calculateRawHitBand(input);
    const pointwiseMean =
      discreteUniformCritDamageValues(distribution).reduce(
        (total, bonus) =>
          total +
          calculateRawHitBand({
            ...input,
            critDamageDistribution: undefined,
            crit: { chance: 0, guaranteed: true, damageBonus: bonus },
          }).critExpected,
        0,
      ) / distribution.points;
    const naiveMean = calculateRawHitBand({
      ...input,
      critDamageDistribution: undefined,
      crit: { chance: 0, guaranteed: true, damageBonus: 0.2 },
    }).critExpected;

    expect(exact.critExpected).toBe(pointwiseMean);
    expect(exact.critDamageBonus).toBeCloseTo(0.2, 12);
    expect(exact.critExpected).not.toBeCloseTo(naiveMean, 12);
  });

  it("preserves floors and Damage Potential in the exact expectation", () => {
    const half: CombatModifier = {
      id: "half",
      stage: "onHit",
      priority: 0,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 0.5) }),
      source: { source: "derived", url: "test", verifiedAt: "2026-08-01" },
    };
    const r = calculateHit({
      ...baseInput,
      base: 101,
      band: { minPct: 100, maxPct: 102 },
      accuracy: 0.5,
      modifiers: [half],
    });
    expect(r.nonCritExpected).toBe((25 + 25 + 25) / 3);
  });

  it("returns the exact noncritical source distribution used by separate hits", () => {
    const input = {
      ...baseInput,
      base: 101,
      band: { minPct: 100, maxPct: 102 },
      accuracy: 0.5,
      modifiers: [
        {
          id: "half",
          stage: "onHit" as const,
          priority: 0,
          applies: () => true,
          apply: (s: { damage: number }) => ({ ...s, damage: mulFloor(s.damage, 0.5) }),
          source: { source: "derived" as const, url: "test", verifiedAt: "2026-08-01" },
        },
      ],
    };
    const source = calculateHit(input);
    const distribution = calculateNonCriticalHitDistribution(input);
    expect(distribution).toEqual([{ damage: 25, weight: 1 }]);
    expect(distribution.reduce((sum, outcome) => sum + outcome.weight, 0)).toBe(1);
    expect(distribution[0]!.damage).toBe(source.min);
    expect(distribution[0]!.damage).toBe(source.max);
    expect(distribution[0]!.damage * distribution[0]!.weight).toBe(source.nonCritExpected);
  });

  it("rejects an impractically wide exact band", () => {
    expect(() =>
      calculateHit({
        ...baseInput,
        base: 100_001,
        band: { minPct: 0, maxPct: 100 },
      }),
    ).toThrow("exact integer band has 100002 points");
  });

  it("rejects fractional raw-band bounds", () => {
    expect(() => calculateRawHitBand({ ...baseInput, min: 10.5, max: 20 })).toThrow(/non-integer/);
  });
  it("rejects NaN and infinite raw-band bounds", () => {
    expect(() => calculateRawHitBand({ ...baseInput, min: Number.NaN, max: 20 })).toThrow(
      /non-finite/,
    );
    expect(() =>
      calculateRawHitBand({ ...baseInput, min: 0, max: Number.POSITIVE_INFINITY }),
    ).toThrow(/non-finite/);
  });
  it("rejects inverted and negative-min raw bands", () => {
    expect(() => calculateRawHitBand({ ...baseInput, min: 50, max: 10 })).toThrow(/inverted/);
    expect(() => calculateRawHitBand({ ...baseInput, min: -1, max: 10 })).toThrow(/negative/);
  });

  it("runs the modifier pipeline before the crit layer", () => {
    const berserk: CombatModifier = {
      id: "berserk",
      stage: "onCast",
      priority: 0,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 1.75) }),
      source: { source: "derived", url: "test", verifiedAt: "2026-07-24" },
    };
    const r = calculateHit({
      ...baseInput,
      modifiers: [berserk],
      crit: { chance: 0, guaranteed: true },
    });
    expect(r.critMin).toBe(2887);
  });
});

describe("calculateHit Phase 5 sort-once === slow oracle (pointwise identity)", () => {
  const src = { source: "derived" as const, url: "test", verifiedAt: "2026-08-03" };

  const scrambledMods: CombatModifier[] = [
    {
      id: "post",
      stage: "postHit",
      priority: 0,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 1.1) }),
      source: src,
    },
    {
      id: "onCast-hi",
      stage: "onCast",
      priority: 20,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 1.2) }),
      source: src,
    },
    {
      id: "onCast-lo",
      stage: "onCast",
      priority: 5,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 1.05) }),
      source: src,
    },
    {
      id: "onHit",
      stage: "onHit",
      priority: 0,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 0.9) }),
      source: src,
    },
    {
      id: "skip-melee-only-when-magic",
      stage: "target",
      priority: 0,
      applies: (c) => c.style === "melee",
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 2) }),
      source: src,
    },
  ];

  it("matches oracle with no modifiers", () => {
    const input: RawHitBandInput = {
      min: 1100,
      max: 1300,
      level: 90,
      accuracy: 1,
      crit: { chance: 0 },
    };
    expectExactHitMatch(calculateRawHitBand(input), oracleHitResult(input));
  });

  it("matches oracle with scrambled multi-stage floor chain", () => {
    const input: RawHitBandInput = {
      min: 100,
      max: 130,
      level: 90,
      accuracy: 0.85,
      crit: { chance: 0 },
      context: { style: "melee" },
      modifiers: scrambledMods,
    };
    // Pointwise: every roll's oracleRunPass must equal optimized band aggregate.
    const optimized = calculateRawHitBand(input);
    const oracle = oracleHitResult(input);
    expectExactHitMatch(optimized, oracle);
    // Explicit per-roll check on a sample of the band (floor chain cannot collapse).
    for (let roll = input.min; roll <= input.max; roll++) {
      expect(oracleRunPass(roll, null, input)).toBe(
        // reconstruct single-roll optimized via raw band of width 1
        calculateRawHitBand({ ...input, min: roll, max: roll }).expected,
      );
    }
  });

  it("matches oracle on crit pass with same floor chain", () => {
    const input: RawHitBandInput = {
      min: 200,
      max: 220,
      level: 90,
      accuracy: 1,
      crit: { chance: 0.5, damageBonus: 0.1 },
      context: { style: "melee" },
      modifiers: scrambledMods,
    };
    expectExactHitMatch(calculateRawHitBand(input), oracleHitResult(input));
    const critMult = baseCritDamageMultiplier(input.level, input.crit.damageBonus ?? 0);
    for (let roll = input.min; roll <= input.max; roll++) {
      expect(oracleRunPass(roll, critMult, input)).toBe(
        calculateRawHitBand({
          ...input,
          min: roll,
          max: roll,
          crit: { chance: 0, guaranteed: true, damageBonus: input.crit.damageBonus },
        }).critExpected,
      );
    }
  });

  it("matches oracle under partial hit cap (clipped integer distribution)", () => {
    const input: RawHitBandInput = {
      min: 28_000,
      max: 32_000,
      level: 90,
      accuracy: 1,
      crit: { chance: 0 },
      modifiers: scrambledMods.slice(0, 3),
      context: { style: "ranged" },
    };
    expectExactHitMatch(calculateRawHitBand(input), oracleHitResult(input));
  });

  it("matches oracle when applies filters out modifiers by context", () => {
    const input: RawHitBandInput = {
      min: 500,
      max: 520,
      level: 99,
      accuracy: 0.9,
      crit: { chance: 0.25 },
      context: { style: "magic" }, // melee-only mod must not apply
      modifiers: scrambledMods,
    };
    expectExactHitMatch(calculateRawHitBand(input), oracleHitResult(input));
  });
});
