import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import { findCast } from "../../test/helpers/summary";
import {
  activateDeathsSwiftness,
  DEATHS_SWIFTNESS_MULTIPLIER,
  deathsSwiftnessActive,
  deathsSwiftnessMultiplier,
  newDeathsSwiftness,
} from "./effects";

describe("death's swiftness", () => {
  it("grants 1.5x for 50 active ticks beginning 1 tick after cast", () => {
    const state = activateDeathsSwiftness(10);
    expect(state.startsAtTick).toBe(11);
    expect(state.expiresAtTick).toBe(61);
    expect(deathsSwiftnessMultiplier(state, 10)).toBe(1);
    expect(deathsSwiftnessMultiplier(state, 11)).toBe(DEATHS_SWIFTNESS_MULTIPLIER);
    expect(deathsSwiftnessMultiplier(state, 60)).toBe(DEATHS_SWIFTNESS_MULTIPLIER);
    expect(deathsSwiftnessMultiplier(state, 61)).toBe(1);
    expect(state.expiresAtTick - state.startsAtTick).toBe(50);
  });

  it("greater lasts 63 active ticks after the 1-tick delay", () => {
    const state = activateDeathsSwiftness(0, true);
    expect(state.startsAtTick).toBe(1);
    expect(state.expiresAtTick).toBe(64);
    expect(deathsSwiftnessActive(state, 0)).toBe(false);
    expect(deathsSwiftnessActive(state, 63)).toBe(true);
    expect(deathsSwiftnessActive(state, 64)).toBe(false);
    expect(state.expiresAtTick - state.startsAtTick).toBe(63);
  });

  it("Planted Feet extends base Death's Swiftness to 63 active ticks (wiki)", () => {
    const state = activateDeathsSwiftness(0, false, true);
    expect(state.startsAtTick).toBe(1);
    expect(state.expiresAtTick).toBe(64);
    expect(deathsSwiftnessActive(state, 1)).toBe(true);
    expect(deathsSwiftnessActive(state, 63)).toBe(true);
    expect(deathsSwiftnessActive(state, 64)).toBe(false);
    expect(state.expiresAtTick - state.startsAtTick).toBe(63);
  });

  it("Planted Feet does not change Greater Death's Swiftness", () => {
    expect(activateDeathsSwiftness(5, true, true)).toEqual(activateDeathsSwiftness(5, true, false));
  });

  it("is inactive before activation", () => {
    expect(deathsSwiftnessActive(newDeathsSwiftness(), 0)).toBe(false);
  });

  it("Planted Feet extends base Death's Swiftness buff window to 63 ticks", () => {
    const setup = [
      ...Array(12).fill("ranged_attack"),
      "deaths_swiftness",
      ...Array(22).fill("ranged_attack"),
    ];
    const plain = simulate({ ...rangedInput, rotation: rotationOf(...setup) });
    const pf = simulate({
      ...rangedInput,
      plantedFeet: true,
      rotation: rotationOf(...setup),
    });
    expect(plain.ok && pf.ok).toBe(true);
    const plainAt87 = findCast(
      plain,
      (cast) => cast.abilityId === "ranged_attack" && cast.tick === 87,
      "Missing plain ranged attack at tick 87",
    );
    const pfAt87 = findCast(
      pf,
      (cast) => cast.abilityId === "ranged_attack" && cast.tick === 87,
      "Missing Planted Feet ranged attack at tick 87",
    );
    expect(plainAt87.result.expected).toBeCloseTo(1000);
    expect(pfAt87.result.expected).toBeCloseTo(1499.7512437810944, 10);
  });
});
