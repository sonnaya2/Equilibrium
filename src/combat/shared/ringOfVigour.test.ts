import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../styles/necromancy/abilities";
import {
  formatRingOfVigourSources,
  hasRingOfVigourEffect,
  isRingOfVigourPassiveAvailable,
  isRingOfVigourPassiveEffective,
  isRingOfVigourWorn,
  isWeaponSpecialAbility,
  listedWeaponSpecialCost,
  MODELLED_WEAPON_SPECIAL_IDS,
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
  it("rounding table: base - floor(base * 0.1)", () => {
    // base | discount | effective
    expect(resolveSpecialAttackAdrenalineCost(25, true)).toBe(23); // 25-2
    expect(resolveSpecialAttackAdrenalineCost(30, true)).toBe(27); // 30-3
    expect(resolveSpecialAttackAdrenalineCost(50, true)).toBe(45); // 50-5
    expect(resolveSpecialAttackAdrenalineCost(55, true)).toBe(50); // 55-5 (not floor(0.9*55)=49)
    expect(resolveSpecialAttackAdrenalineCost(60, true)).toBe(54); // 60-6
  });

  it("leaves base cost unchanged when inactive", () => {
    expect(resolveSpecialAttackAdrenalineCost(50, false)).toBe(50);
    expect(resolveSpecialAttackAdrenalineCost(30, false)).toBe(30);
    expect(resolveSpecialAttackAdrenalineCost(25, false)).toBe(25);
  });

  it("does not apply twice for dual sources (caller passes boolean once)", () => {
    const once = resolveSpecialAttackAdrenalineCost(50, true);
    expect(once).toBe(45);
    // Dual sources resolve hasRingOfVigour once; never re-apply on reduced cost.
    expect(resolveSpecialAttackAdrenalineCost(once, true)).toBe(41);
  });

  it("listedWeaponSpecialCost uses weaponSpecial gate", () => {
    expect(listedWeaponSpecialCost({ weaponSpecial: true, adrenaline: { cost: 50 } }, true)).toBe(
      45,
    );
    expect(listedWeaponSpecialCost({ adrenaline: { cost: 50 } }, true)).toBe(50);
    expect(listedWeaponSpecialCost({ weaponSpecial: true, adrenaline: { cost: 50 } }, false)).toBe(
      50,
    );
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
    expect(isWeaponSpecialAbility({ weaponSpecial: false })).toBe(false);
  });

  it("exports ultimate refund amount 10", () => {
    expect(RING_OF_VIGOUR_REFUND).toBe(10);
  });
});

describe("Ring of Vigour invariants (SSOT pins)", () => {
  it("equipped + permanent is one activation (boolean OR), refund constant 10", () => {
    const dual = hasRingOfVigourEffect({
      equipmentIds: [RING_OF_VIGOUR_ITEM_ID],
      ringOfVigourPassive: true,
      unlockedRegions: ["anachronia"],
    });
    const equippedOnly = hasRingOfVigourEffect({
      equipmentIds: [RING_OF_VIGOUR_ITEM_ID],
      ringOfVigourPassive: false,
    });
    const passiveOnly = hasRingOfVigourEffect({
      equipmentIds: [],
      ringOfVigourPassive: true,
      unlockedRegions: ["anachronia"],
    });
    expect(dual).toBe(true);
    expect(equippedOnly).toBe(true);
    expect(passiveOnly).toBe(true);
    // Upstream maps any true source set to ringOfVigour:true once; refund is not * sources.
    expect(RING_OF_VIGOUR_REFUND).toBe(10);
    expect(
      ringOfVigourActiveSources({
        equipmentIds: [RING_OF_VIGOUR_ITEM_ID],
        ringOfVigourPassive: true,
        unlockedRegions: ["anachronia"],
      }).length,
    ).toBe(2);
  });

  it("requirement and spend share resolveSpecialAttackAdrenalineCost", () => {
    // costOf and spendOf both call this for weapon specials (Icy Tempest stacks first).
    for (const [base, effective] of [
      [25, 23],
      [30, 27],
      [50, 45],
      [55, 50],
      [60, 54],
    ] as const) {
      const req = resolveSpecialAttackAdrenalineCost(base, true);
      const spend = resolveSpecialAttackAdrenalineCost(base, true);
      expect(req).toBe(effective);
      expect(spend).toBe(effective);
      expect(req).toBe(spend);
    }
  });

  it("non-special costs never enter the special discount", () => {
    expect(listedWeaponSpecialCost({ adrenaline: { cost: 50 } }, true)).toBe(50);
    expect(listedWeaponSpecialCost({ weaponSpecial: false, adrenaline: { cost: 25 } }, true)).toBe(
      25,
    );
  });
});

describe("modelled weapon special catalogue", () => {
  const allSpecs = [...MELEE_ABILITIES, ...MAGIC_ABILITIES, ...NECROMANCY_ABILITIES];

  it("every MODELLED_WEAPON_SPECIAL_IDS entry is tagged weaponSpecial", () => {
    for (const id of MODELLED_WEAPON_SPECIAL_IDS) {
      const specs = allSpecs.filter((a) => a.id === id);
      expect(specs.length, id).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(isWeaponSpecialAbility(spec), id).toBe(true);
      }
    }
  });

  it("no extra weaponSpecial tags outside the catalogue", () => {
    const flagged = allSpecs.filter((a) => isWeaponSpecialAbility(a)).map((a) => a.id);
    const unique = [...new Set(flagged)].sort();
    expect(unique).toEqual([...MODELLED_WEAPON_SPECIAL_IDS].sort());
  });
});
