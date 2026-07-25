import { describe, expect, it } from "vitest";
import {
  applyCombust,
  burnActive,
  COMBUST_BAND,
  COMBUST_HITS,
  combustHitTicks,
  newBurns,
  rollRuneConsumption,
  RUNE_CONSUMPTION_CHANCE,
} from "./burn";

describe("burns", () => {
  it("combust schedules 10 hits every 3 ticks", () => {
    const ticks = combustHitTicks(0);
    expect(ticks).toHaveLength(COMBUST_HITS);
    expect(ticks[0]).toBe(3);
    expect(ticks.at(-1)).toBe(30);
    expect(COMBUST_BAND).toEqual({ minPct: 27, maxPct: 33 });
  });

  it("stays active for the scheduled window and then ends", () => {
    const state = applyCombust(newBurns(), 5);
    expect(burnActive(state, "combust", 34)).toBe(true);
    expect(burnActive(state, "combust", 35)).toBe(false);
    expect(burnActive(state, "corruption_blast", 10)).toBe(false);
  });
});

describe("rune consumption", () => {
  it("rolls against the 15% post-refinement chance", () => {
    expect(RUNE_CONSUMPTION_CHANCE).toBe(0.15);
    expect(rollRuneConsumption(0.14)).toBe(true);
    expect(rollRuneConsumption(0.15)).toBe(false);
  });
});
