import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { ItemPassiveId } from "../data/records";
import type { ActiveWeaponCapability } from "../shared/equipment";
import { resolveAbilityCastAvailability } from "../shared/requirements";
import { EvalCache } from "./cache";
import type {
  BarSizeBounds,
  CandidatePool,
  ExclusionReason,
  PoolAbility,
  SizeBounds,
} from "./contracts";

export type { BarSizeBounds, ExclusionReason, SizeBounds } from "./contracts";

/**
 * Session-scoped eligibility LRU. Bound to one CandidatePool + resolved option
 * slice for a single solve; never process-global / cross-request.
 */
export interface EligibilityMemo {
  readonly pool: CandidatePool;
  /** Fingerprint of resolved options used when the memo was created. */
  readonly optionKey: string;
  readonly cache: EvalCache<ExclusionReason[]>;
}

export interface EligibilityOptions {
  includePartial?: boolean;
  size?: BarSizeBounds;
  weaponConfiguration?: CandidatePool["options"]["weaponConfiguration"];
  equipmentIds?: readonly string[];
  activeWeapon?: ActiveWeaponCapability;
  passiveIds?: readonly string[];
  eofStoredSpecialId?: string | null;
  league?: CandidatePool["options"]["league"];
  /**
   * Optional per-solve memo. Only used when `memo.pool === pool` and the call's
   * resolved options match `memo.optionKey`; otherwise validation runs uncached.
   */
  memo?: EligibilityMemo;
  /**
   * Incumbent baseline: ids missing from the generation pool resolve via this map
   * (catalogue / forceSolver:false abilities still legal to simulate).
   */
  outsidePoolById?: ReadonlyMap<string, PoolAbility | AbilitySpec>;
  /** Skip min/max size band (host/incumbent full-eval of the user's actual bar). */
  skipSizeBounds?: boolean;
}

const DEFAULT_SIZE: SizeBounds = { min: 1, max: 10 };
const DEFAULT_MEMO_ENTRIES = 2_048;

export function normalizeSizeBounds(size?: BarSizeBounds): SizeBounds {
  if (!size) return DEFAULT_SIZE;
  if ("min" in size && "max" in size) return { min: size.min, max: size.max };
  return { min: size.minSlots, max: size.maxSlots };
}

/** Resolved option fingerprint; must match validateBarEligibility's defaults. */
export function eligibilityOptionKey(
  pool: CandidatePool,
  options: EligibilityOptions = {},
): string {
  const size = normalizeSizeBounds(options.size);
  const includePartial = options.includePartial ?? pool.options.includePartial ?? false;
  const weaponConfiguration = options.weaponConfiguration ?? pool.options.weaponConfiguration;
  const equipmentIds = options.equipmentIds ?? pool.options.equipmentIds;
  const passiveIds = options.passiveIds ?? pool.options.passiveIds;
  const activeWeapon = options.activeWeapon ?? pool.options.activeWeapon;
  const eofStoredSpecialId =
    options.eofStoredSpecialId !== undefined
      ? options.eofStoredSpecialId
      : pool.options.eofStoredSpecialId;
  const activeWeaponKey = activeWeapon
    ? [
        activeWeapon.id,
        activeWeapon.slot,
        activeWeapon.style,
        activeWeapon.specialAttackId,
        [...activeWeapon.passiveIds].sort().join(","),
      ].join(":")
    : "";
  return [
    pool.style,
    String(size.min),
    String(size.max),
    includePartial ? "1" : "0",
    weaponConfiguration ?? "",
    equipmentIds?.join(",") ?? "",
    activeWeaponKey,
    eofStoredSpecialId ?? "",
    passiveIds?.join(",") ?? "",
    options.league?.ruleset ?? pool.options.league?.ruleset ?? "",
    [...(options.league?.blessingIds ?? pool.options.league?.blessingIds ?? [])]
      .map(String)
      .sort()
      .join(","),
  ].join("|");
}

/**
 * Create a small LRU for one solve session (one pool + fixed eligibility options).
 * Not safe to reuse across pools or option changes.
 */
export function createEligibilityMemo(
  pool: CandidatePool,
  options: EligibilityOptions = {},
  maxEntries: number = DEFAULT_MEMO_ENTRIES,
): EligibilityMemo {
  return {
    pool,
    optionKey: eligibilityOptionKey(pool, options),
    cache: new EvalCache(maxEntries),
  };
}

function barMemoKey(bar: readonly string[]): string {
  return bar.join("\0");
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

function validateBarEligibilityUncached(
  bar: readonly string[],
  pool: CandidatePool,
  options: EligibilityOptions,
): ExclusionReason[] {
  const issues: ExclusionReason[] = [];
  const size = normalizeSizeBounds(options.size);
  const includePartial = options.includePartial ?? pool.options.includePartial ?? false;
  const weaponConfiguration = options.weaponConfiguration ?? pool.options.weaponConfiguration;
  const equipmentIds = options.equipmentIds ?? pool.options.equipmentIds;
  const passiveIds = options.passiveIds ?? pool.options.passiveIds;
  const activeWeapon = options.activeWeapon ?? pool.options.activeWeapon;
  const eofStoredSpecialId =
    options.eofStoredSpecialId !== undefined
      ? options.eofStoredSpecialId
      : pool.options.eofStoredSpecialId;
  const league = options.league ?? pool.options.league;

  if (!options.skipSizeBounds) {
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

    const ability = pool.byId.get(id) ?? options.outsidePoolById?.get(id);
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
    const peers =
      ability.replacementGroup === undefined
        ? []
        : [...pool.byId.values()].filter(
            (peer) => peer.replacementGroup === ability.replacementGroup,
          );
    const availability = resolveAbilityCastAvailability(asSpec, {
      weaponConfiguration,
      equipmentIds,
      activeWeapon,
      eofStoredSpecialId,
      passiveIds: passiveIds as readonly ItemPassiveId[] | undefined,
      league,
      groupPeers: peers.map((peer) => ({
        id: peer.id,
        name: peer.name ?? peer.id,
        replacementGroup: peer.replacementGroup,
        requiredPassiveAnyOf: peer.requiredPassiveAnyOf as readonly ItemPassiveId[] | undefined,
      })),
    });
    if (!availability.available) {
      const code =
        availability.reason === "weapon-requirement"
          ? "weapon-requirement"
          : availability.reason === "league-restriction"
            ? "league-restriction"
            : availability.reason === "missing-equipment" ||
                availability.reason === "missing-passive" ||
                availability.reason === "superseded"
              ? "equipment-requirement"
              : "equipment-requirement";
      issues.push({
        code,
        abilityId: id,
        message: availability.message,
      });
    }
    if (!includePartial) {
      const support = supportIssue(ability);
      if (support) issues.push(support);
    }
  }

  return issues;
}

/**
 * Static Revolution-bar validation. Does not simulate - uniqueness, size,
 * style, weapon/equipment, support status, off-GCD, and replacement groups.
 *
 * Pure w.r.t. (bar, pool, options). Optional session memo keys by bar fingerprint
 * only when pool identity + resolved option key match the memo binding.
 */
export function validateBarEligibility(
  bar: readonly string[],
  pool: CandidatePool,
  options: EligibilityOptions = {},
): ExclusionReason[] {
  const memo = options.memo;
  if (memo && memo.pool === pool) {
    const optionKey = eligibilityOptionKey(pool, options);
    if (optionKey === memo.optionKey) {
      const key = barMemoKey(bar);
      const hit = memo.cache.get(key);
      if (hit) return hit;
      const issues = validateBarEligibilityUncached(bar, pool, options);
      memo.cache.set(key, issues);
      return issues;
    }
  }
  return validateBarEligibilityUncached(bar, pool, options);
}

export function isBarEligible(
  bar: readonly string[],
  pool: CandidatePool,
  options?: EligibilityOptions,
): boolean {
  return validateBarEligibility(bar, pool, options).length === 0;
}
