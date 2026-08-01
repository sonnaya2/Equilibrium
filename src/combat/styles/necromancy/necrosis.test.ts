import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { necroInput } from "../../test/fixtures/inputs";
import { abilityById, lastCast } from "../../test/helpers/summary";
import { NECROMANCY_ABILITIES } from "./abilities";
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

describe("necrosis — discount and spend through the simulator", () => {
  it("Touch of Death builds Necrosis; FoD discounts cost and spends stacks", () => {
    const ctx = createCastContext(necroInput);
    const tod = abilityById(NECROMANCY_ABILITIES, "touch_of_death");
    const fod = abilityById(NECROMANCY_ABILITIES, "finger_of_death");
    ctx.performCast(tod, 0, false);
    ctx.performCast(tod, 3, false);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(8);
    expect(ctx.costOf(fod)).toBe(0);
    ctx.performCast(fod, 6, false);
    expect(ctx.getState().necromancy.resources.necrosisStacks).toBe(2);

    const s = simulate({
      ...necroInput,
      rotation: rotationOf("touch_of_death", "touch_of_death", "finger_of_death"),
    });
    expect(s.ok).toBe(true);
    expect(lastCast(s).result.expected).toBeCloseTo(3000);
  });
});
