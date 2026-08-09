import { describe, expect, it } from "vitest";
import {
  BOLT_DEATHMARK_ACTIVATION_ADRENALINE,
  BOLT_DEATHMARK_BASIC_ADRENALINE_BONUS,
  BOLT_DEATHMARK_DURATION_TICKS,
  activateBoltDeathmark,
  boltDeathmarkActive,
  boltDeathmarkBasicAdrenalineBonus,
  inactiveBoltDeathmark,
} from "./enchantedBoltRuntime";

describe("enchanted-bolt Deathmark state", () => {
  it("uses a half-open 15-second window", () => {
    expect(BOLT_DEATHMARK_DURATION_TICKS).toBe(25);
    const state = activateBoltDeathmark(7);
    expect(boltDeathmarkActive(state, 7)).toBe(true);
    expect(boltDeathmarkActive(state, 31)).toBe(true);
    expect(boltDeathmarkActive(state, 32)).toBe(false);
  });

  it("refreshes from the latest activation tick", () => {
    const refreshed = activateBoltDeathmark(activateBoltDeathmark(7).expiresAtTick - 1);
    expect(refreshed.expiresAtTick).toBe(56);
  });

  it("exposes distinct activation and generating-basic grants", () => {
    expect(BOLT_DEATHMARK_ACTIVATION_ADRENALINE).toBe(10);
    expect(BOLT_DEATHMARK_BASIC_ADRENALINE_BONUS).toBe(1);
    expect(boltDeathmarkBasicAdrenalineBonus(inactiveBoltDeathmark(), 0)).toBe(0);
    expect(boltDeathmarkBasicAdrenalineBonus(activateBoltDeathmark(3), 12)).toBe(1);
  });

  it("rejects invalid activation ticks", () => {
    expect(() => activateBoltDeathmark(-1)).toThrow(RangeError);
    expect(() => activateBoltDeathmark(1.5)).toThrow(RangeError);
  });
});
