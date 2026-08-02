import { equipmentById } from "../../data";
import type { EquipmentRecord, ItemPassiveId } from "../../data/records";
import type { AbilitySpec } from "../../pipeline/calculateAbility";

export type WeaponConfiguration =
  | "twohand"
  | "dualwield"
  | "mainhand"
  | "shield"
  | "defender"
  | "necromancy";

/**
 * Structured cast/palette availability for one ability under a loadout.
 * Region obtainability stays in data/availability.ts — this is cast legality.
 */
export type AbilityCastAvailability =
  | { available: true }
  | {
      available: false;
      reason:
        | "missing-passive"
        | "superseded"
        | "weapon-requirement"
        | "missing-equipment"
        | "other";
      message: string;
    };

/** Passive ids granted by one equipment record (plural preferred; singular still works). */
export function equipmentRecordPassiveIds(item: EquipmentRecord): ItemPassiveId[] {
  const ids: ItemPassiveId[] = [];
  if (item.passiveIds) {
    for (const id of item.passiveIds) ids.push(id);
  }
  if (item.passiveId && !ids.includes(item.passiveId)) ids.push(item.passiveId);
  return ids;
}

/** Derive active passives from equipped catalogue ids (deduped). */
export function passiveIdsFromEquipmentIds(
  equipmentIds?: readonly string[],
): readonly ItemPassiveId[] {
  if (!equipmentIds?.length) return [];
  const out = new Set<ItemPassiveId>();
  for (const id of equipmentIds) {
    const item = equipmentById(id);
    if (!item) continue;
    for (const passive of equipmentRecordPassiveIds(item)) out.add(passive);
  }
  return [...out];
}

const IGNEOUS_PASSIVE_UNLOCK_MESSAGE: Readonly<Partial<Record<ItemPassiveId, string>>> = {
  "igneous-overpower": "Requires Igneous Kal-Ket or Igneous Kal-Zuk",
  "igneous-deadshot": "Requires Igneous Kal-Xil or Igneous Kal-Zuk",
  "igneous-omnipower": "Requires Igneous Kal-Mej or Igneous Kal-Zuk",
  "igneous-death-skulls": "Requires Igneous Kal-Mor or Igneous Kal-Zuk",
};

export function missingPassiveMessage(required: readonly ItemPassiveId[]): string {
  for (const id of required) {
    const msg = IGNEOUS_PASSIVE_UNLOCK_MESSAGE[id];
    if (msg) return msg;
  }
  return `Requires equipment passive: ${required.join(" or ")}`;
}

export function weaponRequirementMessage(ability: AbilitySpec): string {
  const requirement =
    ability.weaponRequirement === "conduit"
      ? "a conduit"
      : ability.weaponRequirement === "death-guard-and-conduit"
        ? "death guard and conduit"
        : (ability.weaponRequirement ??
          (ability.style === "necromancy" ? "a necromancy weapon" : `${ability.style} weapon`));
  return `${ability.id} requires ${requirement}`;
}

export function equipmentRequirementMessage(ability: AbilitySpec): string {
  const ids = ability.requiredEquipmentAnyOf;
  if (!ids?.length) return `${ability.id} requires equipment not present in the loadout`;
  return `${ability.id} requires equipped ${ids.join(" or ")}`;
}

/**
 * Pure equipment-shape check shared by engine validation and ability pickers.
 *
 * Necromancy (wiki — Conjuration / Necromancy abilities):
 * - necrotic basics/enhanced/ultimates need a siphon (main hand); they still
 *   cast with a shield or defender in the off-hand
 * - conjures need a conduit (off-hand); shield/defender dual is not enough
 * - loadout reports `"necromancy"` only when a conduit is available (equipped
 *   conduit, or empty off-hand with the dual-hand tier sliders)
 *
 * Melee only has 1H / dual / 2H gates among non-necro styles:
 * - dualwield req: offensive OH or defender (not shield, empty OH, or 2H alone)
 * - twohand req: two-handed only
 * - defender counts as dual-wield OH; pure shield does not
 *
 * Ranged and Magic: no dual/2H cast gates (wiki 22 Jul 2024 Magic weapon-type
 * requirements removed; ranged never had them). Stale dualwield/twohand tags on
 * those styles are ignored.
 */
export function meetsWeaponRequirement(
  ability: AbilitySpec,
  weaponConfiguration?: WeaponConfiguration,
): boolean {
  if (weaponConfiguration === undefined) return true;

  if (ability.style === "necromancy") {
    const req = ability.weaponRequirement;
    if (req === "conduit" || req === "death-guard-and-conduit") {
      return weaponConfiguration === "necromancy";
    }
    return (
      weaponConfiguration === "necromancy" ||
      weaponConfiguration === "mainhand" ||
      weaponConfiguration === "shield" ||
      weaponConfiguration === "defender"
    );
  }

  if (weaponConfiguration === "necromancy") return false;

  const req = ability.weaponRequirement;
  if (req === "conduit" || req === "death-guard-and-conduit") return false;
  if (req === undefined) return true;

  if (ability.style === "ranged" || ability.style === "magic") return true;

  if (req === "dualwield") {
    return weaponConfiguration === "dualwield" || weaponConfiguration === "defender";
  }
  if (req === "twohand") {
    return weaponConfiguration === "twohand";
  }
  if (req === "mainhand") {
    return weaponConfiguration !== "twohand";
  }
  return weaponConfiguration === req;
}

export function meetsEquipmentRequirement(
  ability: AbilitySpec,
  equipmentIds?: readonly string[],
): boolean {
  return (
    ability.requiredEquipmentAnyOf === undefined ||
    ability.requiredEquipmentAnyOf.some((id) => equipmentIds?.includes(id))
  );
}

export function meetsPassiveRequirement(
  ability: AbilitySpec,
  passiveIds?: readonly ItemPassiveId[],
): boolean {
  return (
    ability.requiredPassiveAnyOf === undefined ||
    ability.requiredPassiveAnyOf.length === 0 ||
    ability.requiredPassiveAnyOf.some((id) => passiveIds?.includes(id))
  );
}

export type AbilityAvailabilityOptions = {
  weaponConfiguration?: WeaponConfiguration;
  equipmentIds?: readonly string[];
  /** Prefer resolved ActiveEquipmentEffects.passiveIds when available. */
  passiveIds?: readonly ItemPassiveId[];
  /**
   * Peers that share a replacementGroup. When an upgrade peer's required
   * passive is active, the base (no passive requirement) is superseded.
   */
  groupPeers?: readonly Pick<
    AbilitySpec,
    "id" | "name" | "replacementGroup" | "requiredPassiveAnyOf"
  >[];
};

/**
 * Pure ability availability for UI, cast gates, Revolution, and solver pools.
 * Does not check adrenaline, cooldowns, or sequence windows.
 */
export function resolveAbilityCastAvailability(
  ability: AbilitySpec,
  options: AbilityAvailabilityOptions = {},
): AbilityCastAvailability {
  if (!meetsWeaponRequirement(ability, options.weaponConfiguration)) {
    return {
      available: false,
      reason: "weapon-requirement",
      message: weaponRequirementMessage(ability),
    };
  }

  if (!meetsEquipmentRequirement(ability, options.equipmentIds)) {
    return {
      available: false,
      reason: "missing-equipment",
      message: equipmentRequirementMessage(ability),
    };
  }

  const passives = options.passiveIds ?? passiveIdsFromEquipmentIds(options.equipmentIds);

  if (!meetsPassiveRequirement(ability, passives)) {
    return {
      available: false,
      reason: "missing-passive",
      message: missingPassiveMessage(ability.requiredPassiveAnyOf ?? []),
    };
  }

  if (ability.replacementGroup && options.groupPeers?.length) {
    const upgrade = options.groupPeers.find(
      (peer) =>
        peer.id !== ability.id &&
        peer.replacementGroup === ability.replacementGroup &&
        (peer.requiredPassiveAnyOf?.some((p) => passives.includes(p)) ?? false),
    );
    if (upgrade && !ability.requiredPassiveAnyOf?.length) {
      return {
        available: false,
        reason: "superseded",
        message: `Replaced by ${upgrade.name}`,
      };
    }
  }

  return { available: true };
}

/** Permanent cast block text, or null when permanently legal under the loadout. */
export function permanentAvailabilityBlock(
  ability: AbilitySpec,
  options: AbilityAvailabilityOptions = {},
): string | null {
  const result = resolveAbilityCastAvailability(ability, options);
  return result.available ? null : result.message;
}
