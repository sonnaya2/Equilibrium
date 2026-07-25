import { describe, expect, it } from "vitest";
import {
  consumeAllNecrosis,
  consumeFingerOfDeath,
  deathGraspBonusPct,
  fingerOfDeathDiscountPct,
  gainNecrosis,
  NECROSIS_CAP,
  newNecrosis,
  TOUCH_OF_DEATH_NECROSIS,
} from "./necrosis";

describe("necrosis", () => {
  it("caps at 12 stacks", () => {
    let state = newNecrosis();
    for (let i = 0; i < 5; i++) state = gainNecrosis(state, TOUCH_OF_DEATH_NECROSIS);
    expect(state.stacks).toBe(NECROSIS_CAP);
  });

  it("finger of death discounts and spends up to 6 stacks", () => {
    let state = gainNecrosis(newNecrosis(), 8);
    expect(fingerOfDeathDiscountPct(state)).toBe(60);
    state = consumeFingerOfDeath(state);
    expect(state.stacks).toBe(2);
    expect(fingerOfDeathDiscountPct(state)).toBe(20);
  });

  it("death grasp scales per stack and consumes all", () => {
    let state = gainNecrosis(newNecrosis(), 5);
    expect(deathGraspBonusPct(state)).toBe(200);
    state = consumeAllNecrosis();
    expect(state.stacks).toBe(0);
  });
});
