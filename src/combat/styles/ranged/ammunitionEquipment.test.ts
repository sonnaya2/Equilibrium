import { describe, expect, it } from "vitest";
import {
  resolveAmmunitionFromEquipment,
  resolveQuiverFromEquipment,
  weaponAmmunitionCapabilityFromEquipment,
} from "./ammunitionEquipment";
import { equipmentById } from "../../data";
import { resolveRangedAmmunitionHitEffects } from "./ammunitionPayloads";

describe("canonical equipment ammunition adapter", () => {
  it("resolves a compact projectile profile from EquipmentRecord fields", () => {
    const profile = resolveAmmunitionFromEquipment({
      id: "item:jas-arrows",
      name: "Jas dragonbane arrows",
      tier: 100,
      requirementTier: 95,
      damageTier: 100,
      ammunition: {
        family: "arrows",
        mechanicId: "jas-dragonbane",
        support: { status: "modeled", label: "Modeled" },
      },
    });
    expect(profile).toMatchObject({
      itemId: "item:jas-arrows",
      statTier: 100,
      mechanicId: "jas-dragonbane",
    });
  });

  it("uses ammunition damage tier separately from its wear requirement", () => {
    const elderGodArrow = resolveAmmunitionFromEquipment({
      id: "item:ful-arrows",
      name: "Ful arrows",
      tier: 95,
      damageTier: 100,
      ammunition: {
        family: "arrows",
        mechanicId: "ful",
        support: { status: "partially-modeled", label: "Damage tradeoff" },
      },
    });
    const bakriminel = resolveAmmunitionFromEquipment({
      id: "item:onyx-bakriminel-bolts-e",
      name: "Onyx bakriminel bolts (e)",
      tier: 95,
      requirementTier: 99,
      ammunition: {
        family: "bolts",
        mechanicId: "onyx",
        support: { status: "partially-modeled", label: "Source-hit and healing payload" },
      },
    });

    expect(elderGodArrow?.statTier).toBe(100);
    expect(bakriminel?.statTier).toBe(95);
  });

  it("resolves ordinary and bakriminel Emerald bolts to one payload identity", () => {
    const ordinary = resolveAmmunitionFromEquipment(equipmentById("item:emerald-bolts-e"));
    const bakriminel = resolveAmmunitionFromEquipment(
      equipmentById("item:emerald-bakriminel-bolts-e"),
    );
    expect(ordinary).toMatchObject({
      mechanicId: "emerald",
      statTier: 60,
      support: { status: "modeled" },
    });
    expect(bakriminel).toMatchObject({
      mechanicId: "emerald",
      statTier: 95,
      support: { status: "modeled" },
    });
    const effects = (projectile: NonNullable<typeof ordinary>) =>
      resolveRangedAmmunitionHitEffects({
        ammunition: {
          projectile,
          quiver: null,
          weaponCapability: { mode: "required", acceptedFamily: "bolts" },
          effectiveStatTier: projectile.statTier,
        },
        style: "ranged",
        provenance: { kind: "player_direct" },
        attackOrigin: "player",
        attackKind: "ability",
      });
    expect(effects(ordinary!)).toEqual(effects(bakriminel!));
  });

  it("resolves ordinary and bakriminel Dragonstone bolts to one payload identity", () => {
    const ordinary = resolveAmmunitionFromEquipment(equipmentById("item:dragonstone-bolts-e"));
    const bakriminel = resolveAmmunitionFromEquipment(
      equipmentById("item:dragonstone-bakriminel-bolts-e"),
    );
    expect(ordinary).toMatchObject({ mechanicId: "dragonstone", statTier: 70 });
    expect(bakriminel).toMatchObject({ mechanicId: "dragonstone", statTier: 95 });
    expect(ordinary?.mechanicId).toBe(bakriminel?.mechanicId);
  });

  it("keeps quiver identity separate from projectile selection", () => {
    const profile = resolveQuiverFromEquipment({
      id: "item:pernix-quiver",
      name: "Pernix quiver",
      quiver: {
        acceptedFamilies: ["arrows"],
        passiveIds: ["pernix-quiver-max-hit-band"],
        support: { status: "modeled", label: "Modeled" },
      },
    });
    expect(profile).toMatchObject({
      itemId: "item:pernix-quiver",
      acceptedFamilies: ["arrows"],
      passiveIds: ["pernix-quiver-max-hit-band"],
    });
    expect(profile).not.toHaveProperty("selectedAmmunitionId");
  });

  it("reads the weapon capability from canonical data without name checks", () => {
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:test-capability-record",
        ammunitionCapability: { mode: "required", acceptedFamily: "bolts" },
      }),
    ).toEqual({ mode: "required", acceptedFamily: "bolts" });
    expect(weaponAmmunitionCapabilityFromEquipment({ id: "item:test-missing-capability" })).toBeNull();
  });

  it("classifies shipped standard crossbows as required-bolt weapons", () => {
    for (const id of [
      "item:armadyl-crossbow",
      "item:chaotic-crossbow",
      "item:royal-crossbow",
      "item:wyvern-crossbow",
      "item:ascension-crossbow",
      "item:eldritch-crossbow",
      "item:blightbound-crossbow",
      "item:ruinous-crossbow",
      "item:primal-crossbow-mk-5",
    ]) {
      const record = equipmentById(id);
      expect(record?.weaponClass, id).toBe("crossbow");
      expect(weaponAmmunitionCapabilityFromEquipment(record), id).toEqual({
        mode: "required",
        acceptedFamily: "bolts",
      });
    }
  });

  it("treats known chargebows as optional arrows when capability is unset", () => {
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:zaryte-bow",
        weaponClass: "bow",
      }),
    ).toEqual({ mode: "optional", acceptedFamily: "arrows" });
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:seren-godbow",
        weaponClass: "bow",
      }),
    ).toEqual({ mode: "optional", acceptedFamily: "arrows" });
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:hellfire-bow",
        weaponClass: "bow",
      }),
    ).toEqual({ mode: "optional", acceptedFamily: "arrows" });
    // Hexhunter and strykebow require arrows; not chargebows.
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:hexhunter-bow",
        weaponClass: "bow",
      }),
    ).toEqual({ mode: "required", acceptedFamily: "arrows" });
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:strykebow",
        weaponClass: "bow",
      }),
    ).toEqual({ mode: "required", acceptedFamily: "arrows" });
    // Explicit record capability still wins over the chargebow list.
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:zaryte-bow",
        weaponClass: "bow",
        ammunitionCapability: { mode: "optional", acceptedFamily: "arrows" },
      }),
    ).toEqual({ mode: "optional", acceptedFamily: "arrows" });
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:zaryte-bow",
        weaponClass: "bow",
        ammunitionCapability: { mode: "required", acceptedFamily: "arrows" },
      }),
    ).toEqual({ mode: "required", acceptedFamily: "arrows" });
    // Ordinary bow without capability stays required arrows.
    expect(
      weaponAmmunitionCapabilityFromEquipment({
        id: "item:noxious-longbow",
        weaponClass: "bow",
      }),
    ).toEqual({ mode: "required", acceptedFamily: "arrows" });
  });

  it("rejects an ammunition record with no stat tier", () => {
    expect(() =>
      resolveAmmunitionFromEquipment({
        id: "item:missing-tier-arrows",
        name: "Missing tier arrows",
        ammunition: {
          family: "arrows",
          mechanicId: "ordinary",
          support: { status: "unsupported", label: "Unsupported" },
        },
      }),
    ).toThrow(/ammunition stat tier/);
  });
});
