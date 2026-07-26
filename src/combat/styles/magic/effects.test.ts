import { describe, expect, it } from "vitest";
import {
  activateGreaterSunshine,
  activateInstability,
  activateSunshine,
  channelledMightCritBonus,
  CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS,
  GREATER_SUNSHINE_BUFF_TICKS,
  grantChannelledMight,
  INSTABILITY_DURATION_TICKS,
  instabilityActive,
  LIGHTNING_SURGE_BAND,
  LIGHTNING_SURGE_TICK_DELAY,
  lightningSurgeExpected,
  newChannelledMight,
  newInstability,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_DURATION_TICKS,
  sunshineActive,
  TUMEKENS_CHANNELLED_MIGHT,
} from "./effects";

describe("channelled might", () => {
  it("grants +15% magic crit damage for 3.6s after a full channel", () => {
    const state = grantChannelledMight(10);
    expect(state.expiresAtTick).toBe(16);
    expect(channelledMightCritBonus(state, 15)).toBe(CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS);
    expect(channelledMightCritBonus(state, 16)).toBe(0);
  });

  it("models the Tumeken's resplendence 5-piece as data", () => {
    const state = grantChannelledMight(0, true);
    expect(state.critDamageBonus).toBe(TUMEKENS_CHANNELLED_MIGHT.critDamageBonus);
    expect(state.expiresAtTick).toBe(15);
  });

  it("is inactive by default", () => {
    expect(channelledMightCritBonus(newChannelledMight(), 0)).toBe(0);
  });
});

describe("sunshine damage buff", () => {
  it("base sunshine: +50% for ticks [cast+1, cast+50)", () => {
    const state = activateSunshine(10);
    expect(state.startsAtTick).toBe(11);
    expect(state.expiresAtTick).toBe(10 + SUNSHINE_DURATION_TICKS);
    expect(sunshineActive(state, 10)).toBe(false);
    expect(sunshineActive(state, 11)).toBe(true);
    expect(sunshineActive(state, 59)).toBe(true);
    expect(sunshineActive(state, 60)).toBe(false);
    expect(SUNSHINE_DAMAGE_MULTIPLIER).toBe(1.5);
  });

  it("greater sunshine: +50% for 64 ticks starting 1 tick after cast", () => {
    const state = activateGreaterSunshine(10);
    expect(state.startsAtTick).toBe(11);
    expect(state.expiresAtTick).toBe(11 + GREATER_SUNSHINE_BUFF_TICKS);
    expect(sunshineActive(state, 10)).toBe(false);
    expect(sunshineActive(state, 11)).toBe(true);
    expect(sunshineActive(state, 74)).toBe(true);
    expect(sunshineActive(state, 75)).toBe(false);
  });

  it("activateSunshine(greater) matches activateGreaterSunshine", () => {
    expect(activateSunshine(20, true)).toEqual(activateGreaterSunshine(20));
  });

  it("Planted Feet extends base Sunshine to 63 ticks (wiki)", () => {
    const state = activateSunshine(0, false, true);
    expect(state.startsAtTick).toBe(1);
    expect(state.expiresAtTick).toBe(63);
    expect(sunshineActive(state, 0)).toBe(false);
    expect(sunshineActive(state, 1)).toBe(true);
    expect(sunshineActive(state, 62)).toBe(true);
    expect(sunshineActive(state, 63)).toBe(false);
  });

  it("Planted Feet does not change Greater Sunshine", () => {
    expect(activateSunshine(10, true, true)).toEqual(activateSunshine(10, true, false));
    expect(activateSunshine(10, true, true)).toEqual(activateGreaterSunshine(10));
  });
});

describe("instability lightning surge", () => {
  it("buff lasts 50 ticks from cast", () => {
    const state = activateInstability(10);
    expect(state.expiresAtTick).toBe(10 + INSTABILITY_DURATION_TICKS);
    expect(instabilityActive(state, 10)).toBe(true);
    expect(instabilityActive(state, 59)).toBe(true);
    expect(instabilityActive(state, 60)).toBe(false);
    expect(instabilityActive(newInstability(), 0)).toBe(false);
  });

  it("surge EV is p * T; zero when p is 0", () => {
    expect(lightningSurgeExpected(0, 800)).toBe(0);
    expect(lightningSurgeExpected(0.5, 800)).toBe(400);
    expect(lightningSurgeExpected(1, 800)).toBe(800);
    expect(lightningSurgeExpected(1.5, 800)).toBe(800); // clamp
  });

  it("wiki bands and delay are locked", () => {
    expect(LIGHTNING_SURGE_BAND).toEqual({ minPct: 70, maxPct: 90 });
    expect(LIGHTNING_SURGE_TICK_DELAY).toBe(1);
  });
});
