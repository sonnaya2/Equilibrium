import { describe, expect, it } from "vitest";
import {
  applyBlackStoneArmourReduction,
  blackStoneActiveAtTick,
  clearBlackStoneDebuff,
  effectiveBaseArmourAtTick,
  newBlackStoneArmourState,
  resetBlackStoneOnTargetDeath,
} from "./blackStone";

describe("Black Stone armour reduction", () => {
  it("starts the twelve-minute window on the first landed reduction", () => {
    const initial = newBlackStoneArmourState(4000);
    expect(initial.appliedAtTick).toBeNull();
    const result = applyBlackStoneArmourReduction(initial, 500);
    expect(result.reduction).toBe(22);
    expect(result.state).toMatchObject({
      originalBaseArmour: 4000,
      applications: 1,
      reducedRating: 22,
      appliedAtTick: 500,
      expiresAtTick: 1700,
    });
  });

  it("uses the original baseline as live armour falls and refreshes on success", () => {
    let state = newBlackStoneArmourState(4000);
    for (let tick = 0; tick < 30; tick += 1) {
      const result = applyBlackStoneArmourReduction(state, tick);
      state = result.state;
    }
    expect(state.reducedRating).toBe(454);
    expect(state.applications).toBe(21);
    expect(effectiveBaseArmourAtTick(state, 29)).toBe(3546);
    expect(state.expiresAtTick).toBe(1220);
  });

  it("uses half-open expiry and does not refresh after the cap", () => {
    let state = newBlackStoneArmourState(4000);
    for (let tick = 0; tick < 21; tick += 1) {
      const result = applyBlackStoneArmourReduction(state, tick);
      state = result.state;
    }
    const expiryBeforeCappedHit = state.expiresAtTick;
    const capped = applyBlackStoneArmourReduction(state, 21);
    expect(capped.reduction).toBe(0);
    expect(capped.state.expiresAtTick).toBe(expiryBeforeCappedHit);
    expect(blackStoneActiveAtTick(state, expiryBeforeCappedHit! - 1)).toBe(true);
    expect(blackStoneActiveAtTick(state, expiryBeforeCappedHit!)).toBe(false);
  });

  it("pins low-armour rounding and re-applies after expiry from the same baseline", () => {
    const lowArmour = applyBlackStoneArmourReduction(newBlackStoneArmourState(1000), 0);
    expect(lowArmour.reduction).toBe(7);
    const state = applyBlackStoneArmourReduction(newBlackStoneArmourState(4000), 10).state;
    expect(effectiveBaseArmourAtTick(state, 1210)).toBe(4000);
    const reapplied = applyBlackStoneArmourReduction(state, 1210);
    expect(reapplied.state).toMatchObject({
      originalBaseArmour: 4000,
      applications: 1,
      reducedRating: 22,
      appliedAtTick: 1210,
      expiresAtTick: 2410,
    });
    expect(reapplied.effectiveBaseArmour).toBe(3978);
  });

  it("keeps target-death and explicit clear reset reasons distinct", () => {
    const state = newBlackStoneArmourState(4000);
    expect(resetBlackStoneOnTargetDeath(state)).toMatchObject({ reason: "target-death" });
    expect(clearBlackStoneDebuff(state)).toMatchObject({ reason: "debuff-clear" });
  });
});
