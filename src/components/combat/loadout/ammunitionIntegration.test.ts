import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { simulateRevolution } from "@/combat/engine/simulation/revolution";
import { buildSimulationInputBase, toRevolutionInput } from "@/combat/model";
import { PLAYER_POISON_EFFECT_ID } from "@/combat/poison/mechanics";
import { weaponAmmunitionCapabilityFromEquipment } from "@/combat/styles/ranged/ammunitionEquipment";
import { reviveRevolutionBase } from "@/combat/solver/worker/revive";
import { projectSerializableSimBase } from "@/combat/model/simulationInput";
import {
  resolveLoadoutCombat,
  toResolvedCombatModel,
} from "@/components/combat/toResolvedCombatModel";
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

  it("resolves ordinary and bakriminel bolts from a real crossbow loadout", () => {
    const ordinary = rangedLoadout({
      twohand: "item:royal-crossbow",
      ammo: "item:ruby-bolts-e",
    });
    const bakriminel = rangedLoadout({
      twohand: "item:royal-crossbow",
      ammo: "item:ruby-bakriminel-bolts-e",
    });

    expect(loadoutRangedAmmunitionProfile(ordinary)).toMatchObject({
      projectile: { itemId: "item:ruby-bolts-e", mechanicId: "ruby", statTier: 60 },
      weaponCapability: { mode: "required", acceptedFamily: "bolts" },
      effectiveStatTier: 60,
    });
    expect(loadoutRangedAmmunitionProfile(bakriminel)).toMatchObject({
      projectile: {
        itemId: "item:ruby-bakriminel-bolts-e",
        mechanicId: "ruby",
        statTier: 95,
      },
      weaponCapability: { mode: "required", acceptedFamily: "bolts" },
      effectiveStatTier: 80,
    });
    expect(rangedConfig(ordinary).rangedAmmunitionState).toBe("external");
    expect(rangedConfig(bakriminel).rangedAmmunitionState).toBe("external");
  });

  it("runs bakriminel Ruby bolts through the product Revolution path", () => {
    const loadout = normalizeLoadout({
      ...rangedLoadout({
        twohand: "item:royal-crossbow",
        ammo: "item:ruby-bakriminel-bolts-e",
      }),
      target: {
        defenceLevel: 80,
        affinity: 70,
        hpPercent: 100,
        maximumLifePoints: 1_000_000,
      },
    });
    const { model } = resolveLoadoutCombat(loadout);
    const catalogue = resolveAbilityCatalogue();
    const summary = simulateRevolution(
      toRevolutionInput(buildSimulationInputBase(model, catalogue), {
        bar: [catalogue.byId.get("ranged_attack")!],
        style: "ranged",
        durationTicks: 12,
      }),
      { stochasticSeed: 31, stochasticLanes: 128 },
    );

    expect(model.ammunition?.projectile).toMatchObject({
      itemId: "item:ruby-bakriminel-bolts-e",
      mechanicId: "ruby",
    });
    expect(summary.ok).toBe(true);
    expect(summary.totalExpected).toBeGreaterThan(0);
    expect(
      summary.analysis.byEffect.find(({ id }) => id === "ammunition:ruby")
        ?.expectedActivations,
    ).toBeGreaterThan(0);
  });

  it("tracks poison with Big Boned and blocks Emerald on poison-immune targets", () => {
    const makeLoadout = (poisonImmune: boolean) =>
      normalizeLoadout({
        ...rangedLoadout({
          twohand: "item:royal-crossbow",
          gloves: "item:cinderbane-gloves",
          ammo: "item:emerald-bakriminel-bolts-e",
        }),
        buffs: {
          ...DEFAULT_LOADOUT.buffs,
          weaponPoison: "weapon-plus-plus-plus",
        },
        target: {
          defenceLevel: 80,
          affinity: 70,
          hpPercent: 100,
          maximumLifePoints: 1_000_000,
          poisonImmune,
        },
      });
    const run = (poisonImmune: boolean) => {
      const { model } = resolveLoadoutCombat(makeLoadout(poisonImmune), {
        blessingPicks: ["Balance"],
      });
      const catalogue = resolveAbilityCatalogue();
      return simulateRevolution(
        toRevolutionInput(buildSimulationInputBase(model, catalogue), {
          bar: [catalogue.byId.get("ranged_attack")!],
          style: "ranged",
          durationTicks: 100,
        }),
        { stochasticSeed: 31, stochasticLanes: 128 },
      );
    };

    const poisonable = run(false);
    const poison = poisonable.analysis.byEffect.find(({ id }) => id === PLAYER_POISON_EFFECT_ID);
    expect(poison?.totalDamage).toBeGreaterThan(0);
    expect(poison?.expectedSeparateHits).toBeGreaterThan(0);
    expect(poisonable.playerPoison?.separateHits).toBeGreaterThan(0);
    expect(poisonable.events.some(({ provenance }) => provenance.kind === "player_poison")).toBe(
      true,
    );
    expect(poisonable.events.some(({ abilityId }) => abilityId === "ammunition:emerald")).toBe(
      true,
    );
    expect(
      poisonable.analysis.byEffect.find(({ id }) => id === "ammunition:emerald")?.totalDamage,
    ).toBeGreaterThan(0);

    const immune = run(true);
    expect(immune.events.some(({ abilityId }) => abilityId === "ammunition:emerald")).toBe(false);
    expect(immune.analysis.byEffect.some(({ id }) => id === "ammunition:emerald")).toBe(false);
    expect(immune.analysis.byEffect.some(({ id }) => id === PLAYER_POISON_EFFECT_ID)).toBe(false);
    expect(immune.playerPoison).toBeUndefined();
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
        id: "item:test-optional-capability-record",
        weaponClass: "bow",
        ammunitionCapability: { mode: "optional", acceptedFamily: "arrows" },
      }),
    ).toEqual({ mode: "optional", acceptedFamily: "arrows" });
    expect(
      weaponAmmunitionCapabilityFromEquipment({ id: "item:test-thrown-weapon", weaponClass: "thrown" }),
    ).toEqual({
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
    expect(directModel.playerVitality).toEqual({
      maximumLifePoints: directStats.life.temporaryMaxLife,
      currentLifePoints: directStats.life.currentLife,
    });
    expect(wire.ammunition).toEqual(directModel.ammunition);
    expect(wire.playerVitality).toEqual(directModel.playerVitality);
    expect(revived.ammunition).toEqual(directModel.ammunition);
    expect(revived.playerVitality).toEqual(directModel.playerVitality);

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
