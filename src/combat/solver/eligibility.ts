import type { AbilitySpec } from "../pipeline/calculateAbility";
import { meetsEquipmentRequirement, meetsWeaponRequirement } from "../engine/cast/rules";
import type {
  BarSizeBounds,
  CandidatePool,
  ExclusionReason,
  PoolAbility,
  SizeBounds,
} from "./contracts";

export type { BarSizeBounds, ExclusionReason, SizeBounds } from "./contracts";

export interface EligibilityOptions {
  includePartial?: boolean;
  size?: BarSizeBounds;
  weaponConfiguration?: CandidatePool["options"]["weaponConfiguration"];
  equipmentIds?: readonly string[];
}

const DEFAULT_SIZE: SizeBounds = { min: 1, max: 14 };

export function normalizeSizeBounds(size?: BarSizeBounds): SizeBounds {
  if (!size) return DEFAULT_SIZE;
  if ("min" in size && "max" in size) return { min: size.min, max: size.max };
  return { min: size.minSlots, max: size.maxSlots };
}

/**
 * Exclusive group key for search / bar validation.
 * Prefer explicit exclusiveGroup, then replacementGroup.
 */
export function exclusiveKey(ability: {
  exclusiveGroup?: string;
  replacementGroup?: string;
}): string | undefined {
  return ability.exclusiveGroup ?? ability.replacementGroup;
}

/**
 * Whether `id` can be appended to `bar` without duplicating an id or
 * sharing an exclusive/replacement group with an existing member.
 */
export function canAdd(
  bar: readonly string[],
  id: string,
  byId: ReadonlyMap<string, { exclusiveGroup?: string; replacementGroup?: string }>,
): boolean {
  if (bar.includes(id)) return false;
  const next = byId.get(id);
  if (!next) return false;
  const key = exclusiveKey(next);
  if (!key) return true;
  for (const existing of bar) {
    const e = byId.get(existing);
    if (e && exclusiveKey(e) === key) return false;
  }
  return true;
}

/** Pool members still legal to append given the current bar prefix. */
export function remainingCandidates<
  T extends { id: string; exclusiveGroup?: string; replacementGroup?: string },
>(
  bar: readonly string[],
  pool: readonly T[],
  byId: ReadonlyMap<string, { exclusiveGroup?: string; replacementGroup?: string }>,
): T[] {
  return pool.filter((a) => canAdd(bar, a.id, byId));
}

function supportIssue(ability: PoolAbility): ExclusionReason | null {
  if (!ability.supportStatus) return null;
  if (ability.supportStatus === "partially-modeled") {
    return {
      code: "partial-support",
      abilityId: ability.id,
      message: `${ability.id} is only partially modeled`,
    };
  }
  if (ability.supportStatus === "not-modeled") {
    return {
      code: "not-modeled",
      abilityId: ability.id,
      message: `${ability.id} is not modeled`,
    };
  }
  return {
    code: "mechanics-unverified",
    abilityId: ability.id,
    message: `${ability.id} has unverified mechanics`,
  };
}

/**
 * Static Revolution-bar validation. Does not simulate — uniqueness, size,
 * style, weapon/equipment, support status, off-GCD, and replacement groups.
 */
export function validateBarEligibility(
  bar: readonly string[],
  pool: CandidatePool,
  options: EligibilityOptions = {},
): ExclusionReason[] {
  const issues: ExclusionReason[] = [];
  const size = normalizeSizeBounds(options.size);
  const includePartial = options.includePartial ?? pool.options.includePartial ?? false;
  const weaponConfiguration = options.weaponConfiguration ?? pool.options.weaponConfiguration;
  const equipmentIds = options.equipmentIds ?? pool.options.equipmentIds;

  if (bar.length < size.min) {
    issues.push({
      code: "size-below-min",
      message: `bar has ${bar.length} slots; minimum is ${size.min}`,
    });
  }
  if (bar.length > size.max) {
    issues.push({
      code: "size-above-max",
      message: `bar has ${bar.length} slots; maximum is ${size.max}`,
    });
  }

  const seen = new Set<string>();
  const groups = new Map<string, string>();

  for (const id of bar) {
    if (seen.has(id)) {
      issues.push({
        code: "duplicate-id",
        abilityId: id,
        message: `duplicate ability id ${id}`,
      });
      continue;
    }
    seen.add(id);

    const ability = pool.byId.get(id);
    if (!ability) {
      issues.push({
        code: "unknown-id",
        abilityId: id,
        message: `ability ${id} is not in the candidate pool`,
      });
      continue;
    }

    const asSpec = ability as AbilitySpec;

    if (ability.style !== undefined && ability.style !== pool.style) {
      issues.push({
        code: "style-mismatch",
        abilityId: id,
        message: `${id} is ${ability.style}; bar style is ${pool.style}`,
      });
    }
    if (ability.offGcd) {
      issues.push({
        code: "off-gcd",
        abilityId: id,
        message: `${id} is off-GCD and cannot sit on a Revolution bar`,
      });
    }
    if (ability.autoAttack) {
      issues.push({
        code: "auto-attack",
        abilityId: id,
        message: `${id} is an auto-attack and cannot sit on a Revolution bar`,
      });
    }
    const group = exclusiveKey(ability);
    if (group) {
      const prior = groups.get(group);
      if (prior && prior !== id) {
        issues.push({
          code: "replacement-group",
          abilityId: id,
          group,
          message: `${prior} and ${id} share replacement group ${group}`,
        });
      } else {
        groups.set(group, id);
      }
    }
    if (!meetsWeaponRequirement(asSpec, weaponConfiguration)) {
      issues.push({
        code: "weapon-requirement",
        abilityId: id,
        message: `${id} does not meet weapon requirement under ${weaponConfiguration ?? "any"}`,
      });
    }
    if (!meetsEquipmentRequirement(asSpec, equipmentIds)) {
      issues.push({
        code: "equipment-requirement",
        abilityId: id,
        message: `${id} requires equipment not present in the loadout`,
      });
    }
    if (!includePartial) {
      const support = supportIssue(ability);
      if (support) issues.push(support);
    }
  }

  return issues;
}

export function isBarEligible(
  bar: readonly string[],
  pool: CandidatePool,
  options?: EligibilityOptions,
): boolean {
  return validateBarEligibility(bar, pool, options).length === 0;
}
