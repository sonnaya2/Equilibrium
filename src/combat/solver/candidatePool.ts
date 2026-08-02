import type { AbilitySpec } from "../pipeline/calculateAbility";
import { resolveAbilityCastAvailability } from "../engine/cast/requirements";
import type { ItemPassiveId } from "../data/records";
import type { CandidatePool, CandidatePoolOptions, PoolAbility } from "./contracts";

function asPassiveIds(ids: readonly string[] | undefined): readonly ItemPassiveId[] | undefined {
  return ids as readonly ItemPassiveId[] | undefined;
}

function isFullyModeled(ability: PoolAbility): boolean {
  return ability.supportStatus === undefined;
}

/**
 * Index a pool by id. Duplicate ids fail loudly — silent Map last-write-wins
 * previously dropped alternate definitions without notice.
 */
export function indexPool<T extends PoolAbility>(pool: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const ability of pool) {
    if (map.has(ability.id)) {
      throw new Error(`candidate pool: duplicate ability id "${ability.id}"`);
    }
    map.set(ability.id, ability);
  }
  return map;
}

const GCD_TICKS = 3;

/** Build a search pool entry from an engine AbilitySpec (seed heuristics). */
export function poolAbilityFromSpec(spec: AbilitySpec): PoolAbility {
  let averageDamage: number | undefined;
  if (spec.hits.length) {
    let sum = 0;
    for (const h of spec.hits) sum += (h.band.minPct + h.band.maxPct) / 2;
    averageDamage = sum;
  }
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    exclusiveGroup: spec.replacementGroup,
    replacementGroup: spec.replacementGroup,
    cooldownGroup: spec.cooldownGroup,
    style: spec.style,
    offGcd: spec.offGcd,
    autoAttack: spec.autoAttack,
    averageDamage,
    occupancyTicks: spec.channelTicks ?? GCD_TICKS,
    cooldownTicks:
      spec.cooldownSeconds !== undefined ? Math.round(spec.cooldownSeconds / 0.6) : undefined,
    supportStatus: spec.supportStatus,
    weaponRequirement: spec.weaponRequirement,
    requiredEquipmentAnyOf: spec.requiredEquipmentAnyOf,
    requiredPassiveAnyOf: spec.requiredPassiveAnyOf,
  };
}

/**
 * Build the Revolution candidate set for a combat style.
 * Defaults: no autos, no off-GCD, no partial/not-modeled/unverified specs.
 * Ids are sorted stably for deterministic search.
 *
 * Weapon-shaped abilities (twohand / dualwield / mainhand / conduit) are dropped
 * when they are illegal under `options.weaponConfiguration` — e.g. Hurricane on
 * dual-wield, Flurry on a two-hander. Callers should always pass the loadout shape.
 *
 * Duplicate catalogue ids for the same style throw.
 */
export function buildCandidatePool(
  catalogue: readonly AbilitySpec[],
  style: AbilitySpec["style"],
  options: CandidatePoolOptions = {},
): CandidatePool {
  const allow = options.allow ? new Set(options.allow) : null;
  const deny = options.deny ? new Set(options.deny) : null;
  const includeAutos = options.includeAutos === true;
  const includeOffGcd = options.includeOffGcd === true;
  const includePartial = options.includePartial === true;

  const peersByGroup = new Map<string, AbilitySpec[]>();
  for (const ability of catalogue) {
    if (!ability.replacementGroup) continue;
    const list = peersByGroup.get(ability.replacementGroup) ?? [];
    list.push(ability);
    peersByGroup.set(ability.replacementGroup, list);
  }

  const selected: AbilitySpec[] = [];
  const seenIds = new Set<string>();
  for (const ability of catalogue) {
    if (ability.style !== style) continue;
    if (deny?.has(ability.id)) continue;
    if (allow && !allow.has(ability.id)) continue;
    if (!includeAutos && ability.autoAttack) continue;
    if (!includeOffGcd && ability.offGcd) continue;
    if (!includePartial && !isFullyModeled(ability)) continue;
    // Illegal under weapon / equipment / passive / supersede rules.
    const peers = ability.replacementGroup
      ? (peersByGroup.get(ability.replacementGroup) ?? [])
      : [];
    const availability = resolveAbilityCastAvailability(ability, {
      weaponConfiguration: options.weaponConfiguration,
      equipmentIds: options.equipmentIds,
      passiveIds: asPassiveIds(options.passiveIds),
      groupPeers: peers,
    });
    if (!availability.available) continue;
    if (seenIds.has(ability.id)) {
      throw new Error(`candidate pool: duplicate ability id "${ability.id}"`);
    }
    seenIds.add(ability.id);
    selected.push(ability);
  }

  selected.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const byId = new Map<string, AbilitySpec>();
  const exclusive = new Map<string, string[]>();
  for (const ability of selected) {
    byId.set(ability.id, ability);
    if (!ability.replacementGroup) continue;
    const members = exclusive.get(ability.replacementGroup) ?? [];
    members.push(ability.id);
    exclusive.set(ability.replacementGroup, members);
  }

  const exclusiveGroups = new Map<string, readonly string[]>();
  for (const [group, members] of exclusive) {
    exclusiveGroups.set(
      group,
      [...members].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }

  return {
    style,
    byId,
    ids: selected.map((ability) => ability.id),
    exclusiveGroups,
    options: { ...options },
  };
}
