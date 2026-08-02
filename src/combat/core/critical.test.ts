import { describe, expect, it } from "vitest";
import { baseCritDamageMultiplier, critProbability, rollsCrit } from "./critical";

describe("critical", () => {
  it("follows the sourced stepwise progression (wiki, verified 2026-07-31)", () => {
    const expected: [level: number, multiplier: number][] = [
      [1, 1.1],
      [19, 1.1],
      [20, 1.15],
      [29, 1.15],
      [30, 1.2],
      [39, 1.2],
      [40, 1.25],
      [59, 1.3],
      [60, 1.35],
      [79, 1.4],
      [80, 1.45],
      [89, 1.45],
      [90, 1.5],
    ];
    for (const [level, multiplier] of expected) {
      expect(baseCritDamageMultiplier(level), `level ${level}`).toBeCloseTo(multiplier);
    }
  });

  it("caps at +50% from 90, including boosted levels past 90", () => {
    expect(baseCritDamageMultiplier(90)).toBeCloseTo(1.5);
    expect(baseCritDamageMultiplier(91)).toBeCloseTo(1.5);
    expect(baseCritDamageMultiplier(120)).toBeCloseTo(1.5);
  });

  it("stacks ability crit-damage bonuses on top of base", () => {
    expect(baseCritDamageMultiplier(90, 0.2)).toBeCloseTo(1.7);
  });

  it("keeps guaranteed, eligibility and chance as separate layers", () => {
    expect(rollsCrit({ chance: 0, guaranteed: true }, 0.999)).toBe(true);
    expect(rollsCrit({ chance: 1, guaranteed: true, disabled: true }, 0)).toBe(false);
    expect(rollsCrit({ chance: 1, eligible: false }, 0)).toBe(false);
    expect(rollsCrit({ chance: 0.25 }, 0.2)).toBe(true);
    expect(rollsCrit({ chance: 0.25 }, 0.3)).toBe(false);
  });

  it("reports expectation probability", () => {
    expect(critProbability({ chance: 0.1, guaranteed: true })).toBe(1);
    expect(critProbability({ chance: 1, guaranteed: true, disabled: true })).toBe(0);
    expect(critProbability({ chance: 1, eligible: false })).toBe(0);
    expect(critProbability({ chance: 0.1 })).toBeCloseTo(0.1);
  });
});
