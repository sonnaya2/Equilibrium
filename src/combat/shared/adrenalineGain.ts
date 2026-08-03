/**
 * Shared listed adrenaline generation for basics / autos.
 * Order matches the cast path: listed + FotS flat, then Invigorating, then AJ mult.
 * Impatient (+3 on proc) and Relentless stay outside this helper (RNG).
 */

export function isAdrenalineGeneratingBasic(ability: {
  category?: string;
  autoAttack?: boolean;
  adrenaline?: { gain?: number };
}): boolean {
  const gain = ability.adrenaline?.gain;
  if (!(typeof gain === "number" && gain > 0)) return false;
  return ability.category === "basic" || !!ability.autoAttack;
}

export interface AdrenalineGainRules {
  /** Fury of the Small: +1 on generating basics (before Invigorating). */
  basicAdrenalineFlatBonus?: number;
  /** Invigorating multiplier on basics (default 1). */
  basicGainMultiplier?: number;
  /** Ability generation mult (Adrenaline Junkie etc., default 1). */
  abilityGainMultiplier?: number;
}

/**
 * Expected adren gain from the ability's listed generation, with loadout rules.
 * Does not include Impatient RNG or spend/cost.
 */
export function resolveAbilityAdrenalineGain(
  ability: {
    category?: string;
    autoAttack?: boolean;
    adrenaline?: { gain?: number };
  },
  rules?: AdrenalineGainRules,
  opts?: { meteorBasicMultiplier?: number },
): number {
  const listed = ability.adrenaline?.gain;
  if (!(typeof listed === "number" && listed > 0)) return 0;
  let gain = listed;
  const isBasic = ability.category === "basic" || !!ability.autoAttack;
  if (isBasic) gain += rules?.basicAdrenalineFlatBonus ?? 0;
  if (opts?.meteorBasicMultiplier != null && opts.meteorBasicMultiplier !== 1) {
    gain *= opts.meteorBasicMultiplier;
  }
  if (isBasic) gain *= rules?.basicGainMultiplier ?? 1;
  gain *= rules?.abilityGainMultiplier ?? 1;
  return gain;
}
