import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { activeEquipmentEffects } from "../../shared/equipment";
import {
  ATTUNED_CRYSTAL_COMPONENT_ID,
  attunedCrystalExpectedBonus,
  attunedCrystalProcChance,
} from "../../shared/attunedCrystalWeaponry";
import { rotationOf } from "./contracts";
import { simulate } from "./simulate";
import { DEFAULT_LOADOUT, normalizeLoadout } from "@/components/combat/useLoadout";
import { loadoutStats } from "@/components/combat/loadoutStats";
import { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";
import { buildSimulationInputBase } from "@/combat/model";

const staffEffects = activeEquipmentEffects({
  style: "magic",
  equipmentSlots: { twohand: "item:attuned-crystal-staff" },
  agilityLevel: 99,
});

const bareEffects = activeEquipmentEffects({
  style: "magic",
  equipmentSlots: { twohand: "item:noxious-staff" },
  agilityLevel: 99,
});

const base = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 as const },
  abilities: MAGIC_ABILITIES,
  weaponConfiguration: "twohand" as const,
  context: { style: "magic" as const },
};

describe("attuned crystal weaponry in simulation", () => {
  it("adds expected bonus damage on a real rotation with attuned crystal staff", () => {
    const without = simulate({
      ...base,
      equipmentEffects: bareEffects,
      equipmentIds: ["item:noxious-staff"],
      rotation: rotationOf("sonic_wave"),
    });
    const withCrystal = simulate({
      ...base,
      equipmentEffects: staffEffects,
      equipmentIds: ["item:attuned-crystal-staff"],
      rotation: rotationOf("sonic_wave"),
    });

    expect(without.ok).toBe(true);
    expect(withCrystal.ok).toBe(true);
    expect(staffEffects.attunedCrystalWeaponry?.procChance).toBe(0.12);

    const crystalRow = withCrystal.analysis.byEffect.find(
      (row) => row.id === ATTUNED_CRYSTAL_COMPONENT_ID,
    );
    expect(crystalRow).toBeDefined();
    expect(crystalRow!.totalDamage).toBeGreaterThan(0);
    expect(crystalRow!.kind).toBe("equipment-passive");

    // Direct hits only: host ability damage * 0.25 * 0.12 = 3% of host direct damage.
    const hostDirect =
      withCrystal.analysis.byEffect.find((row) => row.id === "sonic_wave")?.directDamage ?? 0;
    expect(crystalRow!.totalDamage).toBeCloseTo(
      attunedCrystalExpectedBonus(hostDirect, attunedCrystalProcChance(99)),
      6,
    );
    expect(withCrystal.totalExpected).toBeGreaterThan(without.totalExpected);
    expect(withCrystal.totalExpected - without.totalExpected).toBeCloseTo(
      crystalRow!.totalDamage,
      4,
    );
  });

  it("does not attribute crystal bonus when loadout is inactive", () => {
    const inactive = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: { mainhand: "item:attuned-crystal-wand" },
      agilityLevel: 99,
    });
    expect(inactive.attunedCrystalWeaponry).toBeUndefined();

    const result = simulate({
      ...base,
      equipmentEffects: inactive,
      equipmentIds: ["item:attuned-crystal-wand"],
      weaponConfiguration: "mainhand",
      rotation: rotationOf("sonic_wave"),
    });
    expect(result.ok).toBe(true);
    expect(
      result.analysis.byEffect.some((row) => row.id === ATTUNED_CRYSTAL_COMPONENT_ID),
    ).toBe(false);
  });

  it("survives Use Build model freeze (copyEquipmentEffects)", () => {
    const loadout = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      style: "magic",
      equipmentSlots: { twohand: "item:attuned-crystal-staff" },
      agilityLevel: 99,
    });
    const stats = loadoutStats(loadout);
    expect(stats.equipmentEffects.attunedCrystalWeaponry?.procChance).toBe(0.12);

    const model = toResolvedCombatModel(loadout, { stats });
    expect(model.equipmentEffects.attunedCrystalWeaponry?.procChance).toBe(0.12);

    const simBase = buildSimulationInputBase(model, MAGIC_ABILITIES, {
      abilities: MAGIC_ABILITIES,
    });
    expect(simBase.equipmentEffects?.attunedCrystalWeaponry?.procChance).toBe(0.12);

    const result = simulate({
      ...simBase,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MAGIC_ABILITIES,
      rotation: rotationOf("sonic_wave"),
    });
    expect(result.ok).toBe(true);
    const crystalRow = result.analysis.byEffect.find(
      (row) => row.id === ATTUNED_CRYSTAL_COMPONENT_ID,
    );
    expect(crystalRow?.totalDamage ?? 0).toBeGreaterThan(0);
  });

  it("shows bonus on dual-wield attuned wand+orb and weapon+shield combos", () => {
    const dual = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: {
        mainhand: "item:attuned-crystal-wand",
        offhand: "item:attuned-crystal-orb",
      },
      agilityLevel: 99,
    });
    const shield = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: {
        mainhand: "item:attuned-crystal-wand",
        offhand: "item:attuned-crystal-ward",
      },
      agilityLevel: 99,
    });
    const t70 = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: {
        mainhand: "item:attuned-crystal-wand",
        offhand: "item:crystal-ward",
      },
      agilityLevel: 99,
    });

    for (const effects of [dual, shield, t70]) {
      expect(effects.attunedCrystalWeaponry?.procChance).toBe(0.12);
      const result = simulate({
        ...base,
        equipmentEffects: effects,
        weaponConfiguration: effects === dual ? "dualwield" : "shield",
        rotation: rotationOf("sonic_wave"),
      });
      expect(result.ok).toBe(true);
      const row = result.analysis.byEffect.find((row) => row.id === ATTUNED_CRYSTAL_COMPONENT_ID);
      expect(row?.totalDamage ?? 0).toBeGreaterThan(0);
    }
  });
});
