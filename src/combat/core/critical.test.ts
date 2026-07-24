import { describe, expect, it } from "vitest";
import { baseCritDamageMultiplier, critProbability, rollsCrit } from "./critical";

describe("critical", () => {
  it("reaches +50% crit damage at level 90 and holds past it", () => {
    expect(baseCritDamageMultiplier(90)).toBeCloseTo(1.5);
    expect(baseCritDamageMultiplier(120)).toBeCloseTo(1.5);
  });

  it("interpolates below 90 (derived shape, flagged in-module)", () => {
    expect(baseCritDamageMultiplier(45)).toBeCloseTo(1.25);
    expect(baseCritDamageMultiplier(0)).toBeCloseTo(1);
  });

  it("stacks ability crit-damage bonuses on top of base", () => {
    expect(baseCritDamageMultiplier(90, 0.2)).toBeCloseTo(1.7);
  });

  it("keeps guaranteed, eligibility and chance as separate layers", () => {
    expect(rollsCrit({ chance: 0, guaranteed: true }, 0.999)).toBe(true);
    expect(rollsCrit({ chance: 1, eligible: false }, 0)).toBe(false);
    expect(rollsCrit({ chance: 0.25 }, 0.2)).toBe(true);
    expect(rollsCrit({ chance: 0.25 }, 0.3)).toBe(false);
  });

  it("reports expectation probability", () => {
    expect(critProbability({ chance: 0.1, guaranteed: true })).toBe(1);
    expect(critProbability({ chance: 1, eligible: false })).toBe(0);
    expect(critProbability({ chance: 0.1 })).toBeCloseTo(0.1);
  });
});
