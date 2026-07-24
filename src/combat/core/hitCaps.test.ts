import { describe, expect, it } from "vitest";
import { applyHitCap, STANDARD_HIT_CAP } from "./hitCaps";

describe("hitCaps", () => {
  it("caps at 30,000 by default", () => {
    expect(STANDARD_HIT_CAP).toBe(30_000);
    expect(applyHitCap(31_500)).toBe(30_000);
    expect(applyHitCap(12_000)).toBe(12_000);
  });

  it("honours per-effect rules, including bypass", () => {
    expect(applyHitCap(31_500, { cap: 15_000 })).toBe(15_000);
    expect(applyHitCap(31_500, { cap: 30_000, bypass: true })).toBe(31_500);
  });
});
