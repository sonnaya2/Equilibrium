import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { magicInput } from "../../test/fixtures/inputs";
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

describe("runic charge — off-GCD casting and empowerment", () => {
  it("runic charge casts off-GCD and empowers the next dragon breath", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf("runic_charge", "magic_attack", "dragon_breath"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].tick).toBe(0);
    expect(s.casts[1].tick).toBe(0);
    expect(s.casts[2].abilityId).toBe("dragon_breath");
    expect(s.casts[2].result.expected).toBeCloseTo(2850);
    // Same basic: +9 adrenaline and the normal cooldown.
    expect(s.casts[2].adrenalineAfter).toBe(9 + 9);
  });

  it("dragon breath resolves unempowered without an active charge", () => {
    const s = simulate({ ...magicInput, rotation: rotationOf("dragon_breath") });
    expect(s.ok).toBe(true);
    expect(s.casts[0].result.expected).toBeCloseTo(1200);
  });

  it("runic charge cannot be recast inside its cooldown", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf("runic_charge", "magic_attack", "runic_charge"),
    });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("on cooldown");
  });
});
