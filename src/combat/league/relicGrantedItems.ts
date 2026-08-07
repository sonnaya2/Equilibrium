import type { EquipmentSlot } from "../data/records";
import { ICYENIC_FAITH_RELIC, TOME_OF_THE_ICYENE_ID } from "./icyenicFaith";
import { NARAGI_EDICT_RELIC, SLIVER_OF_EDICTS_ID } from "./naragiEdict";

export const INFERNAL_FIRE_RELIC = "Infernal Fire";
export const AVERNIC_STAR_ID = "item:avernic-star";

/**
 * Relic-granted equipment availability. One table for hide/equip/unequip rules;
 * no display-name checks and no UI-only gates.
 */

export interface RelicGrantedItem {
  relicName: string;
  itemId: string;
  /** League relic tier (1-based). */
  tier: number;
  /** Slot the item occupies when worn (gating still applies to any slot). */
  slot: EquipmentSlot;
}

export const RELIC_GRANTED_ITEMS: readonly RelicGrantedItem[] = [
  {
    relicName: ICYENIC_FAITH_RELIC,
    itemId: TOME_OF_THE_ICYENE_ID,
    tier: 7,
    slot: "pocket",
  },
  {
    relicName: NARAGI_EDICT_RELIC,
    itemId: SLIVER_OF_EDICTS_ID,
    tier: 7,
    slot: "pocket",
  },
  {
    relicName: INFERNAL_FIRE_RELIC,
    itemId: AVERNIC_STAR_ID,
    tier: 7,
    slot: "pocket",
  },
] as const;

const BY_ITEM = new Map(RELIC_GRANTED_ITEMS.map((row) => [row.itemId, row]));
const BY_RELIC = new Map(RELIC_GRANTED_ITEMS.map((row) => [row.relicName, row]));

export function isRelicGrantedItem(itemId: string | null | undefined): boolean {
  return itemId != null && BY_ITEM.has(itemId);
}

export function relicGrantedItemFor(itemId: string): RelicGrantedItem | undefined {
  return BY_ITEM.get(itemId);
}

export function relicGrantedItemForRelic(relicName: string): RelicGrantedItem | undefined {
  return BY_RELIC.get(relicName);
}

export function relicRequiredForItem(itemId: string): string | undefined {
  return BY_ITEM.get(itemId)?.relicName;
}

function activeRelicSet(
  activeRelicNames: readonly string[] | ReadonlySet<string> | undefined,
): ReadonlySet<string> {
  if (!activeRelicNames) return new Set();
  return activeRelicNames instanceof Set ? activeRelicNames : new Set(activeRelicNames);
}

/** True when the item is ordinary gear, or a relic-granted item whose relic is active. */
export function isRelicGrantedItemAvailable(
  itemId: string | null | undefined,
  activeRelicNames: readonly string[] | ReadonlySet<string> | undefined,
): boolean {
  if (itemId == null || itemId === "") return false;
  const grant = BY_ITEM.get(itemId);
  if (!grant) return true;
  return activeRelicSet(activeRelicNames).has(grant.relicName);
}

/**
 * Drop slotted ids that require an inactive relic. Does not auto-equip grants.
 * Returns the same object reference when nothing changes.
 */
export function stripUnavailableRelicItems<T extends Partial<Record<EquipmentSlot, string | null>>>(
  equipmentSlots: T,
  activeRelicNames: readonly string[] | ReadonlySet<string> | undefined,
): T {
  const active = activeRelicSet(activeRelicNames);
  let changed = false;
  const next: Partial<Record<EquipmentSlot, string | null>> = { ...equipmentSlots };
  for (const [slot, id] of Object.entries(equipmentSlots)) {
    if (typeof id !== "string" || id.length === 0) continue;
    const grant = BY_ITEM.get(id);
    if (!grant) continue;
    if (active.has(grant.relicName)) continue;
    delete next[slot as EquipmentSlot];
    changed = true;
  }
  return (changed ? next : equipmentSlots) as T;
}

/** Filter list/search results: hide granted items when their relic is off. */
export function filterRelicGrantedEquipmentIds(
  itemIds: readonly string[],
  activeRelicNames: readonly string[] | ReadonlySet<string> | undefined,
): string[] {
  return itemIds.filter((id) => isRelicGrantedItemAvailable(id, activeRelicNames));
}

export function filterRelicGrantedRecords<T extends { id: string }>(
  records: readonly T[],
  activeRelicNames: readonly string[] | ReadonlySet<string> | undefined,
): T[] {
  return records.filter((r) => isRelicGrantedItemAvailable(r.id, activeRelicNames));
}
