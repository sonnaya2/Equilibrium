import type { EquipmentRecord, WeaponClass } from "../../data/records";
import {
  effectiveRangedStatTier,
  isAmmunitionCompatible,
  resolveAmmunitionProfile,
  resolveQuiverProfile,
  selectAmmunitionFromAmmoSlot,
  type ResolvedRangedAmmunitionProfile,
  type ResolvedAmmunitionProfile,
  type ResolvedQuiverProfile,
  type RangedWeaponAmmunitionCapability,
} from "./ammunitionProfile";

type AmmunitionEquipmentRecord = Pick<
  EquipmentRecord,
  "id" | "name" | "tier" | "damageTier" | "requirementTier" | "ammunition"
>;
type QuiverEquipmentRecord = Pick<EquipmentRecord, "id" | "name" | "quiver">;
type WeaponEquipmentRecord = Pick<
  EquipmentRecord,
  "tier" | "damageTier" | "weaponClass" | "ammunitionCapability"
>;

export function resolveAmmunitionFromEquipment(
  record: AmmunitionEquipmentRecord | null | undefined,
): ResolvedAmmunitionProfile | null {
  if (record == null || record.ammunition == null) return null;
  return resolveAmmunitionProfile({
    id: record.id,
    label: record.name,
    family: record.ammunition.family,
    statTier: record.damageTier ?? record.tier ?? Number.NaN,
    mechanicId: record.ammunition.mechanicId,
    support: record.ammunition.support,
  });
}

export function resolveQuiverFromEquipment(
  record: QuiverEquipmentRecord | null | undefined,
): ResolvedQuiverProfile | null {
  if (record == null || record.quiver == null) return null;
  return resolveQuiverProfile({
    id: record.id,
    label: record.name,
    acceptedFamilies: record.quiver.acceptedFamilies,
    passiveIds: record.quiver.passiveIds,
    support: record.quiver.support,
  });
}

export function weaponAmmunitionCapabilityFromEquipment(
  record: Pick<EquipmentRecord, "ammunitionCapability" | "weaponClass"> | null | undefined,
): RangedWeaponAmmunitionCapability | null {
  if (record?.ammunitionCapability) return record.ammunitionCapability;
  return record?.weaponClass == null ? null : capabilityForWeaponClass(record.weaponClass);
}

function damageTierOf(record: Pick<EquipmentRecord, "tier" | "damageTier">): number | null {
  const tier = record.damageTier ?? record.tier;
  return tier != null && Number.isFinite(tier) && tier >= 0 ? Math.floor(tier) : null;
}

export function resolveRangedAmmunitionProfileFromEquipment(input: {
  weapon: WeaponEquipmentRecord | null | undefined;
  ammoSlot: (AmmunitionEquipmentRecord & QuiverEquipmentRecord) | null | undefined;
  selectedAmmunition: AmmunitionEquipmentRecord | null | undefined;
}): ResolvedRangedAmmunitionProfile | null {
  const capability = weaponAmmunitionCapabilityFromEquipment(input.weapon);
  const weaponTier = input.weapon == null ? null : damageTierOf(input.weapon);
  if (capability == null || weaponTier == null) return null;

  const directProjectile =
    input.ammoSlot?.ammunition == null ? null : resolveAmmunitionFromEquipment(input.ammoSlot);
  const quiver = resolveQuiverFromEquipment(input.ammoSlot);
  const selectedProjectile = (() => {
    if (quiver == null) return directProjectile;
    const selection = selectAmmunitionFromAmmoSlot({
      kind: "quiver",
      quiver,
      selectedAmmunition: resolveAmmunitionFromEquipment(input.selectedAmmunition),
    });
    return selection.kind === "quiver" ? selection.ammunition : null;
  })();
  const projectile = isAmmunitionCompatible(capability, selectedProjectile)
    ? selectedProjectile
    : null;

  return Object.freeze({
    projectile,
    quiver,
    weaponCapability: capability,
    effectiveStatTier: effectiveRangedStatTier(weaponTier, capability, projectile),
  });
}

function capabilityForWeaponClass(weaponClass: WeaponClass): RangedWeaponAmmunitionCapability {
  if (weaponClass === "bow") return { mode: "required", acceptedFamily: "arrows" };
  if (weaponClass === "crossbow") return { mode: "required", acceptedFamily: "bolts" };
  return { mode: "none", acceptedFamily: null };
}
