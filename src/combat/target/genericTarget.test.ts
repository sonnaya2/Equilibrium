import { describe, expect, it } from "vitest";
import {
  accuracyCurve,
  AFFINITY,
  hitChance,
  playerAccuracy,
  targetArmour,
  targetDamagePotential,
} from "./genericTarget";

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
    expect(AFFINITY).toEqual({ weak: 70, same: 60, strong: 50, weakness: 90 });
  });

  it("hit chance scales with affinity and caps at 100%", () => {
    const accuracy = 300;
    const weak = hitChance(accuracy, { defenceLevel: 60, affinity: "weak" });
    const strong = hitChance(accuracy, { defenceLevel: 60, affinity: "strong" });
    expect(weak / strong).toBeCloseTo(70 / 50, 5);
    expect(hitChance(1_000_000, { defenceLevel: 1, affinity: "weakness" })).toBe(1);
  });

  it("applies additive modifiers and clamps to 0–1", () => {
    const base = hitChance(1000, { defenceLevel: 99 });
    const boosted = hitChance(1000, { defenceLevel: 99, additiveHitChance: 0.02 });
    expect(boosted).toBeCloseTo(Math.min(1, base + 0.02), 10);
    expect(hitChance(500, { defenceLevel: 99, additiveHitChance: -1 })).toBe(0);
  });

  it("damage potential is the hit chance unless overridden", () => {
    const accuracy = 2000;
    const target = { defenceLevel: 70, affinity: "same" as const };
    expect(targetDamagePotential(accuracy, target)).toBeCloseTo(hitChance(accuracy, target), 10);
    expect(targetDamagePotential(accuracy, { ...target, damagePotentialOverride: 0.7 })).toBe(0.7);
  });
});
