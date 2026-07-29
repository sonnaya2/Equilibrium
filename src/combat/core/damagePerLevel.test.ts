import { describe, expect, it } from "vitest";
import { DPL_ANCHOR_LEVEL, damagePerLevel, legacyDamagePerLevel } from "./damagePerLevel";

const GOLDEN: Array<[level: number, dpl: number]> = [
  [1, 3.18488],
  [20, 61.32532],
  [50, 145.039165],
  [80, 220.549812],
  [90, 244.161981],
  [99, 264.812007],
  [110, 289.322429],
  [120, 310.948256],
  [130, 331.984214],
  [138, 348.409409],
  [145, 362.5],
  [150, 372.409395],
];

describe("damagePerLevel", () => {
  it.each(GOLDEN)("level %i -> %f", (level, expected) => {
    expect(damagePerLevel(level)).toBeCloseTo(expected, 5);
  });

  it("is zero at level 0", () => {
    expect(damagePerLevel(0)).toBe(0);
  });

  it("meets the pre-2026 linear curve exactly at the anchor level", () => {
    expect(damagePerLevel(DPL_ANCHOR_LEVEL)).toBeCloseTo(
      legacyDamagePerLevel(DPL_ANCHOR_LEVEL),
      10,
    );
    expect(damagePerLevel(DPL_ANCHOR_LEVEL)).toBeCloseTo(362.5, 10);
  });

  it("pays out ahead of linear below the anchor and behind it above", () => {
    for (const l of [1, 20, 50, 80, 90, 99, 110, 120, 130]) {
      expect(damagePerLevel(l)).toBeGreaterThan(legacyDamagePerLevel(l));
    }
    for (const l of [150, 160, 200]) {
      expect(damagePerLevel(l)).toBeLessThan(legacyDamagePerLevel(l));
    }
  });

  it("increases monotonically with diminishing returns through 200", () => {
    let prev = damagePerLevel(0);
    let prevGain = Infinity;
    for (let l = 1; l <= 200; l++) {
      const cur = damagePerLevel(l);
      const gain = cur - prev;
      expect(cur).toBeGreaterThan(prev);
      expect(gain).toBeLessThan(prevGain);
      prev = cur;
      prevGain = gain;
    }
  });

  it("keeps working past 120 for temporary boosts", () => {
    expect(damagePerLevel(130)).toBeGreaterThan(damagePerLevel(120));
    expect(Number.isFinite(damagePerLevel(1000))).toBe(true);
  });

  it("rejects nonsense levels", () => {
    expect(() => damagePerLevel(-1)).toThrow(RangeError);
    expect(() => damagePerLevel(NaN)).toThrow(RangeError);
  });
});
