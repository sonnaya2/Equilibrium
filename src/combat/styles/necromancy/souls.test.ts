import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { necroInput } from "../../test/fixtures/inputs";
import { abilityById, lastCast } from "../../test/helpers/summary";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "./abilities";
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

describe("residual souls — spending through the simulator", () => {
  it("Soul Sap builds residual souls and Soul Strike spends one", () => {
    const ctx = createCastContext(necroInput);
    const soulSap = abilityById(NECROMANCY_ABILITIES, "soul_sap");
    ctx.performCast(soulSap, 0, false);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(1);
    ctx.performCast(soulSap, 3, false);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(2);
    ctx.performCast(abilityById(NECROMANCY_ABILITIES, "soul_strike"), 6, false);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(1);
  });

  it("fails Soul Strike without residual souls", () => {
    const s = simulate({ ...necroInput, rotation: rotationOf("soul_strike") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("residual souls");
  });

  it("Volley spends all souls and deals one hit per residual soul held", () => {
    const s = simulate({
      ...necroInput,
      rotation: rotationOf("soul_sap", "soul_sap", "soul_sap", "volley_of_souls"),
    });
    expect(s.ok).toBe(true);
    expect(lastCast(s).result.expected).toBeCloseTo(3 * 1500);
    const ctx = createCastContext(necroInput);
    const sap = abilityById(NECROMANCY_ABILITIES, "soul_sap");
    for (let i = 0; i < 3; i++) ctx.performCast(sap, i * 3, false);
    ctx.performCast(volleyOfSouls(3), 9, false);
    expect(ctx.getState().necromancy.resources.residualSouls).toBe(0);
  });

  it("Spectral Scythe grants a residual soul when spectral_scythe_soul procs", () => {
    const scythe = abilityById(NECROMANCY_ABILITIES, "spectral_scythe");
    const input = { ...necroInput, startingAdrenaline: 100 };
    const proc = createCastContext(input);
    expect(proc.performCast(scythe, 0, false, { spectral_scythe_soul: true }).ok).toBe(true);
    expect(proc.getState().necromancy.resources.residualSouls).toBe(1);

    const flat = createCastContext(input);
    expect(flat.performCast(scythe, 0, false, { spectral_scythe_soul: false }).ok).toBe(true);
    expect(flat.getState().necromancy.resources.residualSouls).toBe(0);
  });
});
