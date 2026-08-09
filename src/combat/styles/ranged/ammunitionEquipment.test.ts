import { describe, expect, it } from "vitest";
import {
  resolveAmmunitionFromEquipment,
  resolveQuiverFromEquipment,
  weaponAmmunitionCapabilityFromEquipment,
} from "./ammunitionEquipment";

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
        ammunitionCapability: { mode: "required", acceptedFamily: "bolts" },
      }),
    ).toEqual({ mode: "required", acceptedFamily: "bolts" });
    expect(weaponAmmunitionCapabilityFromEquipment({})).toBeNull();
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
