import { describe, expect, it } from "vitest";
import { applyDamagePotential, damagePotential } from "./damagePotential";

describe("damagePotential", () => {
  it("scales damage linearly — 70% accuracy means 70% damage, not a 30% miss", () => {
    expect(damagePotential(0.7)).toBeCloseTo(0.7);
    expect(applyDamagePotential(1000, 0.7)).toBeCloseTo(700);
  });

  it("clamps to [0, 1]", () => {
    expect(damagePotential(1.2)).toBe(1);
    expect(damagePotential(-0.5)).toBe(0);
  });

  it("rejects non-finite accuracy", () => {
    expect(() => damagePotential(NaN)).toThrow(RangeError);
  });
});
