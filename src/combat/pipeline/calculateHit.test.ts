import { describe, expect, it } from "vitest";
import type { CombatModifier } from "../types";
import { mulFloor } from "../core/rounding";
import { calculateHit, type HitInput } from "./calculateHit";

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

  it("guaranteed crits use the level-90 multiplier", () => {
    const r = calculateHit({ ...baseInput, crit: { chance: 0, guaranteed: true } });
    expect(r.critMin).toBe(1650);
    expect(r.critMax).toBe(1950);
    expect(r.expected).toBe(1800);
  });

  it("chance-weighted expectation mixes noncrit and crit", () => {
    const r = calculateHit({ ...baseInput, crit: { chance: 0.5 } });
    expect(r.expected).toBeCloseTo(1500);
  });

  it("scales by Damage Potential instead of missing", () => {
    const r = calculateHit({ ...baseInput, accuracy: 0.7 });
    expect(r.potential).toBeCloseTo(0.7);
    expect(r.min).toBe(770);
    // floor(1300 * 0.7): the float product is 909.999..., so the scaled hit floors to 909.
    expect(r.max).toBe(909);
  });

  it("applies the standard hit cap", () => {
    const r = calculateHit({ ...baseInput, base: 30_000, band: { minPct: 520, maxPct: 570 } });
    expect(r.max).toBe(30_000);
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
    // floor(1100 * 1.75) = 1925 -> crit floor(1925 * 1.5) = 2887
    expect(r.critMin).toBe(2887);
  });
});
