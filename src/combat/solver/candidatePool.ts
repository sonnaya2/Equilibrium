import type { AbilitySpec } from "../pipeline/calculateAbility";
import {
  meetsEquipmentRequirement,
  meetsWeaponRequirement,
} from "../engine/cast/rules";
import type {
  CandidatePool,
  CandidatePoolOptions,
  PoolAbility,
} from "./contracts";

function isFullyModeled(ability: PoolAbility): boolean {
  return ability.supportStatus === undefined;
}

/** Index a pool by id (last write wins on duplicates). */
export function indexPool<T extends PoolAbility>(
  pool: readonly T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const ability of pool) map.set(ability.id, ability);
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
  };
}

/**
 * Build the Revolution candidate set for a combat style.
 * Defaults: no autos, no off-GCD, no partial/not-modeled/unverified specs.
 * Ids are sorted stably for deterministic search.
 *
 * Accepts an AbilitySpec catalogue only — there is no abilities/registry yet.
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

  const selected: AbilitySpec[] = [];
  for (const ability of catalogue) {
    if (ability.style !== style) continue;
    if (deny?.has(ability.id)) continue;
    if (allow && !allow.has(ability.id)) continue;
    if (!includeAutos && ability.autoAttack) continue;
    if (!includeOffGcd && ability.offGcd) continue;
    if (!includePartial && !isFullyModeled(ability)) continue;
    if (!meetsWeaponRequirement(ability, options.weaponConfiguration)) continue;
    if (!meetsEquipmentRequirement(ability, options.equipmentIds)) continue;
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
