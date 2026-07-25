import { describe, expect, it } from "vitest";
import { calculateAbility } from "../../pipeline/calculateAbility";
import { MAX_SOULS, volleyOfSouls } from "./abilities";

describe("volleyOfSouls", () => {
  it("deals one 135–165% hit per soul spent", () => {
    const spec = volleyOfSouls(3);
    expect(spec.hits).toHaveLength(3);
    expect(spec.hits.every((hit) => hit.band.minPct === 135 && hit.band.maxPct === 165)).toBe(true);
  });

  it("rolls up through calculateAbility", () => {
    const result = calculateAbility(volleyOfSouls(3), {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
    });
    expect(result.min).toBe(3 * 1350);
    expect(result.max).toBe(3 * 1650);
    expect(result.expected).toBe(3 * 1500);
  });

  it("scales linearly with souls up to the lantern cap", () => {
    expect(volleyOfSouls(MAX_SOULS).hits).toHaveLength(5);
    expect(() => volleyOfSouls(0)).toThrow(RangeError);
    expect(() => volleyOfSouls(MAX_SOULS + 1)).toThrow(RangeError);
  });

  it("leaves adrenaline absent — the cost is unsourced, not zero", () => {
    expect(volleyOfSouls(2).adrenaline).toBeUndefined();
  });
});
