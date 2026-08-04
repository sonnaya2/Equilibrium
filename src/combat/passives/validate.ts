import type { EquipmentRecord, ItemPassiveId } from "../data/records";
import { equipmentRecordPassiveIds } from "../shared/requirements";
import { PASSIVE_DEFINITIONS } from "./definitions";
import { definitionById } from "./registry";

const KNOWN_IDS = new Set(PASSIVE_DEFINITIONS.map((d) => d.id));

/** All ItemPassiveId union members (runtime mirror for exhaustiveness checks). */
export const ITEM_PASSIVE_IDS: readonly ItemPassiveId[] = [
  "jaws-of-the-abyss",
  "abyssal-parasite",
  "am-zi",
  "am-hej",
  "enduring-ruin",
  "reaver-ring",
  "champion-ring",
  "stalker-ring",
  "channeller-ring",
  "defender-accuracy",
  "masterwork-spear-bleed-extension",
  "igneous-overpower",
  "igneous-deadshot",
  "igneous-omnipower",
  "igneous-death-skulls",
  "leng-endless-frost",
  "leng-boundless-chill",
  "asylum-surgeon",
  "deathtouch-reflect",
  "ring-of-vigour",
];

/** Return validation errors for the passive registry (empty = ok). */
export function validatePassiveRegistry(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const id of ITEM_PASSIVE_IDS) {
    if (!definitionById(id)) {
      errors.push(`missing definition for ItemPassiveId: ${id}`);
    }
  }

  for (const def of PASSIVE_DEFINITIONS) {
    if (seen.has(def.id)) {
      errors.push(`duplicate definition id: ${def.id}`);
    }
    seen.add(def.id);

    if (!ITEM_PASSIVE_IDS.includes(def.id)) {
      errors.push(`definition id not in ItemPassiveId union: ${def.id}`);
    }

    if (!def.source?.verifiedAt) {
      errors.push(`${def.id}: source.verifiedAt required`);
    }

    if (
      (def.support === "modeled" || def.support === "partially-modeled") &&
      def.implementationOwners.length === 0
    ) {
      errors.push(`${def.id}: modeled/partially-modeled requires implementationOwners`);
    }

    if (!def.label) {
      errors.push(`${def.id}: label required`);
    }
    if (!def.lifecycle.length) {
      errors.push(`${def.id}: lifecycle required`);
    }
  }

  for (const id of seen) {
    if (!KNOWN_IDS.has(id as ItemPassiveId)) {
      errors.push(`unknown id in registry: ${id}`);
    }
  }

  if (PASSIVE_DEFINITIONS.length !== ITEM_PASSIVE_IDS.length) {
    errors.push(
      `definition count ${PASSIVE_DEFINITIONS.length} !== ItemPassiveId count ${ITEM_PASSIVE_IDS.length}`,
    );
  }

  return errors;
}

/**
 * Fail when equipment records name passives outside the registry.
 * defender-accuracy is synthetic (not stored on records) - still allowed if present.
 */
export function validateEquipmentPassiveRefs(
  records: readonly EquipmentRecord[],
): string[] {
  const errors: string[] = [];
  for (const item of records) {
    const ids = equipmentRecordPassiveIds(item);
    for (const id of ids) {
      if (!definitionById(id)) {
        errors.push(`${item.id}: unknown passive ${id}`);
      }
    }
  }
  return errors;
}
