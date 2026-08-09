import { bandOf } from "@/combat/core/abilityDamage";
import { STANDARD_ATTACK_TICKS, TICK_SECONDS } from "@/combat/core/ticks";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";

/**
 * Rough ability expected damage: hit-band midpoints × base AD × Damage Potential.
 * Not full-sim (no crit layers, passives, or state). UI label: est. TTK.
 */
export function abilityExpectedDamage(
  baseAbilityDamage: number,
  ability: AbilitySpec,
  damagePotential: number,
): number {
  if (!Number.isFinite(baseAbilityDamage) || baseAbilityDamage <= 0) return 0;
  if (!Number.isFinite(damagePotential) || damagePotential <= 0) return 0;
  let raw = 0;
  for (const hit of ability.hits) {
    raw += bandOf(baseAbilityDamage, hit.band).expected;
  }
  return raw * damagePotential;
}

/** Cast cycle for rough TTK: ability cooldown, else channel, else standard attack. */
export function abilityCastCycleSeconds(ability: AbilitySpec): number {
  if (ability.cooldownSeconds != null && ability.cooldownSeconds > 0) {
    return ability.cooldownSeconds;
  }
  if (ability.channelTicks != null && ability.channelTicks > 0) {
    return ability.channelTicks * TICK_SECONDS;
  }
  return STANDARD_ATTACK_TICKS * TICK_SECONDS;
}

/**
 * Estimated time to kill if this ability alone were spammed at its cycle rate.
 * Null when LP or damage is missing/zero.
 */
export function abilityTtkSeconds(input: {
  expectedDamagePerCast: number;
  maximumLifePoints: number | null | undefined;
  cycleSeconds: number;
}): number | null {
  const lp = input.maximumLifePoints;
  if (lp == null || !Number.isFinite(lp) || lp <= 0) return null;
  if (!Number.isFinite(input.expectedDamagePerCast) || input.expectedDamagePerCast <= 0) {
    return null;
  }
  if (!Number.isFinite(input.cycleSeconds) || input.cycleSeconds <= 0) return null;
  const casts = Math.ceil(lp / input.expectedDamagePerCast);
  return casts * input.cycleSeconds;
}

export function formatTtkSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 10) {
    const tenths = Math.round(seconds * 10) / 10;
    return Number.isInteger(tenths) ? `${tenths}s` : `${tenths.toFixed(1)}s`;
  }
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}:${String(rem).padStart(2, "0")}`;
}

export function abilityTtkLabel(
  baseAbilityDamage: number,
  ability: AbilitySpec,
  damagePotential: number,
  maximumLifePoints: number | null | undefined,
): string {
  const expected = abilityExpectedDamage(baseAbilityDamage, ability, damagePotential);
  const cycle = abilityCastCycleSeconds(ability);
  return formatTtkSeconds(
    abilityTtkSeconds({
      expectedDamagePerCast: expected,
      maximumLifePoints,
      cycleSeconds: cycle,
    }),
  );
}

/**
 * Bar-run TTK from sim DPS and target LP: LP / dps.
 * Null when LP or dps missing/zero.
 */
export function runTtkSeconds(
  maximumLifePoints: number | null | undefined,
  dps: number | null | undefined,
): number | null {
  const lp = maximumLifePoints;
  if (lp == null || !Number.isFinite(lp) || lp <= 0) return null;
  if (dps == null || !Number.isFinite(dps) || dps <= 0) return null;
  return lp / dps;
}

/** Kills per hour from TTK seconds. */
export function killsPerHour(ttkSeconds: number | null | undefined): number | null {
  if (ttkSeconds == null || !Number.isFinite(ttkSeconds) || ttkSeconds <= 0) return null;
  return 3600 / ttkSeconds;
}

export function formatKph(kph: number | null | undefined): string {
  if (kph == null || !Number.isFinite(kph) || kph <= 0) return "—";
  if (kph >= 100) return String(Math.round(kph));
  if (kph >= 10) return (Math.round(kph * 10) / 10).toFixed(1);
  return (Math.round(kph * 100) / 100).toFixed(2);
}
