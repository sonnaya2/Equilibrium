import { equipmentById } from "../../data";
import type { EquipmentSlot } from "../../data/records";
import type { CombatStyle } from "../../types";

/**
 * Style ammunition selection for Ranged mechanics (Deathspore free-cast, Puncture).
 * Distinct from ammunitionTier (AD formula cap) which folds into model.base.
 */

export type StyleAmmoId = "deathspore" | "splintering" | "bik";

/** Equipment catalogue ids that select a style ammo mechanic. */
export const STYLE_AMMO_ITEM_IDS: Readonly<Record<StyleAmmoId, readonly string[]>> = {
  deathspore: ["item:deathspore-arrows"],
  splintering: ["item:splintering-arrows"],
  bik: ["item:bik-arrows"],
};

const RANGED_WEAPON_SLOTS: ReadonlySet<EquipmentSlot> = new Set(["mainhand", "offhand", "twohand"]);

export function hasRangedWeapon(equipmentIds: readonly string[] | undefined): boolean {
  return (
    equipmentIds?.some((id) => {
      const record = equipmentById(id);
      return (
        record !== undefined &&
        RANGED_WEAPON_SLOTS.has(record.slot ?? "ammo") &&
        (record.style === "ranged" || record.style === "hybrid")
      );
    }) === true
  );
}

/** Resolve style ammo from equipped item ids (ammo slot / equipment list). */
export function styleAmmoFromEquipmentIds(
  equipmentIds: readonly string[] | undefined,
): StyleAmmoId | undefined {
  if (!equipmentIds?.length) return undefined;
  const set = new Set(equipmentIds);
  for (const [ammo, ids] of Object.entries(STYLE_AMMO_ITEM_IDS) as [
    StyleAmmoId,
    readonly string[],
  ][]) {
    if (ids.some((id) => set.has(id))) return ammo;
  }
  return undefined;
}

/** Prefer explicit override; else derive from equipment. */
export function resolveStyleAmmo(
  explicit: StyleAmmoId | undefined,
  equipmentIds: readonly string[] | undefined,
  style: CombatStyle | undefined,
): StyleAmmoId | undefined {
  if (style !== "ranged" || !hasRangedWeapon(equipmentIds)) return undefined;
  return explicit ?? styleAmmoFromEquipmentIds(equipmentIds);
}

export function isRangedAmmoActive(
  ammo: StyleAmmoId | undefined,
  style: CombatStyle | undefined,
  equipmentIds: readonly string[] | undefined,
): boolean {
  return ammo !== undefined && style === "ranged" && hasRangedWeapon(equipmentIds);
}
