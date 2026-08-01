import { describe, expect, it } from "vitest";
import {
  activePuncture,
  activateSearingWinds,
  activateShadowImbued,
  applyPuncture,
  DEATHSPORE_COOLDOWN_TICKS,
  DEATHSPORE_FREE_ABILITY_STACKS,
  DEATHSPORE_FREE_CAST_WINDOW_TICKS,
  deathsporeFreeCastActive,
  extendSearingWinds,
  extendShadowImbued,
  newDeathspore,
  newPuncture,
  newShadowImbued,
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
  it("builds one stack per landed hit; the 12th triggers the buff and the shared cooldown", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS - 1; i++) state = onRangedHit(state, i);
    expect(state.stacks).toBe(DEATHSPORE_FREE_ABILITY_STACKS - 1);
    expect(deathsporeFreeCastActive(state, 11)).toBe(false);
    state = onRangedHit(state, 11);
    expect(state.stacks).toBe(0);
    expect(state.freeCastUntilTick).toBe(11 + DEATHSPORE_FREE_CAST_WINDOW_TICKS);
    expect(state.cooldownUntilTick).toBe(11 + DEATHSPORE_COOLDOWN_TICKS);
    expect(deathsporeFreeCastActive(state, 11)).toBe(true);
  });

  it("free-cast window is half-open: active at untilTick - 1, gone at untilTick", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS; i++) state = onRangedHit(state, 0);
    const last = state.freeCastUntilTick - 1;
    expect(deathsporeFreeCastActive(state, last)).toBe(true);
    expect(deathsporeFreeCastActive(state, state.freeCastUntilTick)).toBe(false);
    expect(deathsporeFreeCastActive(state, state.freeCastUntilTick + 5)).toBe(false);
  });

  it("rejects stack generation during the cooldown, then rebuilds after it", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS; i++) state = onRangedHit(state, 0);
    const during = onRangedHit(state, 10);
    expect(during.stacks).toBe(0);
    expect(onRangedHit(during, state.cooldownUntilTick - 1).stacks).toBe(0);
    expect(onRangedHit(during, state.cooldownUntilTick).stacks).toBe(1);
  });

  it("a free cast consumes the buff while the cooldown keeps running", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS; i++) state = onRangedHit(state, 0);
    state = spendDeathspore(state, 3);
    expect(deathsporeFreeCastActive(state, 3)).toBe(false);
    expect(state.cooldownUntilTick).toBe(DEATHSPORE_COOLDOWN_TICKS);
    expect(onRangedHit(state, 3).stacks).toBe(0);
  });

  it("spending without an active buff changes nothing", () => {
    const state = newDeathspore();
    expect(spendDeathspore(state, 0)).toBe(state);
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

  it("shadow tendrils extends an active window by 6 ticks", () => {
    const state = extendShadowImbued(activateShadowImbued(0), 0);
    expect(state.expiresAtTick).toBe(56);
  });

  it("shadow tendrils never creates a window from nothing", () => {
    expect(extendShadowImbued(newShadowImbued(), 0)).toEqual(newShadowImbued());
    expect(extendShadowImbued(activateShadowImbued(0), 60).expiresAtTick).toBe(50);
  });
});
