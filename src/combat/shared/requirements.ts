import { pickPrimaryRecord, recordsForEngineId } from "../abilities/engineMap";
import { abilityById, equipmentById } from "../data";
import { isObtainableInRegions } from "../data/availability";
import type { EquipmentRecord, ItemPassiveId, UnlockInfo } from "../data/records";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import {
  resolveLeagueAbilityAvailability,
  type LeagueAbilityAvailability,
} from "../league/abilityAvailability";
import type { ResolvedLeagueRules } from "../league/ruleset";

/** Unlock for an engine ability via record map - no registry import (cycle with data). */
function unlockForEngineAbility(engineId: string): UnlockInfo | undefined {
  const mapped = recordsForEngineId(engineId);
  if (mapped.length === 0) return undefined;
  const recordId = pickPrimaryRecord(engineId, mapped);
  return abilityById(recordId)?.unlock;
}

export type WeaponConfiguration =
  "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";

/**
 * Structured cast/palette availability for one ability under a loadout.
 * Region obtainability stays in data/availability.ts - this is cast legality.
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
        | "missing-special-access"
        | "league-restriction"
        | "region-locked"
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
        : ability.weaponRequirement === "mainhand-empty"
          ? "main-hand only (empty off-hand)"
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
 * Necromancy (wiki - Conjuration / Necromancy abilities):
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
    // Sim shape is "necromancy" when a conduit is equipped. Loadout store may still
    // say "dualwield" for death-guard + lantern; treat that as conduit-capable so
    // conjures are not silently skipped on Run.
    const necroDual = weaponConfiguration === "dualwield";
    const req = ability.weaponRequirement;
    if (req === "conduit" || req === "death-guard-and-conduit") {
      return weaponConfiguration === "necromancy" || necroDual;
    }
    return (
      weaponConfiguration === "necromancy" ||
      necroDual ||
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
    // Adaptive Strike DW form is dual weapons only; Flurry still accepts defender.
    if (ability.id === "adaptive_strike_dw") {
      return weaponConfiguration === "dualwield";
    }
    return weaponConfiguration === "dualwield" || weaponConfiguration === "defender";
  }
  if (req === "twohand") {
    return weaponConfiguration === "twohand";
  }
  if (req === "mainhand-empty") {
    // Main-hand Adaptive Strike: empty OH or shield (not dual weapons / defender).
    return weaponConfiguration === "mainhand" || weaponConfiguration === "shield";
  }
  if (req === "mainhand") {
    // Loose non-2h (Icy Tempest); not the empty-OH Adaptive Strike form.
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

/** Catalogue id for Essence of Finality amulet (stores weapon specials). */
export const ESSENCE_OF_FINALITY_ITEM_ID = "item:essence-of-finality";

/** True when an equipped item natively provides this specialAttackId. */
export function equipmentGrantsNativeSpecial(
  abilityId: string,
  equipmentIds?: readonly string[],
  activeWeapon?: { specialAttackId?: string | null },
): boolean {
  if (activeWeapon !== undefined) return activeWeapon.specialAttackId === abilityId;
  if (!equipmentIds?.length) return false;
  for (const id of equipmentIds) {
    const item = equipmentById(id);
    if (item?.specialAttackId === abilityId) return true;
  }
  return false;
}

export function hasEssenceOfFinalityEquipped(equipmentIds?: readonly string[]): boolean {
  if (!equipmentIds?.length) return false;
  return equipmentIds.some(
    (id) => id === ESSENCE_OF_FINALITY_ITEM_ID || id.includes("essence-of-finality"),
  );
}

/**
 * Weapon special access: native weapon (specialAttackId match) or EoF with a
 * matching stored special id. EoF alone does not unlock every special.
 */
export function meetsSpecialAccess(
  ability: AbilitySpec,
  options: {
    equipmentIds?: readonly string[];
    activeWeapon?: { specialAttackId?: string | null };
    eofStoredSpecialId?: string | null;
  } = {},
): boolean {
  if (!ability.weaponSpecial || ability.requiresSpecialAccess !== true) return true;
  if (equipmentGrantsNativeSpecial(ability.id, options.equipmentIds, options.activeWeapon))
    return true;
  if (!hasEssenceOfFinalityEquipped(options.equipmentIds)) return false;
  // Fail-closed: stored special must be set and match the ability.
  if (options.eofStoredSpecialId == null || options.eofStoredSpecialId === "") return false;
  return options.eofStoredSpecialId === ability.id;
}

export function specialAccessMessage(ability: AbilitySpec): string {
  return `${ability.name} requires the special weapon equipped, or Essence of Finality with that special stored`;
}

export type AbilityAvailabilityOptions = {
  weaponConfiguration?: WeaponConfiguration;
  equipmentIds?: readonly string[];
  activeWeapon?: { specialAttackId?: string | null };
  /** Prefer resolved ActiveEquipmentEffects.passiveIds when available. */
  passiveIds?: readonly ItemPassiveId[];
  /** EoF stored special ability id when modeled. */
  eofStoredSpecialId?: string | null;
  /**
   * Peers that share a replacementGroup. When an upgrade peer's required
   * passive is active, the base (no passive requirement) is superseded.
   */
  groupPeers?: readonly Pick<
    AbilitySpec,
    "id" | "name" | "replacementGroup" | "requiredPassiveAnyOf"
  >[];
  league?: ResolvedLeagueRules;
  /**
   * When set (Limit to regions), same obtainability gate as solver regionDenyList.
   * Omit to skip region filtering (all regions).
   */
  unlockedRegions?: readonly string[];
  includeUnknownAvailability?: boolean;
};

/**
 * Map base <-> equipment upgrade in a replacementGroup from live passives.
 * Base (no requiredPassiveAnyOf) -> upgrade when peer passive is live
 * (Overpower -> Overpower (Igneous) with Kal-Ket).
 * Upgrade with unmet passive -> base peer (bars/queues restore base id/name).
 * Upgrade with live passive keeps identity. Wrong-style cape does not rewrite.
 * `byId` preferred for full specs; else `groupPeers` when entries are full AbilitySpecs.
 */
export function resolveEquippedAbilityVariant(
  ability: AbilitySpec,
  options: {
    passiveIds?: readonly ItemPassiveId[];
    equipmentIds?: readonly string[];
    byId?: ReadonlyMap<string, AbilitySpec>;
    groupPeers?: readonly AbilitySpec[];
  } = {},
): AbilitySpec {
  if (!ability.replacementGroup) return ability;

  const passives = options.passiveIds ?? passiveIdsFromEquipmentIds(options.equipmentIds);

  let peers: readonly AbilitySpec[] = options.groupPeers ?? [];
  if (options.byId) {
    const list: AbilitySpec[] = [];
    for (const peer of options.byId.values()) {
      if (peer.replacementGroup === ability.replacementGroup) list.push(peer);
    }
    peers = list;
  }

  // Passive-gated upgrade: keep when live; reverse to base peer when not.
  if (ability.requiredPassiveAnyOf?.length) {
    if (ability.requiredPassiveAnyOf.some((p) => passives.includes(p))) {
      return ability;
    }
    for (const peer of peers) {
      if (peer.id === ability.id) continue;
      if (peer.requiredPassiveAnyOf?.length) continue;
      return peer;
    }
    return ability;
  }

  // Base: rewrite to upgrade peer when its passive is live.
  if (!passives.length) return ability;
  for (const peer of peers) {
    if (peer.id === ability.id) continue;
    if (!peer.requiredPassiveAnyOf?.length) continue;
    if (!peer.requiredPassiveAnyOf.some((p) => passives.includes(p))) continue;
    return peer;
  }
  return ability;
}

/** Rewrite bar/rotation ids through equipment upgrades or reverse to base. */
export function resolveEquippedAbilityId(
  id: string,
  byId: ReadonlyMap<string, AbilitySpec>,
  options: {
    passiveIds?: readonly ItemPassiveId[];
    equipmentIds?: readonly string[];
  } = {},
): string {
  const ability = byId.get(id);
  if (!ability) return id;
  return resolveEquippedAbilityVariant(ability, { ...options, byId }).id;
}

/**
 * Pure ability availability for UI, cast gates, Revolution, and solver pools.
 * Does not check adrenaline, cooldowns, or sequence windows.
 */
export function resolveAbilityCastAvailability(
  ability: AbilitySpec,
  options: AbilityAvailabilityOptions = {},
): AbilityCastAvailability {
  const leagueAvailability: LeagueAbilityAvailability = resolveLeagueAbilityAvailability(
    ability,
    options.league,
  );
  if (!leagueAvailability.available) {
    return {
      available: false,
      reason: "league-restriction",
      message: leagueAvailability.message,
    };
  }
  // Same shape as Higher Power: permanent loadout gate, not mid-fight state.
  if (options.unlockedRegions != null) {
    const unlock = unlockForEngineAbility(ability.id);
    const region = isObtainableInRegions(unlock, options.unlockedRegions, {
      includeUnknown: options.includeUnknownAvailability === true,
    });
    if (!region.obtainable) {
      const needed = unlock?.regions?.length
        ? unlock.regions.join(" or ")
        : "a matching league region";
      return {
        available: false,
        reason: "region-locked",
        message: `${ability.name} requires ${needed}`,
      };
    }
  }
  if (!meetsWeaponRequirement(ability, options.weaponConfiguration)) {
    return {
      available: false,
      reason: "weapon-requirement",
      message: weaponRequirementMessage(ability),
    };
  }

  if (
    !meetsSpecialAccess(ability, {
      equipmentIds: options.equipmentIds,
      activeWeapon: options.activeWeapon,
      eofStoredSpecialId: options.eofStoredSpecialId,
    })
  ) {
    return {
      available: false,
      reason: "missing-special-access",
      message: specialAccessMessage(ability),
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
