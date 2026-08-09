import { describe, expect, it } from "vitest";
import {
  accuracyCurve,
  DEFAULT_AFFINITIES,
  hitChance,
  liveTargetDamagePotential,
  playerAccuracy,
  rawHitChanceForArmour,
  resolveAffinityPercent,
  sanitizeAffinity,
  targetArmour,
  targetDamagePotential,
} from "./genericTarget";
import { activeEquipmentEffects } from "../shared/equipment";
import {
  applyBlackStoneArmourReduction,
  newBlackStoneArmourState,
} from "../styles/ranged/blackStone";

describe("genericTarget", () => {
  it("accuracyCurve follows f(x) = x³/1250 + 4x + 40", () => {
    expect(accuracyCurve(0)).toBe(40);
    expect(accuracyCurve(10)).toBe(10 ** 3 / 1250 + 80);
    expect(() => accuracyCurve(-1)).toThrow(RangeError);
  });

  it("player accuracy combines level and weapon tier", () => {
    expect(playerAccuracy(99, 90)).toBe(
      Math.floor(accuracyCurve(99)) + Math.floor(2.5 * accuracyCurve(90)),
    );
  });

  it("target armour adds the armour stat to f(Defence)", () => {
    expect(targetArmour({ defenceLevel: 80, armour: 500 })).toBe(
      Math.floor(500 + accuracyCurve(80)),
    );
    expect(targetArmour({ defenceLevel: 80 })).toBe(Math.floor(accuracyCurve(80)));
  });

  it("post-2026 default affinities are Weak 70 / Same 60 / Strong 50, weakness 90", () => {
    expect(DEFAULT_AFFINITIES).toEqual({ weak: 70, same: 60, strong: 50, weakness: 90 });
  });

  it("accepts exact numeric affinity including arbitrary 55", () => {
    expect(sanitizeAffinity(55)).toBe(55);
    expect(resolveAffinityPercent(55)).toBe(55);
    expect(resolveAffinityPercent("same")).toBe(60);
    expect(resolveAffinityPercent(undefined)).toBe(60);
  });

  it("sanitizes affinity bounds without inventing mid-range values", () => {
    expect(sanitizeAffinity(0)).toBe(1);
    expect(sanitizeAffinity(101)).toBe(100);
    expect(sanitizeAffinity(Number.NaN)).toBe(60);
  });

  it("hit chance scales with affinity and caps at 100%", () => {
    const accuracy = 300;
    const weak = hitChance(accuracy, { defenceLevel: 60, affinity: 70 });
    const strong = hitChance(accuracy, { defenceLevel: 60, affinity: 50 });
    const exact55 = hitChance(accuracy, { defenceLevel: 60, affinity: 55 });
    expect(weak / strong).toBeCloseTo(70 / 50, 5);
    expect(exact55 / strong).toBeCloseTo(55 / 50, 5);
    // 55 is not same(60) with additive faking: pure affinity path only.
    const same = hitChance(accuracy, { defenceLevel: 60, affinity: 60 });
    expect(exact55).not.toBeCloseTo(same, 10);
    expect(hitChance(1_000_000, { defenceLevel: 1, affinity: 90 })).toBe(1);
  });

  it("applies additive modifiers and clamps to 0–1", () => {
    const base = hitChance(1000, { defenceLevel: 99 });
    const boosted = hitChance(1000, { defenceLevel: 99, additiveHitChance: 0.02 });
    expect(boosted).toBeCloseTo(Math.min(1, base + 0.02), 10);
    expect(hitChance(500, { defenceLevel: 99, additiveHitChance: -1 })).toBe(0);
  });

  it("damage potential is the hit chance unless overridden", () => {
    const accuracy = 2000;
    const target = { defenceLevel: 70, affinity: 60 };
    expect(targetDamagePotential(accuracy, target)).toBeCloseTo(hitChance(accuracy, target), 10);
    expect(targetDamagePotential(accuracy, { ...target, damagePotentialOverride: 0.7 })).toBe(0.7);
  });

  it("uses live Black Stone armour for formula DP and leaves overrides armour-independent", () => {
    const profile = {
      playerAccuracyRating: 600,
      originalTargetArmourRating: 1000,
      affinity: 60,
      additiveHitChance: 0,
    };
    const state = applyBlackStoneArmourReduction(newBlackStoneArmourState(1000), 0).state;
    const before = liveTargetDamagePotential(profile);
    const after = liveTargetDamagePotential(profile, {
      blackStone: { state, currentTick: 1 },
    });
    expect(after).toBeGreaterThan(before);

    const override = liveTargetDamagePotential(
      { ...profile, damagePotentialOverride: 0.42 },
      { blackStone: { state, currentTick: 1 } },
    );
    expect(override).toBe(0.42);
  });

  it("Reaver Reckless Assault multiplies uncapped hit chance before clamp", () => {
    const reaver = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { ring: "item:reavers-ring" },
    });
    expect(reaver.passiveIds).toContain("reaver-ring");

    // affinity 100%, acc/armour = 0.5 -> H_raw 0.5; wiki example -> 0.475 DP
    const half = {
      playerAccuracyRating: 500,
      originalTargetArmourRating: 1000,
      affinity: 100,
      additiveHitChance: 0,
    };
    expect(rawHitChanceForArmour(500, 1000, 100, 0)).toBeCloseTo(0.5, 10);
    expect(liveTargetDamagePotential(half, { equipmentEffects: reaver })).toBeCloseTo(0.475, 10);

    // Exact 100% raw -> 95% DP with Reaver
    const exact = {
      playerAccuracyRating: 1000,
      originalTargetArmourRating: 1000,
      affinity: 100,
      additiveHitChance: 0,
    };
    expect(rawHitChanceForArmour(1000, 1000, 100, 0)).toBeCloseTo(1, 10);
    expect(liveTargetDamagePotential(exact)).toBe(1);
    expect(liveTargetDamagePotential(exact, { equipmentEffects: reaver })).toBeCloseTo(0.95, 10);

    // Overcap 110% * 0.95 = 104.5% -> still 100% DP
    const overcap = {
      playerAccuracyRating: 1100,
      originalTargetArmourRating: 1000,
      affinity: 100,
      additiveHitChance: 0,
    };
    expect(rawHitChanceForArmour(1100, 1000, 100, 0)).toBeCloseTo(1.1, 10);
    expect(liveTargetDamagePotential(overcap)).toBe(1);
    expect(liveTargetDamagePotential(overcap, { equipmentEffects: reaver })).toBe(1);

    // Boundary: need H_raw >= 1/0.95 to keep full DP with Reaver
    const boundary = {
      playerAccuracyRating: 1000 / 0.95,
      originalTargetArmourRating: 1000,
      affinity: 100,
      additiveHitChance: 0,
    };
    expect(liveTargetDamagePotential(boundary, { equipmentEffects: reaver })).toBe(1);
    const justUnder = {
      ...boundary,
      playerAccuracyRating: 1000 / 0.95 - 1,
    };
    expect(liveTargetDamagePotential(justUnder, { equipmentEffects: reaver })).toBeLessThan(1);
  });
});
