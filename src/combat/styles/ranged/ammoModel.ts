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
): StyleAmmoId | undefined {
  return explicit ?? styleAmmoFromEquipmentIds(equipmentIds);
}
