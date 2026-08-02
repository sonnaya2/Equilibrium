import { describe, expect, it } from "vitest";
import type { CombatModifier } from "../types";
import { mulFloor } from "../core/rounding";
import { calculateHit, calculateRawHitBand, type HitInput } from "./calculateHit";

const baseInput: HitInput = {
  base: 1000,
  band: { minPct: 110, maxPct: 130 },
  level: 90,
  accuracy: 1,
  crit: { chance: 0 },
};

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
