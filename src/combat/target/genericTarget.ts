import { damagePotential } from "../core/damagePotential";

/**
 * Generic-target accuracy model:
 *   f(x) = x³/1250 + 4x + 40
 *   player accuracy  = f(style level) + 2.5 × f(weapon tier)
 *   target armour    = armour stat + f(Defence level)
 *   hit chance       = affinity × accuracy / armour + additive modifiers, capped at 100%
 * Default affinities are Weak 70, Same 60, Strong 50, and specific weakness 90.
 */

export const AFFINITY = {
  weak: 70,
  same: 60,
  strong: 50,
  weakness: 90,
} as const;

export type AffinityKind = keyof typeof AFFINITY;

export interface GenericTarget {
  defenceLevel: number;
  /** The target's armour stat; defaults to 0 (armour = f(Defence) only). */
  armour?: number;
  /** Defaults to "same". */
  affinity?: AffinityKind;
  /** Additive hit-chance modifiers from gear/effects, as a fraction (0.02 = +2%). */
  additiveHitChance?: number;
  /** Bypasses the formula entirely — the documented escape hatch. */
  damagePotentialOverride?: number;
  /** Current HP fraction 0–100; drives below-threshold effects (Punish). */
  hpPercent?: number;
  /** Explicitly declared applicable weakness; never inferred from the target name. */
  hasApplicableWeakness?: boolean;
  /** Full target footprint used by area mechanics. */
  occupiedTiles?: number;
  vulnerability?: boolean;
  poisonable?: boolean;
  slayerCategory?: string;
  undead?: boolean;
  dragon?: boolean;
  demon?: boolean;
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

/** Hit chance as a fraction 0–1. Armour of 0 with 0 Defence is a wall-less target: full connect. */
export function hitChance(accuracy: number, target: GenericTarget): number {
  const armour = targetArmour(target);
  if (armour <= 0) return 1;
  const affinity = AFFINITY[target.affinity ?? "same"] / 100;
  return Math.min(1, Math.max(0, affinity * (accuracy / armour) + (target.additiveHitChance ?? 0)));
}

/** Damage Potential against this target; the override wins when set. */
export function targetDamagePotential(accuracy: number, target: GenericTarget): number {
  if (target.damagePotentialOverride != null)
    return damagePotential(target.damagePotentialOverride);
  return damagePotential(hitChance(accuracy, target));
}
