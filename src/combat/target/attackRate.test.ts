import { describe, expect, it } from "vitest";
import { attackRateTicksToIntervalSeconds } from "./attackRate";
import { combatTargetPresets } from "../data";
import { materializeTargetPreset } from "./presetAdapter";

describe("attackRateTicksToIntervalSeconds", () => {
  it("converts wiki ticks at 0.6s", () => {
    expect(attackRateTicksToIntervalSeconds(2)).toBe(1.2);
    expect(attackRateTicksToIntervalSeconds(4)).toBe(2.4);
    expect(attackRateTicksToIntervalSeconds(6)).toBe(3.6);
  });

  it("rejects missing or non-positive rates", () => {
    expect(attackRateTicksToIntervalSeconds(undefined)).toBeUndefined();
    expect(attackRateTicksToIntervalSeconds(null)).toBeUndefined();
    expect(attackRateTicksToIntervalSeconds(0)).toBeUndefined();
    expect(attackRateTicksToIntervalSeconds(-1)).toBeUndefined();
    expect(attackRateTicksToIntervalSeconds(Number.NaN)).toBeUndefined();
  });
});

describe("shipped boss attack rates", () => {
  // Calibration from https://runescape.wiki/w/Attack_rate and boss infoboxes.
  it("seeds known wiki rates on calibration bosses", () => {
    const zilyana = combatTargetPresets.records.find((r) => r.id === "boss:commander-zilyana");
    const kbd = combatTargetPresets.records.find((r) => r.id === "boss:king-black-dragon");
    const graardor = combatTargetPresets.records.find((r) => r.id === "boss:general-graardor");
    expect(zilyana?.stats.attackRateTicks).toBe(2);
    expect(kbd?.stats.attackRateTicks).toBe(4);
    expect(graardor?.stats.attackRateTicks).toBe(6);
  });

  it("materializes interval from ticks", () => {
    const kbd = combatTargetPresets.records.find((r) => r.id === "boss:king-black-dragon")!;
    const fields = materializeTargetPreset(kbd, { style: "melee" });
    expect(fields?.incomingHitIntervalSeconds).toBe(2.4);
    expect(fields?.attackRateTicks).toBe(4);
  });
});
