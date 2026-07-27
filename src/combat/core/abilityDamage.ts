import { damagePerLevel } from "./damagePerLevel";
import { percentFloor } from "./rounding";

/**
 * Ability damage as percent-of-base bands. The engine consumes bands; the base ability
 * damage itself is composed by baseAbilityDamage below from level + weapon tiers, per
 * docs/combat-changelog.md §1.2 (pre-2026 form) with the 2 Mar 2026 DPL replacement (§5.1).
 */
export interface DamageBand {
  minPct: number;
  maxPct: number;
}

export interface BandResult {
  min: number;
  max: number;
  /** Uniform-band mean, pending RS Analysis fixture validation of the in-band shape. */
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
 * Base ability damage composition (current game, all four styles).
 *
 *   main-hand:  floor(DPL(level)) + floor(9.6 × tier + styleBonus)
 *   off-hand:   floor(main-hand / 2)                     (dual wield totals MH + OH)
 *   two-handed melee/ranged: MH + floor(4.8 × tier + 0.5 × styleBonus)
 *   two-handed magic: floor(DPL(level)) + floor(1.25 × level) + floor(14.4 × tier + 1.5 × styleBonus)
 *
 * Sources: docs/combat-changelog.md §1.2 (Ability damage, rev. 30 Dec 2023) with §5.1
 * (2 Mar 2026: the linear 2.5×level term becomes DPL in every formula; weapon-tier
 * terms 9.6 / 14.4 / halved OH unchanged). The magic 2H floor(1.25×level) second level
 * term is retained from §1.2 — §5.1 names only the 2.5×level term as replaced; derived,
 * not verbatim, so it is covered by RS Analysis fixtures before reliance.
 *
 * `tierCap` applies the documented spell-tier (magic) and ammo-tier (ranged) caps to the
 * weapon-tier term. ponytail: the Ability damage page also caps the weapon term by
 * wielder level (min(tier, level)) — the introduction date is UNVERIFIED (changelog §10),
 * so it is not modelled; add it once a source lands.
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
