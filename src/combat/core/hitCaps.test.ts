import { describe, expect, it } from "vitest";
import { applyHitCap, normalizeHitCapRule, STANDARD_HIT_CAP } from "./hitCaps";

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
  it("rejects NaN and infinite caps", () => {
    expect(() => applyHitCap(1000, { cap: Number.NaN })).toThrow(/invalid cap/);
    expect(() => applyHitCap(1000, { cap: Number.POSITIVE_INFINITY })).toThrow(/invalid cap/);
  });
  it("rejects negative caps and never emits negative damage", () => {
    expect(() => applyHitCap(1000, { cap: -1 })).toThrow(/invalid cap/);
    expect(applyHitCap(-50, { cap: 30_000 })).toBe(0);
  });
  it("floors non-integer caps", () => {
    expect(normalizeHitCapRule({ cap: 15_000.9 }).cap).toBe(15_000);
    expect(applyHitCap(20_000, { cap: 15_000.9 })).toBe(15_000);
  });
  it("preserves explicit bypass", () => {
    expect(applyHitCap(99_999, { cap: Number.NaN, bypass: true })).toBe(99_999);
  });
});
