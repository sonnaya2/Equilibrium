import { describe, expect, it } from "vitest";
import {
  makeLevelOverride,
  resolveEffectiveCombatLevel,
  levelOverrideActive,
} from "./effectiveLevel";

describe("effectiveLevel override", () => {
  it("returns exact override while half-open window is active", () => {
    const o = makeLevelOverride(28, 255);
    expect(levelOverrideActive(o, 0)).toBe(true);
    expect(levelOverrideActive(o, 27)).toBe(true);
    expect(levelOverrideActive(o, 28)).toBe(false);
    expect(resolveEffectiveCombatLevel(120, o, 10)).toBe(255);
    expect(resolveEffectiveCombatLevel(120, o, 28)).toBe(120);
  });

  it("does not stack base boosts above the override", () => {
    const o = makeLevelOverride(10, 255);
    // base already includes overload
    expect(resolveEffectiveCombatLevel(145, o, 0)).toBe(255);
  });

  it("leaves base unchanged when inactive", () => {
    expect(resolveEffectiveCombatLevel(99, null, 0)).toBe(99);
    expect(resolveEffectiveCombatLevel(116, { untilTick: 0, level: 255 }, 5)).toBe(116);
  });
});
