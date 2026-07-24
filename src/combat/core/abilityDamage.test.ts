import { describe, expect, it } from "vitest";
import { bandOf } from "./abilityDamage";

describe("abilityDamage", () => {
  it("applies percent bands with floored ends", () => {
    expect(bandOf(1000, { minPct: 110, maxPct: 130 })).toEqual({ min: 1100, max: 1300, expected: 1200 });
  });

  it("rejects inverted bands and bad bases", () => {
    expect(() => bandOf(1000, { minPct: 130, maxPct: 110 })).toThrow(RangeError);
    expect(() => bandOf(-1, { minPct: 1, maxPct: 2 })).toThrow(RangeError);
  });
});
