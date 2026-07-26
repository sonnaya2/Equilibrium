import { describe, expect, it } from "vitest";
import {
  OVERLOAD_FORMULAS,
  overloadBoostedLevel,
  overloadLevelBoost,
} from "./potions";

describe("overload level boosts", () => {
  it("matches the wiki table for regular overload (15% + 3)", () => {
    // 94–99 → +17; 120 → +21
    expect(overloadLevelBoost(99)).toBe(17);
    expect(overloadLevelBoost(94)).toBe(17);
    expect(overloadLevelBoost(120)).toBe(21);
    expect(overloadLevelBoost(1)).toBe(3);
    expect(overloadBoostedLevel(99)).toBe(116);
  });

  it("supreme is 16% + 4 and elder is 17% + 5", () => {
    // floor(99*0.16)+4 = 15+4 = 19; floor(99*0.17)+5 = 16+5 = 21
    expect(overloadLevelBoost(99, "supreme")).toBe(19);
    expect(overloadLevelBoost(99, "elder")).toBe(21);
    expect(overloadLevelBoost(120, "elder")).toBe(25);
  });

  it("every tier carries a SourceReference", () => {
    for (const formula of Object.values(OVERLOAD_FORMULAS)) {
      expect(formula.source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(formula.source.url).toContain("runescape.wiki");
    }
  });

  it("rejects non-positive levels", () => {
    expect(() => overloadLevelBoost(0)).toThrow(RangeError);
  });
});
