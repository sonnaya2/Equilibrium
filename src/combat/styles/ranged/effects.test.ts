import { describe, expect, it } from "vitest";
import {
  activateDeathsSwiftness,
  DEATHS_SWIFTNESS_MULTIPLIER,
  deathsSwiftnessActive,
  deathsSwiftnessMultiplier,
  newDeathsSwiftness,
} from "./effects";

describe("death's swiftness", () => {
  it("grants 1.5x for 50 ticks, with the buff beginning 1 tick after cast", () => {
    const state = activateDeathsSwiftness(10);
    expect(state.startsAtTick).toBe(11);
    expect(state.expiresAtTick).toBe(60);
    expect(deathsSwiftnessMultiplier(state, 10)).toBe(1);
    expect(deathsSwiftnessMultiplier(state, 11)).toBe(DEATHS_SWIFTNESS_MULTIPLIER);
    expect(deathsSwiftnessMultiplier(state, 59)).toBe(DEATHS_SWIFTNESS_MULTIPLIER);
    expect(deathsSwiftnessMultiplier(state, 60)).toBe(1);
  });

  it("greater lasts 63 ticks from cast (62 of actual buff)", () => {
    const state = activateDeathsSwiftness(0, true);
    expect(state.startsAtTick).toBe(1);
    expect(state.expiresAtTick).toBe(63);
    expect(deathsSwiftnessActive(state, 0)).toBe(false);
    expect(deathsSwiftnessActive(state, 62)).toBe(true);
    expect(deathsSwiftnessActive(state, 63)).toBe(false);
  });

  it("Planted Feet extends base Death's Swiftness to 63 ticks (wiki)", () => {
    const state = activateDeathsSwiftness(0, false, true);
    expect(state.startsAtTick).toBe(1);
    expect(state.expiresAtTick).toBe(63);
    expect(deathsSwiftnessActive(state, 1)).toBe(true);
    expect(deathsSwiftnessActive(state, 62)).toBe(true);
    expect(deathsSwiftnessActive(state, 63)).toBe(false);
  });

  it("Planted Feet does not change Greater Death's Swiftness", () => {
    expect(activateDeathsSwiftness(5, true, true)).toEqual(activateDeathsSwiftness(5, true, false));
  });

  it("is inactive before activation", () => {
    expect(deathsSwiftnessActive(newDeathsSwiftness(), 0)).toBe(false);
  });
});
