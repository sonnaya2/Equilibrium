import { describe, expect, it } from "vitest";
import {
  activateRunicCharge,
  animaCharged,
  consumeAnima,
  newRunicCharge,
  RUNIC_EMPOWERMENTS,
  runicChargeReady,
} from "./runicCharge";

describe("runic charge", () => {
  it("applies Anima Charged for 15s and holds the 30s cooldown", () => {
    const state = activateRunicCharge(newRunicCharge(), 10);
    expect(state.animaUntilTick).toBe(10 + 25);
    expect(state.cooldownUntilTick).toBe(10 + 50);
    expect(animaCharged(state, 34)).toBe(true);
    expect(animaCharged(state, 35)).toBe(false);
    expect(runicChargeReady(state, 59)).toBe(false);
    expect(runicChargeReady(state, 60)).toBe(true);
  });

  it("cannot be recast during its cooldown", () => {
    let state = activateRunicCharge(newRunicCharge(), 0);
    state = activateRunicCharge(state, 10);
    expect(state.animaUntilTick).toBe(25);
  });

  it("one empowerment consumes the window but not the cooldown", () => {
    let state = activateRunicCharge(newRunicCharge(), 0);
    state = consumeAnima(state);
    expect(animaCharged(state, 1)).toBe(false);
    expect(runicChargeReady(state, 1)).toBe(false);
    expect(runicChargeReady(state, 50)).toBe(true);
  });

  it("empowerment data matches the sourced values", () => {
    expect(RUNIC_EMPOWERMENTS.dragon_breath.band).toEqual({ minPct: 260, maxPct: 310 });
    expect(RUNIC_EMPOWERMENTS.sonic_wave.nextAbilityCostReductionPct).toBe(35);
    expect(RUNIC_EMPOWERMENTS.concentrated_blast.critChanceGrantPct).toBe(15);
  });
});
