import type { ActiveEquipmentEffects } from "../../shared/equipment";
import { hasPassive } from "../../shared/equipment";
import type { ItemPassiveId } from "../../data/records";

/** Fleeting / enhanced fleeting boots: Winds End Snipe CD reduction. */
export const WINDS_END_PASSIVE_ID: ItemPassiveId = "winds-end";

export const FLEETING_BOOTS_ITEM_IDS = [
  "item:fleeting-boots",
  "item:enhanced-fleeting-boots",
] as const;

export type FleetingBootsItemId = (typeof FLEETING_BOOTS_ITEM_IDS)[number];

/** Piercing Shot base Snipe CDR ticks (no boots). */
export const SNIPE_CDR_PIERCING_BASE_TICKS = 4;
/** Piercing Shot / Ranged basic Snipe CDR ticks with Fleeting boots (Winds End). */
export const SNIPE_CDR_FLEETING_TICKS = 6;

export function isFleetingBootsId(id: string | null | undefined): boolean {
  return id === "item:fleeting-boots" || id === "item:enhanced-fleeting-boots";
}

/**
 * Detection sources for Fleeting boots.
 * Prefer equipmentEffects.passiveIds (winds-end); fall back to equipmentIds / boots slot.
 */
export type FleetingBootsDetectionInput = {
  equipmentIds?: readonly string[] | null;
  equipmentEffects?: ActiveEquipmentEffects | null;
  equipmentSlots?: Partial<Record<string, string | null | undefined>> | null;
};

/**
 * True when Fleeting / Enhanced fleeting boots are equipped.
 * Prefer winds-end on ActiveEquipmentEffects.passiveIds; fall back to flat
 * equipmentIds and boots slot for fixtures that only populate one of those.
 */
export function hasFleetingBoots(input: FleetingBootsDetectionInput | undefined | null): boolean {
  if (!input) return false;
  if (hasPassive(input.equipmentEffects ?? undefined, WINDS_END_PASSIVE_ID)) return true;
  if (input.equipmentIds?.some((id) => isFleetingBootsId(id))) return true;
  return isFleetingBootsId(input.equipmentSlots?.boots ?? null);
}
