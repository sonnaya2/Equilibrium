import { describe, expect, it } from "vitest";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { weaponAmmunitionCapabilityFromEquipment } from "@/combat/styles/ranged/ammunitionEquipment";
import { reviveRevolutionBase } from "@/combat/solver/worker/revive";
import { projectSerializableSimBase } from "@/combat/model/simulationInput";
import { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";
import { loadoutStats } from "@/components/combat/loadoutStats";
import { uiRunFingerprint } from "@/components/combat/uiSimFingerprint";
import { DEFAULT_LOADOUT, normalizeLoadout } from "./model";
import { loadoutRangedAmmunitionProfile, loadoutWeaponConfig } from "./weaponConfiguration";

function rangedLoadout(
  equipmentSlots: Record<string, string>,
  selectedAmmunitionId: string | null = null,
) {
  return normalizeLoadout({
    ...DEFAULT_LOADOUT,
    style: "ranged",
    equipmentSlots,
    selectedAmmunitionId,
  });
}

function rangedConfig(loadout: ReturnType<typeof rangedLoadout>) {
  const config = loadoutWeaponConfig(loadout);
  if (config.kind === "necromancy") throw new Error("expected a ranged weapon configuration");
  return config;
}

describe("loadout-owned ranged ammunition resolution", () => {
  it("keeps direct and quiver-selected projectiles equivalent", () => {
    const direct = rangedLoadout({
      twohand: "item:noxious-longbow",
      ammo: "item:splintering-arrows",
    });
    const quiver = rangedLoadout(
      { twohand: "item:noxious-longbow", ammo: "item:pernix-quiver" },
      "item:splintering-arrows",
    );
    const directProfile = loadoutRangedAmmunitionProfile(direct);
    const quiverProfile = loadoutRangedAmmunitionProfile(quiver);

    expect(directProfile?.projectile?.itemId).toBe("item:splintering-arrows");
    expect(quiverProfile?.projectile?.itemId).toBe("item:splintering-arrows");
    expect(directProfile?.effectiveStatTier).toBe(quiverProfile?.effectiveStatTier);
    expect(directProfile?.quiver).toBeNull();
    expect(quiverProfile?.quiver?.itemId).toBe("item:pernix-quiver");
    expect(quiverProfile?.quiver?.passiveIds).toEqual(["pernix-quiver-max-hit-band"]);
    expect(rangedConfig(direct).ammunitionTier).toBe(rangedConfig(quiver).ammunitionTier);
  });

  it("invalidates a required bow with missing or wrong-family ammunition", () => {
    const missing = rangedLoadout({ twohand: "item:noxious-longbow" });
    const wrongFamily = rangedLoadout({
      twohand: "item:noxious-longbow",
      ammo: "item:opal-bolts-e",
    });
    for (const loadout of [missing, wrongFamily]) {
      const profile = loadoutRangedAmmunitionProfile(loadout);
      const config = rangedConfig(loadout);
      expect(profile?.projectile).toBeNull();
      expect(profile?.effectiveStatTier).toBeNull();
      expect(config.rangedAmmunitionState).toBe("missing-required");
      expect(config.ammunitionTier).toBe(0);
      expect(baseAbilityDamage(120, config)).toBe(0);
    }
  });

  it("normalizes hydra saved ids and clears direct-slot selection", () => {
    const direct = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      style: "ranged",
      equipmentSlots: { twohand: "item:noxious-longbow", ammo: "item:hydra-bakriminel-bolts-e" },
      equipmentIds: ["item:hydra-bakriminel-bolts-e"],
      selectedAmmunitionId: "item:splintering-arrows",
    });
    expect(direct.equipmentSlots.ammo).toBe("item:hydrix-bakriminel-bolts-e");
    expect(direct.equipmentIds).toContain("item:hydrix-bakriminel-bolts-e");
    expect(direct.equipmentIds).not.toContain("item:hydra-bakriminel-bolts-e");
    expect(direct.selectedAmmunitionId).toBeNull();
  });

  it("keeps a normalized selection only for the quiver slot", () => {
    const quiver = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      style: "ranged",
      equipmentSlots: { twohand: "item:noxious-longbow", ammo: "item:pernix-quiver" },
      selectedAmmunitionId: "item:hydra-bakriminel-bolts-e",
    });
    expect(quiver.selectedAmmunitionId).toBe("item:hydrix-bakriminel-bolts-e");
    expect(quiver).not.toHaveProperty("ammoSlotKind");
  });

  it("uses explicit optional and no-ammo capability modes", () => {
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        weaponClass: "bow",
        ammunitionCapability: { mode: "optional", acceptedFamily: "arrows" },
      }),
    ).toEqual({ mode: "optional", acceptedFamily: "arrows" });
    expect(weaponAmmunitionCapabilityFromEquipment({ weaponClass: "thrown" })).toEqual({
      mode: "none",
      acceptedFamily: null,
    });
  });

  it("keeps the host, worker revival, and UI fingerprint on resolved ammunition", () => {
    const direct = rangedLoadout({
      twohand: "item:noxious-longbow",
      ammo: "item:splintering-arrows",
    });
    const quiver = rangedLoadout(
      { twohand: "item:noxious-longbow", ammo: "item:pernix-quiver" },
      "item:splintering-arrows",
    );
    const directStats = loadoutStats(direct);
    const directModel = toResolvedCombatModel(direct, {}, directStats);
    const wire = projectSerializableSimBase(directModel);
    const revived = reviveRevolutionBase(wire);

    expect(directModel.ammunition).toEqual(directStats.ammunition);
    expect(wire.ammunition).toEqual(directModel.ammunition);
    expect(revived.ammunition).toEqual(directModel.ammunition);

    const directFingerprint = uiRunFingerprint({
      mode: "manual",
      stats: directStats,
      combatModel: directModel,
      queue: [],
      autoWeave: true,
      useBuild: true,
    });
    const quiverStats = loadoutStats(quiver);
    const quiverModel = toResolvedCombatModel(quiver, {}, quiverStats);
    const quiverFingerprint = uiRunFingerprint({
      mode: "manual",
      stats: quiverStats,
      combatModel: quiverModel,
      queue: [],
      autoWeave: true,
      useBuild: true,
    });
    expect(quiverModel.ammunition?.projectile?.itemId).toBe(
      directModel.ammunition?.projectile?.itemId,
    );
    expect(quiverFingerprint).not.toBe(directFingerprint);
  });
});
