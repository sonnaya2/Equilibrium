import { describe, expect, it } from "vitest";
import {
  activePuncture,
  activateSearingWinds,
  activateShadowImbued,
  applyPuncture,
  DEATHSPORE_FREE_ABILITY_STACKS,
  deathsporeReady,
  extendSearingWinds,
  extendShadowImbued,
  newDeathspore,
  newPuncture,
  onRangedHit,
  PUNCTURE_CAP,
  punctureBonusPct,
  searingWindsBonusPct,
  shadowImbuedAdrenalinePerHit,
  spendDeathspore,
} from "./onHit";

describe("puncture", () => {
  it("builds one stack per application and reports the bonus as data", () => {
    let state = newPuncture();
    state = applyPuncture(state, 0);
    state = applyPuncture(state, 3);
    expect(state.stacks).toBe(2);
    expect(punctureBonusPct(state, 3)).toBe(2);
  });

  it("caps at 250 stacks", () => {
    let state = newPuncture();
    for (let i = 0; i < 300; i++) state = applyPuncture(state, i);
    expect(state.stacks).toBe(PUNCTURE_CAP);
  });

  it("refreshes the 30-second window on application and expires to zero", () => {
    let state = applyPuncture(newPuncture(), 0);
    state = applyPuncture(state, 40, 4);
    expect(state.expiresAtTick).toBe(40 + 50);
    expect(activePuncture(state, 89).stacks).toBe(5);
    expect(activePuncture(state, 90).stacks).toBe(0);
    expect(punctureBonusPct(state, 90)).toBe(0);
  });
});

describe("deathspore arrows", () => {
  it("builds per hit and caps at the free-ability threshold", () => {
    let state = newDeathspore();
    for (let i = 0; i < 20; i++) state = onRangedHit(state);
    expect(state.stacks).toBe(DEATHSPORE_FREE_ABILITY_STACKS);
  });

  it("is ready at 12 and spends only when ready", () => {
    let state = newDeathspore();
    expect(spendDeathspore(state)).toBe(state);
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS; i++) state = onRangedHit(state);
    expect(deathsporeReady(state)).toBe(true);
    state = spendDeathspore(state);
    expect(state.stacks).toBe(0);
    expect(deathsporeReady(state)).toBe(false);
  });

  it("counts multi-hit abilities per hit", () => {
    expect(onRangedHit(newDeathspore(), 4).stacks).toBe(4);
  });
});

describe("searing winds", () => {
  it("grants the +20% bonus hit for 10 ticks and rapid fire extends it", () => {
    let state = activateSearingWinds(5);
    expect(searingWindsBonusPct(state, 14)).toBe(20);
    expect(searingWindsBonusPct(state, 15)).toBe(0);
    state = extendSearingWinds(state, 4);
    expect(state.expiresAtTick).toBe(19);
    expect(searingWindsBonusPct(state, 18)).toBe(20);
  });
});

describe("shadow imbued", () => {
  it("grants +5% adrenaline per hit for 50 ticks", () => {
    const state = activateShadowImbued(0);
    expect(shadowImbuedAdrenalinePerHit(state, 49)).toBe(5);
    expect(shadowImbuedAdrenalinePerHit(state, 50)).toBe(0);
  });

  it("shadow tendrils extends the window by 6 ticks", () => {
    const state = extendShadowImbued(activateShadowImbued(0));
    expect(state.expiresAtTick).toBe(56);
  });
});
