import { describe, expect, it } from "vitest";
import {
  formatRingOfVigourSources,
  hasRingOfVigourEffect,
  isRingOfVigourPassiveAvailable,
  isRingOfVigourPassiveEffective,
  isRingOfVigourWorn,
  isWeaponSpecialAbility,
  RING_OF_VIGOUR_ITEM_ID,
  RING_OF_VIGOUR_REFUND,
  resolveSpecialAttackAdrenalineCost,
  ringOfVigourActiveSources,
} from "./ringOfVigour";

describe("hasRingOfVigourEffect (activation matrix)", () => {
  it("ring off + passive off = inactive", () => {
    expect(
      hasRingOfVigourEffect({
        equipmentIds: [],
        ringOfVigourPassive: false,
        unlockedRegions: ["anachronia"],
      }),
    ).toBe(false);
  });

  it("ring on + passive off = active once", () => {
    expect(
      hasRingOfVigourEffect({
        equipmentIds: [RING_OF_VIGOUR_ITEM_ID],
        ringOfVigourPassive: false,
        unlockedRegions: [],
      }),
    ).toBe(true);
  });

  it("ring off + passive on = active once (Anachronia)", () => {
    expect(
      hasRingOfVigourEffect({
        equipmentIds: [],
        ringOfVigourPassive: true,
        unlockedRegions: ["anachronia"],
      }),
    ).toBe(true);
  });

  it("ring on + passive on = active once (Boolean OR, no stack)", () => {
    expect(
      hasRingOfVigourEffect({
        equipmentIds: [RING_OF_VIGOUR_ITEM_ID],
        ringOfVigourPassive: true,
        unlockedRegions: ["anachronia"],
      }),
    ).toBe(true);
    // Sources list both, but activation is still boolean true once.
    expect(
      ringOfVigourActiveSources({
        equipmentIds: [RING_OF_VIGOUR_ITEM_ID],
        ringOfVigourPassive: true,
        unlockedRegions: ["anachronia"],
      }),
    ).toEqual(["equipped", "permanent"]);
  });

  it("passive flag without Anachronia is inactive", () => {
    expect(
      hasRingOfVigourEffect({
        equipmentIds: [],
        ringOfVigourPassive: true,
        unlockedRegions: ["misthalin", "karamja"],
      }),
    ).toBe(false);
  });

  it("equipment-only works regardless of passive toggle", () => {
    expect(
      hasRingOfVigourEffect({
        equipmentIds: [RING_OF_VIGOUR_ITEM_ID],
        ringOfVigourPassive: false,
        unlockedRegions: ["misthalin"],
      }),
    ).toBe(true);
  });
});

describe("resolveSpecialAttackAdrenalineCost", () => {
  it("applies 10% discount of original cost (not flat -10)", () => {
    expect(resolveSpecialAttackAdrenalineCost(50, true)).toBe(45);
    expect(resolveSpecialAttackAdrenalineCost(30, true)).toBe(27);
    expect(resolveSpecialAttackAdrenalineCost(60, true)).toBe(54);
  });

  it("leaves base cost unchanged when inactive", () => {
    expect(resolveSpecialAttackAdrenalineCost(50, false)).toBe(50);
    expect(resolveSpecialAttackAdrenalineCost(30, false)).toBe(30);
  });

  it("historical 55% special becomes 50 (discount floor)", () => {
    // base - floor(base * 0.1) = 55 - 5 = 50
    expect(resolveSpecialAttackAdrenalineCost(55, true)).toBe(50);
  });

  it("does not apply twice for dual sources (caller passes boolean once)", () => {
    const once = resolveSpecialAttackAdrenalineCost(50, true);
    expect(once).toBe(45);
    // Applying the resolver a second time on the already-reduced cost is wrong;
    // dual sources must resolve hasRingOfVigour once then call this once.
    expect(resolveSpecialAttackAdrenalineCost(once, true)).toBe(41);
  });
});

describe("region / passive availability", () => {
  it("Anachronia makes permanent unlock available", () => {
    expect(isRingOfVigourPassiveAvailable(["anachronia"])).toBe(true);
    expect(isRingOfVigourPassiveEffective(true, ["anachronia"])).toBe(true);
  });

  it("no Anachronia prevents permanent unlock", () => {
    expect(isRingOfVigourPassiveAvailable(["forinthry"])).toBe(false);
    expect(isRingOfVigourPassiveEffective(true, ["forinthry"])).toBe(false);
  });

  it("omitted regions trust the buff flag (engine unit tests)", () => {
    expect(isRingOfVigourPassiveAvailable(undefined)).toBe(true);
    expect(isRingOfVigourPassiveEffective(true, undefined)).toBe(true);
  });
});

describe("helpers", () => {
  it("detects worn ring by stable id", () => {
    expect(isRingOfVigourWorn([RING_OF_VIGOUR_ITEM_ID])).toBe(true);
    expect(isRingOfVigourWorn(["item:occultists-ring"])).toBe(false);
    expect(isRingOfVigourWorn(undefined)).toBe(false);
  });

  it("formats analysis line once with sources", () => {
    expect(formatRingOfVigourSources(["equipped", "permanent"])).toBe(
      "Ring of Vigour · Active via: Equipped ring, Permanent unlock",
    );
  });

  it("tags weapon specials only via weaponSpecial flag", () => {
    expect(isWeaponSpecialAbility({ weaponSpecial: true })).toBe(true);
    expect(isWeaponSpecialAbility({})).toBe(false);
  });

  it("exports ultimate refund amount 10", () => {
    expect(RING_OF_VIGOUR_REFUND).toBe(10);
  });
});
