import { describe, expect, it } from "vitest";
import { equipmentById } from "../data";
import { activeEquipmentEffects, equippedPassiveSummaries } from "./equipment";
import {
  ATTUNED_CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS,
  ATTUNED_CRYSTAL_COMPONENT_ID,
  ATTUNED_CRYSTAL_MAX_PROC_CHANCE,
  ATTUNED_CRYSTAL_WEAPONRY_PASSIVE_ID,
  CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS,
  attunedCrystalExpectedBonus,
  attunedCrystalProcChance,
  countCrystalArmourPieces,
  crystalArmourWeaponryProcBonus,
  equipmentCrystalWeaponryRole,
  isAttunedCrystalWeaponryHitEligible,
  isAttunedCrystalWeaponryLoadoutActive,
  resolveAttunedCrystalWeaponry,
  stripAugmentedEquipmentId,
} from "./attunedCrystalWeaponry";

describe("attuned crystal weaponry eligibility", () => {
  it("activates for attuned 2H staff, bow, and halberd", () => {
    for (const id of [
      "item:attuned-crystal-staff",
      "item:attuned-crystal-bow",
      "item:attuned-crystal-halberd",
    ] as const) {
      expect(equipmentById(id)?.crystalWeaponry).toBe("attuned-weapon");
      expect(
        isAttunedCrystalWeaponryLoadoutActive({ equipmentSlots: { twohand: id } }),
      ).toBe(true);
      const effects = activeEquipmentEffects({
        equipmentSlots: { twohand: id },
        agilityLevel: 99,
      });
      expect(effects.attunedCrystalWeaponry?.procChance).toBe(ATTUNED_CRYSTAL_MAX_PROC_CHANCE);
      expect(effects.passiveIds).toContain(ATTUNED_CRYSTAL_WEAPONRY_PASSIVE_ID);
    }
  });

  it("activates for attuned MH + attuned OH dual-wield", () => {
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: {
          mainhand: "item:attuned-crystal-dagger",
          offhand: "item:off-hand-attuned-crystal-dagger",
        },
      }),
    ).toBe(true);
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: {
          mainhand: "item:attuned-crystal-wand",
          offhand: "item:attuned-crystal-orb",
        },
      }),
    ).toBe(true);
  });

  it("activates for attuned MH + attuned crystal shield family", () => {
    for (const offhand of [
      "item:attuned-crystal-shield",
      "item:attuned-crystal-deflector",
      "item:attuned-crystal-ward",
    ] as const) {
      expect(equipmentById(offhand)?.crystalWeaponry).toBe("crystal-shield-partner");
      expect(
        isAttunedCrystalWeaponryLoadoutActive({
          equipmentSlots: {
            mainhand: "item:attuned-crystal-dagger",
            offhand,
          },
        }),
      ).toBe(true);
    }
  });

  it("activates for attuned MH + T70 crystal shield family (7 Feb 2022 clarification)", () => {
    for (const offhand of [
      "item:crystal-shield",
      "item:crystal-deflector",
      "item:crystal-ward",
    ] as const) {
      expect(equipmentById(offhand)?.crystalWeaponry).toBe("crystal-shield-partner");
      expect(
        isAttunedCrystalWeaponryLoadoutActive({
          equipmentSlots: {
            mainhand: "item:attuned-crystal-wand",
            offhand,
          },
        }),
      ).toBe(true);
    }
  });

  it("treats augmented ids as the base crystal role", () => {
    expect(stripAugmentedEquipmentId("item:augmented-attuned-crystal-staff")).toBe(
      "item:attuned-crystal-staff",
    );
    expect(equipmentCrystalWeaponryRole("item:augmented-attuned-crystal-staff")).toBe(
      "attuned-weapon",
    );
    expect(equipmentCrystalWeaponryRole("item:augmented-attuned-crystal-shield")).toBe(
      "crystal-shield-partner",
    );
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: { twohand: "item:augmented-attuned-crystal-staff" },
      }),
    ).toBe(true);
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: {
          mainhand: "item:augmented-attuned-crystal-wand",
          offhand: "item:augmented-attuned-crystal-deflector",
        },
      }),
    ).toBe(true);
  });

  it("stays inactive for lone one-handed attuned weapon", () => {
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: { mainhand: "item:attuned-crystal-wand" },
      }),
    ).toBe(false);
    expect(
      activeEquipmentEffects({
        equipmentSlots: { mainhand: "item:attuned-crystal-wand" },
        agilityLevel: 99,
      }).attunedCrystalWeaponry,
    ).toBeUndefined();
  });

  it("stays inactive for unrelated weapon + crystal shield", () => {
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: {
          mainhand: "item:drygore-rapier",
          offhand: "item:attuned-crystal-shield",
        },
      }),
    ).toBe(false);
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: {
          mainhand: "item:drygore-rapier",
          offhand: "item:crystal-shield",
        },
      }),
    ).toBe(false);
  });

  it("stays inactive when unrelated equipment changes around an inactive 1H setup", () => {
    expect(
      isAttunedCrystalWeaponryLoadoutActive({
        equipmentSlots: {
          mainhand: "item:attuned-crystal-wand",
          helmet: "item:tectonic-helm",
          body: "item:tectonic-body",
          ring: "item:reavers-ring",
        },
      }),
    ).toBe(false);
  });
});

describe("attuned crystal Agility scaling", () => {
  it("is exactly 12% at 99 Agility", () => {
    expect(attunedCrystalProcChance(99)).toBe(0.12);
    expect(attunedCrystalProcChance(99)).toBe(ATTUNED_CRYSTAL_MAX_PROC_CHANCE);
  });

  it("is linear through agility/825 and caps above 99", () => {
    expect(attunedCrystalProcChance(0)).toBe(0);
    expect(attunedCrystalProcChance(1)).toBeCloseTo(1 / 825, 12);
    expect(attunedCrystalProcChance(50)).toBeCloseTo(50 / 825, 12);
    expect(attunedCrystalProcChance(120)).toBe(0.12);
  });

  it("expected bonus at 99 Agility is 3% of eligible source-hit damage", () => {
    const source = 10_000;
    const chance = attunedCrystalProcChance(99);
    expect(attunedCrystalExpectedBonus(source, chance)).toBeCloseTo(source * 0.03, 12);
  });
});

describe("attuned crystal Gear presentation", () => {
  it("surfaces the loadout-derived passive on active attuned 2H", () => {
    const rows = equippedPassiveSummaries({
      style: "magic",
      equipmentSlots: { twohand: "item:attuned-crystal-staff" },
      agilityLevel: 99,
    });
    const row = rows.find((r) => r.passiveId === ATTUNED_CRYSTAL_WEAPONRY_PASSIVE_ID);
    expect(row).toBeDefined();
    expect(row?.support).toBe("modeled");
    expect(row?.effects.some((line) => line.includes("12%"))).toBe(true);
  });

  it("hides the derived passive when the loadout is inactive", () => {
    const rows = equippedPassiveSummaries({
      style: "magic",
      equipmentSlots: { mainhand: "item:attuned-crystal-wand" },
      agilityLevel: 99,
    });
    expect(rows.some((r) => r.passiveId === ATTUNED_CRYSTAL_WEAPONRY_PASSIVE_ID)).toBe(false);
  });
});

describe("attuned crystal hit eligibility", () => {
  it("allows direct player hits and rejects recursive/attached/proc damage", () => {
    expect(isAttunedCrystalWeaponryHitEligible({ kind: "player_direct" })).toBe(true);
    expect(isAttunedCrystalWeaponryHitEligible({ kind: "player_auto" })).toBe(true);
    expect(isAttunedCrystalWeaponryHitEligible({ kind: "player_dot" })).toBe(false);
    expect(isAttunedCrystalWeaponryHitEligible({ kind: "player_poison" })).toBe(false);
    expect(isAttunedCrystalWeaponryHitEligible({ kind: "conjure_auto" })).toBe(false);
    expect(
      isAttunedCrystalWeaponryHitEligible({
        kind: "equipment_proc",
        detail: ATTUNED_CRYSTAL_COMPONENT_ID,
      }),
    ).toBe(false);
    expect(
      isAttunedCrystalWeaponryHitEligible({
        kind: "attached",
        detail: ATTUNED_CRYSTAL_COMPONENT_ID,
      }),
    ).toBe(false);
    expect(isAttunedCrystalWeaponryHitEligible({ kind: "invention_proc" })).toBe(false);
  });

  it("resolveAttunedCrystalWeaponry returns undefined when inactive", () => {
    expect(
      resolveAttunedCrystalWeaponry(
        { equipmentSlots: { mainhand: "item:attuned-crystal-wand" } },
        99,
      ),
    ).toBeUndefined();
  });
});

describe("crystal armour set weaponry proc bonus", () => {
  it("tags regular and attuned body pieces with crystalWeaponry armour roles", () => {
    expect(equipmentById("item:crystal-helm")?.crystalWeaponry).toBe("crystal-armour");
    expect(equipmentById("item:crystal-body")?.crystalWeaponry).toBe("crystal-armour");
    expect(equipmentById("item:attuned-crystal-helm")?.crystalWeaponry).toBe(
      "attuned-crystal-armour",
    );
    expect(equipmentById("item:attuned-crystal-body")?.crystalWeaponry).toBe(
      "attuned-crystal-armour",
    );
    // Shields remain partners, not armour set pieces.
    expect(equipmentById("item:crystal-shield")?.crystalWeaponry).toBe("crystal-shield-partner");
    expect(equipmentById("item:attuned-crystal-shield")?.crystalWeaponry).toBe(
      "crystal-shield-partner",
    );
  });

  it("raises proc chance by 0.03 with 2+ regular crystal armour pieces", () => {
    const loadout = {
      equipmentSlots: {
        twohand: "item:attuned-crystal-staff",
        helmet: "item:crystal-helm",
        body: "item:crystal-body",
      },
    };
    expect(countCrystalArmourPieces(loadout)).toEqual({ crystal: 2, attuned: 0 });
    expect(crystalArmourWeaponryProcBonus(loadout)).toBe(CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS);
    const resolved = resolveAttunedCrystalWeaponry(loadout, 99);
    expect(resolved?.armourProcBonus).toBe(0.03);
    expect(resolved?.procChance).toBeCloseTo(0.12 + 0.03, 12);
    expect(
      activeEquipmentEffects({ ...loadout, agilityLevel: 99 }).attunedCrystalWeaponry?.procChance,
    ).toBeCloseTo(0.15, 12);
  });

  it("raises proc chance by 0.06 with 2+ attuned crystal armour pieces", () => {
    const loadout = {
      equipmentSlots: {
        twohand: "item:attuned-crystal-staff",
        helmet: "item:attuned-crystal-helm",
        body: "item:attuned-crystal-body",
        legs: "item:attuned-crystal-legs",
      },
    };
    expect(countCrystalArmourPieces(loadout).attuned).toBe(3);
    expect(crystalArmourWeaponryProcBonus(loadout)).toBe(
      ATTUNED_CRYSTAL_ARMOUR_WEAPONRY_PROC_BONUS,
    );
    const resolved = resolveAttunedCrystalWeaponry(loadout, 99);
    expect(resolved?.armourProcBonus).toBe(0.06);
    expect(resolved?.procChance).toBeCloseTo(0.12 + 0.06, 12);
  });

  it("gives no armour bonus with fewer than 2 pieces of either family", () => {
    const oneRegular = {
      equipmentSlots: {
        twohand: "item:attuned-crystal-staff",
        helmet: "item:crystal-helm",
      },
    };
    const mixedOneEach = {
      equipmentSlots: {
        twohand: "item:attuned-crystal-staff",
        helmet: "item:crystal-helm",
        body: "item:attuned-crystal-body",
      },
    };
    expect(crystalArmourWeaponryProcBonus(oneRegular)).toBe(0);
    expect(crystalArmourWeaponryProcBonus(mixedOneEach)).toBe(0);
    expect(resolveAttunedCrystalWeaponry(oneRegular, 99)?.procChance).toBe(0.12);
    expect(resolveAttunedCrystalWeaponry(mixedOneEach, 99)?.procChance).toBe(0.12);
    expect(resolveAttunedCrystalWeaponry(mixedOneEach, 99)?.armourProcBonus).toBe(0);
  });

  it("does not count crystal shields toward the armour set threshold", () => {
    const loadout = {
      equipmentSlots: {
        mainhand: "item:attuned-crystal-wand",
        offhand: "item:crystal-shield",
        helmet: "item:crystal-helm",
      },
    };
    expect(isAttunedCrystalWeaponryLoadoutActive(loadout)).toBe(true);
    expect(countCrystalArmourPieces(loadout)).toEqual({ crystal: 1, attuned: 0 });
    expect(crystalArmourWeaponryProcBonus(loadout)).toBe(0);
  });

  it("counts augmented attuned crystal armour via base id", () => {
    const loadout = {
      equipmentSlots: {
        twohand: "item:attuned-crystal-staff",
        helmet: "item:augmented-attuned-crystal-helm",
        body: "item:augmented-attuned-crystal-body",
      },
    };
    expect(equipmentCrystalWeaponryRole("item:augmented-attuned-crystal-helm")).toBe(
      "attuned-crystal-armour",
    );
    expect(crystalArmourWeaponryProcBonus(loadout)).toBe(0.06);
    expect(resolveAttunedCrystalWeaponry(loadout, 99)?.procChance).toBeCloseTo(0.18, 12);
  });
});
