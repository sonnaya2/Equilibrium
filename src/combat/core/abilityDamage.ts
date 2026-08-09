import { damagePerLevel } from "./damagePerLevel";
import { percentFloor } from "./rounding";

export interface DamageBand {
  minPct: number;
  maxPct: number;
}

export interface BandResult {
  min: number;
  max: number;
  /** Mean of the inclusive uniform integer roll from min through max. */
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

export interface WeaponProfile {
  tier: number;
}

export type WeaponConfiguration =
  | {
      kind: "mainhand";
      style: "melee" | "ranged" | "magic";
      weapon: WeaponProfile;
      offhand?: WeaponProfile;
      styleBonus?: number;
      ammunitionTier?: number;
      rangedAmmunitionState?: "self-generated" | "external" | "missing-required";
      spellTier?: number;
    }
  | {
      kind: "twohand";
      style: "melee" | "ranged" | "magic";
      weapon: WeaponProfile;
      styleBonus?: number;
      ammunitionTier?: number;
      rangedAmmunitionState?: "self-generated" | "external" | "missing-required";
      spellTier?: number;
    }
  | {
      kind: "necromancy";
      deathGuard: WeaponProfile;
      conduit?: WeaponProfile;
      styleBonus?: number;
    };

function validateTier(tier: number, label: string): number {
  if (!Number.isFinite(tier) || tier < 0)
    throw new RangeError(`baseAbilityDamage: bad ${label} ${tier}`);
  return tier;
}

function cappedTier(
  level: number,
  config: Exclude<WeaponConfiguration, { kind: "necromancy" }>,
  tier: number,
): number {
  const cap =
    config.style === "melee"
      ? level
      : config.style === "ranged"
        ? config.ammunitionTier
        : config.spellTier;
  return cap == null ? tier : Math.min(tier, validateTier(cap, "style tier cap"));
}

function mainHand(level: number, tier: number, styleBonus: number): number {
  return Math.floor(damagePerLevel(level)) + Math.floor(9.6 * tier + styleBonus);
}

/**
 * Current live ability-damage composition. Each displayed floor is a separate
 * game rounding boundary; style damage belongs inside the weapon-term floor.
 */
export function baseAbilityDamage(level: number, config: WeaponConfiguration): number {
  if (!Number.isFinite(level) || level < 1)
    throw new RangeError(`baseAbilityDamage: bad level ${level}`);
  const styleBonus = config.styleBonus ?? 0;
  if (!Number.isFinite(styleBonus))
    throw new RangeError(`baseAbilityDamage: bad style bonus ${styleBonus}`);

  if (config.kind === "necromancy") {
    const main = mainHand(
      level,
      validateTier(config.deathGuard.tier, "death guard tier"),
      styleBonus,
    );
    if (!config.conduit) return main;
    const conduitAsMain = mainHand(
      level,
      validateTier(config.conduit.tier, "conduit tier"),
      styleBonus,
    );
    return main + Math.floor(conduitAsMain / 2);
  }

  if (config.style === "ranged" && config.rangedAmmunitionState === "missing-required") {
    return 0;
  }

  const rawWeaponTier = validateTier(config.weapon.tier, "weapon tier");
  const weaponTier = cappedTier(level, config, rawWeaponTier);
  if (config.kind === "mainhand") {
    const main = mainHand(level, weaponTier, styleBonus);
    if (!config.offhand) return main;
    const offhandTier = cappedTier(
      level,
      config,
      validateTier(config.offhand.tier, "off-hand tier"),
    );
    return main + Math.floor(mainHand(level, offhandTier, styleBonus) / 2);
  }

  const levelTerms = Math.floor(damagePerLevel(level)) + Math.floor(damagePerLevel(level) / 2);
  if (config.style === "magic") {
    return levelTerms + Math.floor(14.4 * weaponTier + 1.5 * styleBonus);
  }
  const primaryTier =
    config.style === "ranged" && config.ammunitionTier === 0 ? rawWeaponTier : weaponTier;
  const secondaryTier = config.style === "melee" ? rawWeaponTier : weaponTier;
  return (
    levelTerms +
    Math.floor(9.6 * primaryTier + styleBonus) +
    Math.floor(4.8 * secondaryTier + 0.5 * styleBonus)
  );
}
