import type { ItemPassiveId } from "../data/records";
import type { PassiveDefinition } from "./contracts";
import { PASSIVE_DEFINITIONS } from "./definitions";

export const IGNEOUS_ULTIMATE_PASSIVES: readonly ItemPassiveId[] = [
  "igneous-overpower",
  "igneous-deadshot",
  "igneous-omnipower",
  "igneous-death-skulls",
];

export const IGNEOUS_ULTIMATE_PASSIVE_SET = new Set<ItemPassiveId>(IGNEOUS_ULTIMATE_PASSIVES);

export const LENG_PASSIVES: readonly ItemPassiveId[] = [
  "leng-endless-frost",
  "leng-boundless-chill",
];

export const LENG_PASSIVE_SET = new Set<ItemPassiveId>(LENG_PASSIVES);

const BY_ID: ReadonlyMap<ItemPassiveId, PassiveDefinition> = new Map(
  PASSIVE_DEFINITIONS.map((d) => [d.id, d]),
);

export function allPassiveDefinitions(): readonly PassiveDefinition[] {
  return PASSIVE_DEFINITIONS;
}

export function definitionById(id: ItemPassiveId): PassiveDefinition | undefined {
  return BY_ID.get(id);
}

export function isIgneousUltimatePassive(id: ItemPassiveId): boolean {
  return IGNEOUS_ULTIMATE_PASSIVE_SET.has(id);
}

export function isLengPassive(id: ItemPassiveId): boolean {
  return LENG_PASSIVE_SET.has(id);
}

export { PASSIVE_DEFINITIONS, BY_ID };
