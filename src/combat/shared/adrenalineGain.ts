/**
 * Listed adrenaline generation for Basic abilities and Basic Attacks.
 * Order: listed + FotS + Deathmark + Impatient, then Invigorating (basic attacks only), then AJ mult.
 * https://runescape.wiki/w/Invigorating
 * https://runescape.wiki/w/Basic_attacks
 * https://runescape.wiki/w/Fury_of_the_Small
 * https://runescape.wiki/w/Impatient
 */

import { IMPATIENT_EXTRA_ADRENALINE } from "./perks";

export type AbilityAdrenalineShape = {
  /** Engine ability id; failsafe when basicAttack flag is stripped. */
  id?: string;
  category?: string;
  basicAttack?: boolean;
  /** @deprecated Legacy metadata; not a post-modernisation Basic Attack. */
  autoAttack?: boolean;
  adrenaline?: { gain?: number };
};

/** Post-modernisation style Basic Attack engine ids. */
export const BASIC_ATTACK_ABILITY_IDS: ReadonlySet<string> = new Set([
  "attack",
  "ranged_attack",
  "magic_attack",
  "necromancy_basic",
]);

/**
 * The four style Basic Attacks. Invigorating uses this gate.
 * Prefer the explicit flag; fall back to known engine ids when a thin catalogue
 * drops basicAttack. Legacy autoAttack alone is never enough.
 */
export function isBasicAttack(ability: AbilityAdrenalineShape): boolean {
  if (ability.basicAttack === true) return true;
  if (ability.basicAttack === false) return false;
  if (ability.autoAttack === true) return false;
  if (ability.id != null && BASIC_ATTACK_ABILITY_IDS.has(ability.id)) return true;
  return false;
}

/**
 * Striking Light / Light of Saradomin host gate: any ability tagged category basic
 * (Slice, Wrack, Sonic, etc.) plus the four modern Basic Attacks.
 * Context uses abilityCategory; AbilitySpec uses category.
 */
export function isStrikingLightHost(
  ability: AbilityAdrenalineShape & {
    category?: string;
    abilityCategory?: string;
  },
): boolean {
  if (isBasicAttack(ability)) return true;
  const cat = ability.category ?? ability.abilityCategory;
  return cat === "basic";
}

/** Basic-category ability with listed gain > 0. */
export function isGeneratingBasicAbility(ability: AbilityAdrenalineShape): boolean {
  const gain = ability.adrenaline?.gain;
  if (!(typeof gain === "number" && gain > 0)) return false;
  return ability.category === "basic";
}

export interface AdrenalineGainRules {
  /** Fury of the Small: +1 on generating basics (before Invigorating). */
  basicAdrenalineFlatBonus?: number;
  /** Invigorating multiplier on basic attacks only (default 1). */
  basicGainMultiplier?: number;
  /** Ability generation mult (Adrenaline Junkie etc., default 1). */
  abilityGainMultiplier?: number;
}

export interface AbilityAdrenalineGainBreakdown {
  listedGain: number;
  furyOfTheSmallGain: number;
  boltDeathmarkGain: number;
  impatientGain: number;
  /** listed + FotS + Deathmark + Impatient, then Meteor mult if any. */
  gainBeforeInvigorating: number;
  invigoratingMultiplier: number;
  gainAfterInvigorating: number;
  abilityGainMultiplier: number;
  totalAbilityGain: number;
}

export interface AbilityAdrenalineGainInput {
  listedGain: number;
  isGeneratingBasicAbility: boolean;
  isBasicAttack: boolean;
  /** Already resolved; no RNG here. */
  impatientProc?: boolean;
  basicAdrenalineFlatBonus?: number;
  boltDeathmarkFlatBonus?: number;
  basicGainMultiplier?: number;
  abilityGainMultiplier?: number;
  /** Meteor Strike basic mult; applied after flats, before Invigorating. */
  meteorBasicMultiplier?: number;
}

/**
 * Pure ability-generation ledger (no spend/refunds).
 * Impatient is inside Invigorating when isBasicAttack.
 */
export function resolveAbilityAdrenalineGainBreakdown(
  input: AbilityAdrenalineGainInput,
): AbilityAdrenalineGainBreakdown {
  const listedGain =
    typeof input.listedGain === "number" && input.listedGain > 0 ? input.listedGain : 0;
  if (listedGain <= 0) {
    return {
      listedGain: 0,
      furyOfTheSmallGain: 0,
      boltDeathmarkGain: 0,
      impatientGain: 0,
      gainBeforeInvigorating: 0,
      invigoratingMultiplier: 1,
      gainAfterInvigorating: 0,
      abilityGainMultiplier: input.abilityGainMultiplier ?? 1,
      totalAbilityGain: 0,
    };
  }

  const generating = input.isGeneratingBasicAbility;
  const furyOfTheSmallGain =
    generating && (input.basicAdrenalineFlatBonus ?? 0) > 0 ? input.basicAdrenalineFlatBonus! : 0;
  const boltDeathmarkGain =
    generating && (input.boltDeathmarkFlatBonus ?? 0) > 0 ? input.boltDeathmarkFlatBonus! : 0;
  const impatientGain = generating && input.impatientProc === true ? IMPATIENT_EXTRA_ADRENALINE : 0;

  const flats = listedGain + furyOfTheSmallGain + boltDeathmarkGain + impatientGain;
  const meteor =
    input.meteorBasicMultiplier != null && input.meteorBasicMultiplier !== 1
      ? input.meteorBasicMultiplier
      : 1;
  const gainBeforeInvigorating = flats * meteor;

  const invigoratingMultiplier = input.isBasicAttack ? (input.basicGainMultiplier ?? 1) : 1;

  const gainAfterInvigorating = gainBeforeInvigorating * invigoratingMultiplier;
  const abilityGainMultiplier = input.abilityGainMultiplier ?? 1;
  const totalAbilityGain = gainAfterInvigorating * abilityGainMultiplier;

  return {
    listedGain,
    furyOfTheSmallGain,
    boltDeathmarkGain,
    impatientGain,
    gainBeforeInvigorating,
    invigoratingMultiplier,
    gainAfterInvigorating,
    abilityGainMultiplier,
    totalAbilityGain,
  };
}

/**
 * Expected adren gain from listed generation + loadout rules.
 * No Impatient RNG; same gain rules as the transaction without impatientProc.
 */
export function resolveAbilityAdrenalineGain(
  ability: AbilityAdrenalineShape,
  rules?: AdrenalineGainRules,
  opts?: { meteorBasicMultiplier?: number },
): number {
  const listed = ability.adrenaline?.gain;
  if (!(typeof listed === "number" && listed > 0)) return 0;
  return resolveAbilityAdrenalineGainBreakdown({
    listedGain: listed,
    isGeneratingBasicAbility: isGeneratingBasicAbility(ability),
    isBasicAttack: isBasicAttack(ability),
    impatientProc: false,
    basicAdrenalineFlatBonus: rules?.basicAdrenalineFlatBonus,
    basicGainMultiplier: rules?.basicGainMultiplier,
    abilityGainMultiplier: rules?.abilityGainMultiplier,
    meteorBasicMultiplier: opts?.meteorBasicMultiplier,
  }).totalAbilityGain;
}
