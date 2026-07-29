import { damagePerLevel } from "./damagePerLevel";
import { percentFloor } from "./rounding";

export interface DamageBand {
  minPct: number;
  maxPct: number;
}

export interface BandResult {
  min: number;
  max: number;
  /** Uniform-band arithmetic mean. */
  expected: number;
}

export function bandOf(base: number, band: DamageBand): BandResult {
  if (base < 0 || !Number.isFinite(base)) throw new RangeError(`bandOf: bad base ${base}`);
  if (band.minPct > band.maxPct)
    throw new RangeError(`bandOf: inverted band ${band.minPct}-${band.maxPct}`);
  const min = percentFloor(base, band.minPct);
  const max = percentFloor(base, band.maxPct);
  return { min, max, expected: (min + max) / 2 };
}

/**
 * Current base ability damage formulas. Intermediate floors are part of the mechanic.
 *
 *   main-hand:  floor(DPL(level)) + floor(9.6 × tier + styleBonus)
 *   off-hand:   floor(main-hand / 2)                     (dual wield totals MH + OH)
 *   two-handed melee/ranged: MH + floor(4.8 × tier + 0.5 × styleBonus)
 *   two-handed magic: floor(DPL(level)) + floor(1.25 × level) + floor(14.4 × tier + 1.5 × styleBonus)
 *
 * `tierCap` applies spell-tier and ammo-tier caps to the weapon term. The
 * wielder-level cap is excluded because its start date is unverified.
 */
export interface WeaponProfile {
  tier: number;
  /** Spell-tier cap (magic) or ammo-tier cap (ranged) applied to the weapon term. */
  tierCap?: number;
  /** Gear damage bonus feeding the weapon term; defaults to 0. */
  styleBonus?: number;
}

function weaponTerm(profile: WeaponProfile, multiplier: number, bonusMultiplier: number): number {
  const tier = profile.tierCap != null ? Math.min(profile.tier, profile.tierCap) : profile.tier;
  return Math.floor(multiplier * tier + bonusMultiplier * (profile.styleBonus ?? 0));
}

function mainHandTerm(level: number, profile: WeaponProfile): number {
  return Math.floor(damagePerLevel(level)) + weaponTerm(profile, 9.6, 1);
}

export function baseAbilityDamage(
  level: number,
  hand:
    | { kind: "mainhand"; weapon: WeaponProfile; offhand?: WeaponProfile }
    | {
        kind: "twohand";
        weapon: WeaponProfile;
        style: "melee" | "ranged" | "magic" | "necromancy";
      },
): number {
  if (!Number.isFinite(level) || level < 1)
    throw new RangeError(`baseAbilityDamage: bad level ${level}`);
  if (hand.kind === "mainhand") {
    const mh = mainHandTerm(level, hand.weapon);
    if (!hand.offhand) return mh;
    return mh + Math.floor(mainHandTerm(level, hand.offhand) / 2);
  }
  if (hand.style === "magic") {
    return (
      Math.floor(damagePerLevel(level)) +
      Math.floor(1.25 * level) +
      weaponTerm(hand.weapon, 14.4, 1.5)
    );
  }
  return mainHandTerm(level, hand.weapon) + weaponTerm(hand.weapon, 4.8, 0.5);
}
