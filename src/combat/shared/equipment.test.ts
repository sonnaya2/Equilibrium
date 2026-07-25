import { describe, expect, it } from "vitest";
import { tectonicSet, tumekensSunshineSet } from "./equipment";

describe("shared/equipment set effects", () => {
  it("tectonic grants +1% crit chance per piece, elite +2%", () => {
    expect(tectonicSet(5).critChanceBonus).toBeCloseTo(0.05, 10);
    expect(tectonicSet(5, true).critChanceBonus).toBeCloseTo(0.1, 10);
    expect(tectonicSet(0).critChanceBonus).toBe(0);
  });

  it("Tumeken's set(3) applies only inside Sunshine", () => {
    expect(tumekensSunshineSet(3, true).critChanceBonus).toBeCloseTo(0.045, 10);
    expect(tumekensSunshineSet(3, false).critChanceBonus).toBe(0);
  });

  it("rejects impossible piece counts", () => {
    expect(() => tectonicSet(6)).toThrow(RangeError);
    expect(() => tumekensSunshineSet(-1, true)).toThrow(RangeError);
  });

  it("every set effect carries provenance", () => {
    expect(tectonicSet(3).source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tumekensSunshineSet(3, true).source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
