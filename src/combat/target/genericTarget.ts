import { damagePotential } from "../core/damagePotential";
import { applyEquipmentDamagePotential, type ActiveEquipmentEffects } from "../shared/equipment";
import { effectiveBaseArmourAtTick, type BlackStoneArmourState } from "../styles/ranged/blackStone";

/**
 * Generic-target accuracy model:
 *   f(x) = x³/1250 + 4x + 40
 *   player accuracy  = f(style level) + 2.5 × f(weapon tier)
 *   target armour    = armour stat + f(Defence level)
 *   hit chance       = affinity × accuracy / armour + additive modifiers, capped at 100%
 * Exact affinity is a percent (1-100). Named defaults are UI convenience only.
 */

/** Named defaults for UI convenience. Stored values are exact percents. */
export const DEFAULT_AFFINITIES = {
  weakness: 90,
  weak: 70,
  same: 60,
  strong: 50,
} as const;

/** Alias of DEFAULT_AFFINITIES for existing imports. */
export const AFFINITY = DEFAULT_AFFINITIES;

export type AffinityKind = keyof typeof DEFAULT_AFFINITIES;

export const AFFINITY_MIN = 1;
export const AFFINITY_MAX = 100;

export function isAffinityKind(value: unknown): value is AffinityKind {
  return value === "weak" || value === "same" || value === "strong" || value === "weakness";
}

/** Clamp a numeric affinity percent into the engine range. */
export function sanitizeAffinity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AFFINITIES.same;
  return Math.min(AFFINITY_MAX, Math.max(AFFINITY_MIN, Math.round(value)));
}

/**
 * Resolve an affinity percent from a number or legacy kind name.
 * Legacy kind strings migrate via DEFAULT_AFFINITIES; never invent values.
 */
export function resolveAffinityPercent(
  affinity: number | AffinityKind | undefined | null,
): number {
  if (affinity == null) return DEFAULT_AFFINITIES.same;
  if (typeof affinity === "number") return sanitizeAffinity(affinity);
  if (isAffinityKind(affinity)) return DEFAULT_AFFINITIES[affinity];
  return DEFAULT_AFFINITIES.same;
}

export interface GenericTarget {
  defenceLevel: number;
  /** The target's armour stat; defaults to 0 (armour = f(Defence) only). */
  armour?: number;
  /** Exact affinity percent (1-100). Defaults to 60 (same). */
  affinity?: number;
  /** Additive hit-chance modifiers from gear/effects, as a fraction (0.02 = +2%). */
  additiveHitChance?: number;
  /** Bypasses the formula entirely - the documented escape hatch. */
  damagePotentialOverride?: number;
  /** Current HP fraction 0-100; drives below-threshold effects (Punish). */
  hpPercent?: number;
  /** Explicitly declared applicable weakness; never inferred from the target name. */
  hasApplicableWeakness?: boolean;
  /** NPC size dimension used by size-scaled damage mechanics. */
  size?: number;
  /** Full target footprint used by area mechanics. */
  occupiedTiles?: number;
  vulnerability?: boolean;
  slayerCategory?: string;
  undead?: boolean;
  dragon?: boolean;
  demon?: boolean;
}

/** Host-resolved target facts used by land-time accuracy and Damage Potential. */
export interface ResolvedTargetAccuracyProfile {
  readonly playerAccuracyRating: number;
  readonly originalTargetArmourRating: number;
  /** Exact affinity percent (1-100) after Mark / scenario resolve. */
  readonly affinity: number;
  readonly additiveHitChance: number;
  readonly damagePotentialOverride?: number;
}

export interface LiveTargetDamagePotentialOptions {
  readonly blackStone?: {
    readonly state: BlackStoneArmourState;
    readonly currentTick: number;
  };
  readonly equipmentEffects?: ActiveEquipmentEffects;
}

/** f(x) = x³/1250 + 4x + 40 (Hit chance page). */
export function accuracyCurve(x: number): number {
  if (!Number.isFinite(x) || x < 0) throw new RangeError(`accuracyCurve: bad value ${x}`);
  return x ** 3 / 1250 + 4 * x + 40;
}

export function playerAccuracy(styleLevel: number, weaponTier: number): number {
  return Math.floor(accuracyCurve(styleLevel)) + Math.floor(2.5 * accuracyCurve(weaponTier));
}

export function targetArmour(target: GenericTarget): number {
  return Math.floor((target.armour ?? 0) + accuracyCurve(target.defenceLevel));
}

/** Hit chance as a fraction 0-1. Armour of 0 with 0 Defence is a wall-less target: full connect. */
export function hitChance(accuracy: number, target: GenericTarget): number {
  const armour = targetArmour(target);
  if (armour <= 0) return 1;
  const affinity = resolveAffinityPercent(target.affinity) / 100;
  return Math.min(1, Math.max(0, affinity * (accuracy / armour) + (target.additiveHitChance ?? 0)));
}

function hitChanceForArmour(
  accuracy: number,
  armour: number,
  affinityPercent: number,
  additiveHitChance: number,
): number {
  if (armour <= 0) return 1;
  return Math.min(
    1,
    Math.max(
      0,
      (resolveAffinityPercent(affinityPercent) / 100) * (accuracy / armour) + additiveHitChance,
    ),
  );
}

/** Damage Potential against this target; the override wins when set. */
export function targetDamagePotential(accuracy: number, target: GenericTarget): number {
  if (target.damagePotentialOverride != null)
    return damagePotential(target.damagePotentialOverride);
  return damagePotential(hitChance(accuracy, target));
}

/**
 * Live target Damage Potential before ammunition deltas. Armour changes affect
 * the formula path only; a manual override remains independent of armour.
 */
export function liveTargetDamagePotential(
  profile: ResolvedTargetAccuracyProfile,
  options: LiveTargetDamagePotentialOptions = {},
): number {
  const formulaDp =
    profile.damagePotentialOverride != null
      ? damagePotential(profile.damagePotentialOverride)
      : damagePotential(
          hitChanceForArmour(
            profile.playerAccuracyRating,
            options.blackStone
              ? effectiveBaseArmourAtTick(options.blackStone.state, options.blackStone.currentTick)
              : profile.originalTargetArmourRating,
            profile.affinity,
            profile.additiveHitChance,
          ),
        );
  return options.equipmentEffects
    ? applyEquipmentDamagePotential(formulaDp, options.equipmentEffects)
    : formulaDp;
}
