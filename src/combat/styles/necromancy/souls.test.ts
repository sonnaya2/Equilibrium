import { describe, expect, it } from "vitest";
import {
  decaySouls,
  gainSoul,
  newResidualSouls,
  residualSoulCap,
  rollSpectralScytheSoul,
  spendAllSouls,
  spendSoul,
  VOLLEY_OF_SOULS_BAND,
} from "./souls";

describe("residual souls", () => {
  it("caps at 3, or 5 with a soulbound lantern", () => {
    let state = newResidualSouls();
    for (let i = 0; i < 6; i++) state = gainSoul(state, i);
    expect(state.souls).toBe(3);
    expect(residualSoulCap(newResidualSouls(true))).toBe(5);
  });

  it("spends one soul for Soul Strike, all for Volley", () => {
    let state = gainSoul(gainSoul(gainSoul(newResidualSouls(), 0), 1), 2);
    state = spendSoul(state);
    expect(state.souls).toBe(2);
    state = spendAllSouls(state);
    expect(state.souls).toBe(0);
    expect(VOLLEY_OF_SOULS_BAND).toEqual({ minPct: 135, maxPct: 165 });
  });

  it("decays after 6 seconds out of combat only", () => {
    let state = gainSoul(gainSoul(newResidualSouls(), 0), 1);
    state = decaySouls(state, 10, false);
    expect(state.souls).toBe(2);
    state = decaySouls(state, 11, false);
    expect(state.souls).toBe(0);

    state = gainSoul(state, 20);
    state = decaySouls(state, 100, true);
    expect(state.souls).toBe(1);
  });

  it("spectral scythe rolls 25% per target", () => {
    expect(rollSpectralScytheSoul(0.24)).toBe(true);
    expect(rollSpectralScytheSoul(0.25)).toBe(false);
  });
});
