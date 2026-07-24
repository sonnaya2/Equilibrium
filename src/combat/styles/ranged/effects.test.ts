import { describe, expect, it } from "vitest";
import {
  activateDeathsSwiftness,
  DEATHS_SWIFTNESS_MULTIPLIER,
  deathsSwiftnessActive,
  deathsSwiftnessMultiplier,
  newDeathsSwiftness,
} from "./effects";

describe("death's swiftness", () => {
  it("grants 1.5x for 30 seconds (50 ticks)", () => {
    const state = activateDeathsSwiftness(10);
    expect(state.expiresAtTick).toBe(60);
    expect(deathsSwiftnessMultiplier(state, 59)).toBe(DEATHS_SWIFTNESS_MULTIPLIER);
    expect(deathsSwiftnessMultiplier(state, 60)).toBe(1);
  });

  it("greater lasts 37.8 seconds (63 ticks)", () => {
    const state = activateDeathsSwiftness(0, true);
    expect(state.expiresAtTick).toBe(63);
    expect(deathsSwiftnessActive(state, 62)).toBe(true);
    expect(deathsSwiftnessActive(state, 63)).toBe(false);
  });

  it("is inactive before activation", () => {
    expect(deathsSwiftnessActive(newDeathsSwiftness(), 0)).toBe(false);
  });
});
