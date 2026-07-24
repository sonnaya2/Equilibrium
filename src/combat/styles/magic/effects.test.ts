import { describe, expect, it } from "vitest";
import {
  channelledMightCritBonus,
  CHANNELLED_MIGHT_CRIT_DAMAGE_BONUS,
  grantChannelledMight,
  newChannelledMight,
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
