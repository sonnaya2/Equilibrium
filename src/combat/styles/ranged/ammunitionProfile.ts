import type {
  AmmunitionFamily,
  AmmunitionSupport,
  RangedAmmunitionMechanicId,
  RangedWeaponAmmunitionCapability,
} from "../../data/ammunition";
import type { ItemPassiveId } from "../../data/records";

export type {
  AmmunitionFamily,
  AmmunitionSupport,
  AmmunitionSupportStatus,
  RangedAmmunitionMechanicId,
  RangedAmmunitionMode,
  RangedWeaponAmmunitionCapability,
} from "../../data/ammunition";
export { AMMUNITION_FAMILIES } from "../../data/ammunition";

export interface AmmunitionRecordAdapter {
  readonly id: string;
  readonly label: string;
  readonly family: AmmunitionFamily;
  readonly statTier: number;
  readonly mechanicId: RangedAmmunitionMechanicId;
  readonly support: AmmunitionSupport;
}

export interface ResolvedAmmunitionProfile {
  readonly itemId: string;
  readonly label: string;
  readonly family: AmmunitionFamily;
  readonly statTier: number;
  readonly mechanicId: RangedAmmunitionMechanicId;
  readonly support: AmmunitionSupport;
}

export interface QuiverRecordAdapter {
  readonly id: string;
  readonly label: string;
  readonly acceptedFamilies: readonly AmmunitionFamily[];
  readonly passiveIds: readonly ItemPassiveId[];
  readonly support: AmmunitionSupport;
}

export interface ResolvedQuiverProfile {
  readonly itemId: string;
  readonly label: string;
  readonly acceptedFamilies: readonly AmmunitionFamily[];
  readonly passiveIds: readonly ItemPassiveId[];
  readonly support: AmmunitionSupport;
}

export interface ResolvedRangedAmmunitionProfile {
  readonly projectile: ResolvedAmmunitionProfile | null;
  readonly quiver: ResolvedQuiverProfile | null;
  readonly weaponCapability: RangedWeaponAmmunitionCapability;
  readonly effectiveStatTier: number | null;
}

export type AmmoSlotSelection =
  | {
      readonly kind: "empty";
    }
  | {
      readonly kind: "projectile";
      readonly ammunition: ResolvedAmmunitionProfile;
    }
  | {
      readonly kind: "quiver";
      readonly quiver: ResolvedQuiverProfile;
      readonly ammunition: ResolvedAmmunitionProfile | null;
    };

function immutableSupport(support: AmmunitionSupport): AmmunitionSupport {
  return Object.freeze({
    status: support.status,
    label: support.label,
    ...(support.note === undefined ? {} : { note: support.note }),
  });
}

function validTier(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`);
  }
  return Math.floor(value);
}

export function resolveAmmunitionProfile(
  record: AmmunitionRecordAdapter | null | undefined,
): ResolvedAmmunitionProfile | null {
  if (record == null) return null;
  if (record.id.length === 0) throw new RangeError("ammunition id must not be empty");
  if (record.label.length === 0) throw new RangeError("ammunition label must not be empty");
  return Object.freeze({
    itemId: record.id,
    label: record.label,
    family: record.family,
    statTier: validTier(record.statTier, "ammunition stat tier"),
    mechanicId: record.mechanicId,
    support: immutableSupport(record.support),
  });
}

export function resolveQuiverProfile(
  record: QuiverRecordAdapter | null | undefined,
): ResolvedQuiverProfile | null {
  if (record == null) return null;
  if (record.id.length === 0) throw new RangeError("quiver id must not be empty");
  if (record.label.length === 0) throw new RangeError("quiver label must not be empty");
  const acceptedFamilies = [...new Set(record.acceptedFamilies)];
  return Object.freeze({
    itemId: record.id,
    label: record.label,
    acceptedFamilies: Object.freeze(acceptedFamilies),
    passiveIds: Object.freeze([...new Set(record.passiveIds)]),
    support: immutableSupport(record.support),
  });
}

export function selectAmmunitionFromAmmoSlot(
  selection:
    | { readonly kind: "empty" }
    | { readonly kind: "projectile"; readonly ammunition: ResolvedAmmunitionProfile }
    | {
        readonly kind: "quiver";
        readonly quiver: ResolvedQuiverProfile;
        readonly selectedAmmunition: ResolvedAmmunitionProfile | null;
      },
): AmmoSlotSelection {
  if (selection.kind === "empty") return selection;
  if (selection.kind === "projectile") return selection;
  const ammunition =
    selection.selectedAmmunition !== null &&
    selection.quiver.acceptedFamilies.includes(selection.selectedAmmunition.family)
      ? selection.selectedAmmunition
      : null;
  return Object.freeze({
    kind: "quiver" as const,
    quiver: selection.quiver,
    ammunition,
  });
}

export function isAmmunitionCompatible(
  capability: RangedWeaponAmmunitionCapability,
  ammunition: ResolvedAmmunitionProfile | null | undefined,
): boolean {
  return (
    capability.mode !== "none" &&
    ammunition != null &&
    capability.acceptedFamily === ammunition.family
  );
}

export function effectiveRangedStatTier(
  weaponTier: number,
  capability: RangedWeaponAmmunitionCapability,
  ammunition: ResolvedAmmunitionProfile | null | undefined,
): number | null {
  const normalizedWeaponTier = validTier(weaponTier, "weapon tier");
  if (ammunition != null && isAmmunitionCompatible(capability, ammunition)) {
    return Math.min(normalizedWeaponTier, ammunition.statTier);
  }
  return capability.mode === "required" ? null : normalizedWeaponTier;
}
