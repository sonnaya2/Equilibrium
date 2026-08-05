import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../core/ticks";
import {
  beginNaragiActivation,
  consumeNaragiRevival,
  expireNaragiActivation,
  naragiActivationGate,
  naragiCooldownReadyTick,
  naragiEffectiveLevelOverride,
  naragiHealOffsetsTicks,
  naragiWindowActive,
  newNaragiRuntime,
  NARAGI_ACTIVE_DURATION_SECONDS,
  NARAGI_ACTIVE_DURATION_TICKS,
  NARAGI_COOLDOWN_SECONDS,
  NARAGI_COOLDOWN_TICKS,
  NARAGI_EDICT_RELIC,
  NARAGI_HEAL_AMOUNT,
  NARAGI_HEAL_COUNT,
  NARAGI_HEAL_INTERVAL_SECONDS,
  NARAGI_HEAL_INTERVAL_TICKS,
  NARAGI_LEVEL_OVERRIDE,
  SLIVER_OF_EDICTS_ACTIVATE_ID,
  SLIVER_OF_EDICTS_ID,
  SLIVER_PASSIVE,
  naragiEdictActive,
  isSliverOfEdictsWorn,
} from "./naragiEdict";

describe("naragiEdict constants", () => {
  it("uses exact tick conversions for wiki timings", () => {
    expect(NARAGI_HEAL_INTERVAL_TICKS).toBe(secondsToTicks(4.2));
    expect(NARAGI_ACTIVE_DURATION_TICKS).toBe(secondsToTicks(16.8));
    expect(NARAGI_COOLDOWN_TICKS).toBe(secondsToTicks(90));
    expect(NARAGI_HEAL_INTERVAL_TICKS).toBe(7);
    expect(NARAGI_ACTIVE_DURATION_TICKS).toBe(28);
    expect(NARAGI_COOLDOWN_TICKS).toBe(150);
    expect(NARAGI_ACTIVE_DURATION_SECONDS).toBe(16.8);
    expect(NARAGI_COOLDOWN_SECONDS).toBe(90);
    expect(NARAGI_HEAL_INTERVAL_SECONDS).toBe(4.2);
  });

  it("schedules four heal offsets at 7-tick spacing ending at duration", () => {
    expect(naragiHealOffsetsTicks()).toEqual([7, 14, 21, 28]);
    expect(naragiHealOffsetsTicks()).toHaveLength(NARAGI_HEAL_COUNT);
    expect(NARAGI_HEAL_AMOUNT * NARAGI_HEAL_COUNT).toBe(40_000);
  });

  it("matches stable ids and passive face numbers", () => {
    expect(NARAGI_EDICT_RELIC).toBe("Naragi Edict");
    expect(SLIVER_OF_EDICTS_ID).toBe("item:sliver-of-edicts");
    expect(SLIVER_PASSIVE).toEqual({
      armour: 300,
      styleDamage: 14,
      life: 1500,
      prayer: 15,
    });
    expect(NARAGI_LEVEL_OVERRIDE).toBe(255);
  });
});

describe("naragiEdictActive / worn", () => {
  it("detects relic and sliver by id", () => {
    expect(naragiEdictActive([NARAGI_EDICT_RELIC])).toBe(true);
    expect(naragiEdictActive(["Icyenic Faith"])).toBe(false);
    expect(isSliverOfEdictsWorn([SLIVER_OF_EDICTS_ID])).toBe(true);
    expect(isSliverOfEdictsWorn(["item:tome-of-the-icyene"])).toBe(false);
  });
});

describe("activation gate and lifecycle", () => {
  it("requires relic, equipped sliver, not active, and off cooldown", () => {
    const runtime = newNaragiRuntime();
    expect(
      naragiActivationGate({
        relicActive: false,
        sliverWorn: true,
        runtime,
        cooldowns: {},
        tick: 0,
      }).reason,
    ).toBe("relic-inactive");
    expect(
      naragiActivationGate({
        relicActive: true,
        sliverWorn: false,
        runtime,
        cooldowns: {},
        tick: 0,
      }).reason,
    ).toBe("sliver-unequipped");
    expect(
      naragiActivationGate({
        relicActive: true,
        sliverWorn: true,
        runtime,
        cooldowns: {},
        tick: 0,
      }).ok,
    ).toBe(true);

    const active = beginNaragiActivation(runtime, 10);
    expect(
      naragiActivationGate({
        relicActive: true,
        sliverWorn: true,
        runtime: active,
        cooldowns: {},
        tick: 10,
      }).reason,
    ).toBe("already-active");
    expect(
      naragiActivationGate({
        relicActive: true,
        sliverWorn: true,
        runtime: expireNaragiActivation(active),
        cooldowns: { [SLIVER_OF_EDICTS_ACTIVATE_ID]: 160 },
        tick: 50,
      }).reason,
    ).toBe("on-cooldown");
  });

  it("grants one revival for the half-open window only", () => {
    const active = beginNaragiActivation(newNaragiRuntime(), 0);
    expect(active.revivalCharges).toBe(1);
    expect(active.activeUntilTick).toBe(28);
    expect(naragiWindowActive(active, 0)).toBe(true);
    expect(naragiWindowActive(active, 27)).toBe(true);
    expect(naragiWindowActive(active, 28)).toBe(false);
    expect(naragiEffectiveLevelOverride(active, 10)).toBe(255);
    expect(naragiEffectiveLevelOverride(active, 28)).toBeNull();

    const first = consumeNaragiRevival(active, 5);
    expect(first.consumed).toBe(true);
    expect(first.runtime.revivalCharges).toBe(0);
    const second = consumeNaragiRevival(first.runtime, 6);
    expect(second.consumed).toBe(false);

    const expired = expireNaragiActivation(active);
    expect(expired.revivalCharges).toBe(0);
    expect(consumeNaragiRevival(expired, 5).consumed).toBe(false);
  });

  it("cooldown ready tick is activation + 150", () => {
    expect(naragiCooldownReadyTick(0)).toBe(150);
    expect(naragiCooldownReadyTick(20)).toBe(170);
  });
});
