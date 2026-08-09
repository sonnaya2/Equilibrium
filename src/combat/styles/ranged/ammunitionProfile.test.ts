import { describe, expect, it } from "vitest";
import {
  effectiveRangedStatTier,
  isAmmunitionCompatible,
  resolveAmmunitionProfile,
  resolveQuiverProfile,
  selectAmmunitionFromAmmoSlot,
  type RangedWeaponAmmunitionCapability,
} from "./ammunitionProfile";

const arrows = resolveAmmunitionProfile({
  id: "item:arrows",
  label: "Test arrows",
  family: "arrows",
  statTier: 95,
  mechanicId: "black-stone",
  support: { status: "modeled", label: "Modeled" },
})!;

const bolts = resolveAmmunitionProfile({
  id: "item:bolts",
  label: "Test bolts",
  family: "bolts",
  statTier: 90,
  mechanicId: "hydrix",
  support: { status: "partially-modeled", label: "Partial" },
})!;

const bow: RangedWeaponAmmunitionCapability = {
  mode: "optional",
  acceptedFamily: "arrows",
};

const crossbow: RangedWeaponAmmunitionCapability = {
  mode: "required",
  acceptedFamily: "bolts",
};

const ordinaryBow: RangedWeaponAmmunitionCapability = {
  mode: "required",
  acceptedFamily: "arrows",
};

const thrown: RangedWeaponAmmunitionCapability = {
  mode: "none",
  acceptedFamily: null,
};

describe("resolved ranged ammunition profiles", () => {
  it("keeps only compact immutable projectile identity", () => {
    expect(arrows).toMatchObject({
      itemId: "item:arrows",
      family: "arrows",
      statTier: 95,
      mechanicId: "black-stone",
    })!;
    expect(Object.isFrozen(arrows)).toBe(true);
    expect(Object.isFrozen(arrows?.support)).toBe(true);
  });

  it("rejects cross-family ammunition without name-based inference", () => {
    expect(isAmmunitionCompatible(bow, arrows)).toBe(true);
    expect(isAmmunitionCompatible(bow, bolts)).toBe(false);
    expect(isAmmunitionCompatible(crossbow, bolts)).toBe(true);
  });

  it("caps an external projectile at the lower weapon or projectile tier", () => {
    expect(effectiveRangedStatTier(100, bow, arrows)).toBe(95);
    expect(effectiveRangedStatTier(90, bow, arrows)).toBe(90);
    expect(effectiveRangedStatTier(100, bow, bolts)).toBe(100);
    expect(effectiveRangedStatTier(100, thrown, arrows)).toBe(100);
  });

  it("distinguishes required, optional, and no-ammo weapon modes", () => {
    expect(effectiveRangedStatTier(95, ordinaryBow, null)).toBeNull();
    expect(effectiveRangedStatTier(95, ordinaryBow, bolts)).toBeNull();
    expect(effectiveRangedStatTier(95, crossbow, arrows)).toBeNull();
    expect(effectiveRangedStatTier(95, bow, null)).toBe(95);
    expect(effectiveRangedStatTier(95, thrown, null)).toBe(95);
  });

  it("exposes selected ammunition only through a quiver", () => {
    const quiver = resolveQuiverProfile({
      id: "item:test-quiver",
      label: "Test quiver",
      acceptedFamilies: ["arrows"],
      passiveIds: ["pernix-quiver-max-hit-band"],
      support: { status: "modeled", label: "Modeled" },
    })!;
    expect(selectAmmunitionFromAmmoSlot({ kind: "projectile", ammunition: arrows })).toMatchObject({
      kind: "projectile",
      ammunition: arrows,
    });
    expect(
      selectAmmunitionFromAmmoSlot({ kind: "quiver", quiver, selectedAmmunition: arrows }),
    ).toMatchObject({ kind: "quiver", ammunition: arrows, quiver });
    expect(quiver).not.toHaveProperty("selectedAmmunitionId");
    expect(
      selectAmmunitionFromAmmoSlot({ kind: "quiver", quiver, selectedAmmunition: bolts }),
    ).toMatchObject({ kind: "quiver", ammunition: null });
  });
});
