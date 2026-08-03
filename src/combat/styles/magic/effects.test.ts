import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { magicInput } from "../../test/fixtures/inputs";
import { findCast } from "../../test/helpers/summary";
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
  it("base sunshine: +50% for 50 active ticks [cast+1, cast+51)", () => {
    const state = activateSunshine(10);
    expect(state.startsAtTick).toBe(11);
    expect(state.expiresAtTick).toBe(10 + 1 + SUNSHINE_DURATION_TICKS);
    expect(sunshineActive(state, 10)).toBe(false);
    expect(sunshineActive(state, 11)).toBe(true);
    expect(sunshineActive(state, 60)).toBe(true);
    expect(sunshineActive(state, 61)).toBe(false);
    expect(state.expiresAtTick - state.startsAtTick).toBe(50);
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
    expect(state.expiresAtTick - state.startsAtTick).toBe(64);
  });

  it("activateSunshine(greater) matches activateGreaterSunshine", () => {
    expect(activateSunshine(20, true)).toEqual(activateGreaterSunshine(20));
  });

  it("Planted Feet extends base Sunshine to 63 active ticks (wiki)", () => {
    const state = activateSunshine(0, false, true);
    expect(state.startsAtTick).toBe(1);
    expect(state.expiresAtTick).toBe(64);
    expect(sunshineActive(state, 0)).toBe(false);
    expect(sunshineActive(state, 1)).toBe(true);
    expect(sunshineActive(state, 63)).toBe(true);
    expect(sunshineActive(state, 64)).toBe(false);
    expect(state.expiresAtTick - state.startsAtTick).toBe(63);
  });

  it("Planted Feet does not change Greater Sunshine", () => {
    expect(activateSunshine(10, true, true)).toEqual(activateSunshine(10, true, false));
    expect(activateSunshine(10, true, true)).toEqual(activateGreaterSunshine(10));
  });
});

describe("instability lightning surge", () => {
  it("buff lasts 50 ticks from cast", () => {
    const state = activateInstability(10, 3);
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

describe("sunshine — buff window through the simulator", () => {
  it("base sunshine multiplies magic damage after the 1-tick delay", () => {
    const setup = [
      ...Array(12).fill("magic_attack"),
      "sunshine",
      "magic_attack",
      ...Array(17).fill("magic_attack"), // advance well past base 50-tick beam
    ];
    const s = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const sun = findCast(s, (cast) => cast.abilityId === "sunshine", "Missing Sunshine cast");
    expect(sun.tick).toBe(36);
    const inside = s.casts.filter((c) => c.abilityId === "magic_attack" && c.tick === 39)[0];
    expect(inside.result.expected).toBeCloseTo(1499.7512437810944, 10);
    const outside = s.casts.filter((c) => c.abilityId === "magic_attack" && c.tick >= 87)[0];
    expect(outside).toBeDefined();
    expect(outside.result.expected).toBeCloseTo(1000);
  });

  it("greater sunshine multiplies magic damage for the longer window", () => {
    const setup = [...Array(12).fill("magic_attack"), "greater_sunshine", "magic_attack"];
    const s = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const gs = findCast(
      s,
      (cast) => cast.abilityId === "greater_sunshine",
      "Missing Greater Sunshine cast",
    );
    const next = findCast(
      s,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > gs.tick,
      "Missing magic attack after Greater Sunshine",
    );
    expect(next.result.expected).toBeCloseTo(1499.7512437810944, 10);
  });

  it("Planted Feet extends base Sunshine buff window to 63 ticks", () => {
    const setup = [
      ...Array(12).fill("magic_attack"),
      "sunshine",
      ...Array(22).fill("magic_attack"), // GCDs: 39,42,...,102
    ];
    const plain = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    const pf = simulate({
      ...magicInput,
      plantedFeet: true,
      rotation: rotationOf(...setup),
    });
    expect(plain.ok && pf.ok).toBe(true);
    const plainAt87 = findCast(
      plain,
      (cast) => cast.abilityId === "magic_attack" && cast.tick === 87,
      "Missing plain magic attack at tick 87",
    );
    const pfAt87 = findCast(
      pf,
      (cast) => cast.abilityId === "magic_attack" && cast.tick === 87,
      "Missing Planted Feet magic attack at tick 87",
    );
    expect(plainAt87.result.expected).toBeCloseTo(1000);
    expect(pfAt87.result.expected).toBeCloseTo(1499.7512437810944, 10);
    // PF: cast@36 → active [37, 100). Tick 99 still buffed; first unbuffed GCD is 102.
    const pfAt99 = findCast(
      pf,
      (cast) => cast.abilityId === "magic_attack" && cast.tick === 99,
      "Missing Planted Feet magic attack at tick 99",
    );
    expect(pfAt99.result.expected).toBeCloseTo(1499.7512437810944, 10);
    const pfExpired = findCast(
      pf,
      (cast) => cast.abilityId === "magic_attack" && cast.tick === 102,
      "Missing Planted Feet magic attack at tick 102",
    );
    expect(pfExpired.result.expected).toBeCloseTo(1000);
  });

  it("Planted Feet does not extend Greater Sunshine", () => {
    const setup = [...Array(12).fill("magic_attack"), "greater_sunshine", "magic_attack"];
    const plain = simulate({ ...magicInput, rotation: rotationOf(...setup) });
    const pf = simulate({
      ...magicInput,
      plantedFeet: true,
      rotation: rotationOf(...setup),
    });
    const plainSunshine = findCast(
      plain,
      (cast) => cast.abilityId === "greater_sunshine",
      "Missing plain Greater Sunshine cast",
    );
    const plantedSunshine = findCast(
      pf,
      (cast) => cast.abilityId === "greater_sunshine",
      "Missing Planted Feet Greater Sunshine cast",
    );
    const plainNext = findCast(
      plain,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > plainSunshine.tick,
      "Missing plain follow-up magic attack",
    );
    const pfNext = findCast(
      pf,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > plantedSunshine.tick,
      "Missing Planted Feet follow-up magic attack",
    );
    expect(plainNext.result.expected).toBeCloseTo(pfNext.result.expected);
  });
});

describe("instability — surge damage through the simulator", () => {
  it("instability adds Lightning Surge EV on magic crits (not on 0% crit)", () => {
    const fund = [...Array(6).fill("magic_attack"), "instability", "magic_attack"];
    const noCrit = simulate({
      ...magicInput,
      crit: { chance: 0 },
      rotation: rotationOf(...fund),
    });
    expect(noCrit.ok).toBe(true);
    const inst = findCast(
      noCrit,
      (cast) => cast.abilityId === "instability",
      "Missing Instability cast",
    );
    expect(inst.result.expected).toBeCloseTo(1300);
    const follow = findCast(
      noCrit,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > inst.tick,
      "Missing magic attack after Instability",
    );
    expect(follow.result.expected).toBeCloseTo(1000);

    const allCrit = simulate({
      ...magicInput,
      crit: { chance: 1 },
      rotation: rotationOf(...fund),
    });
    const instCrit = findCast(
      allCrit,
      (cast) => cast.abilityId === "instability",
      "Missing crit Instability cast",
    );
    // The granting cast's own hit predates the buff: it crits but fires no surge.
    expect(instCrit.result.expected).toBeCloseTo(1949.7512437810944, 10);
    expect(allCrit.damageByTick[instCrit.tick + 1]).toBeUndefined();

    // A magic hit while the buff is active fires a surge 1 tick after the source hit.
    const followCrit = findCast(
      allCrit,
      (cast) => cast.abilityId === "magic_attack" && cast.tick > instCrit.tick,
      "Missing crit follow-up magic attack",
    );
    expect(followCrit.result.expected).toBeCloseTo(2699.502487562189, 10);
    expect(allCrit.damageByTick[followCrit.tick + 1]).toBeCloseTo(1199.7512437810944, 10);
  });
});
