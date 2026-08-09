import type { TargetAffinityProfile, TargetPresetRecord } from "../data/records";
import type { CombatStyle } from "../types";
import { attackRateTicksToIntervalSeconds } from "./attackRate";
import { resolveAffinityPercent, sanitizeAffinity } from "./genericTarget";

export interface MaterializedTargetFields {
  defenceLevel: number;
  armour: number;
  affinity: number;
  /** Exact weakness affinity when sourced; used by Demon's Mark. */
  weaknessAffinity?: number;
  size?: number;
  maximumLifePoints?: number;
  poisonImmune?: boolean;
  undead?: boolean;
  demon?: boolean;
  dragon?: boolean;
  /**
   * Derived from wiki attackRateTicks (ticks * 0.6s). Seeds Barkscales/Icyenic
   * scenario only; not part of Modified defence/affinity comparison.
   */
  incomingHitIntervalSeconds?: number;
  /** Sourced wiki ticks when present; for UI rate labels. */
  attackRateTicks?: number;
}

export interface MaterializeTargetPresetOptions {
  /** Player combat style for style affinity selection. */
  style: CombatStyle;
}

/** Middle of three style affinities for Necromancy (no Wiki necro column). */
export function necromancyAffinityFromProfile(profile: TargetAffinityProfile): number {
  const values = [profile.melee, profile.ranged, profile.magic]
    .map((v) => sanitizeAffinity(v))
    .sort((a, b) => a - b);
  return values[1]!;
}

/** Resolve one affinity percent from a style profile. */
export function affinityForStyle(
  profile: TargetAffinityProfile,
  style: CombatStyle,
): number {
  if (style === "necromancy") return necromancyAffinityFromProfile(profile);
  if (style === "melee") return sanitizeAffinity(profile.melee);
  if (style === "ranged") return sanitizeAffinity(profile.ranged);
  return sanitizeAffinity(profile.magic);
}

/**
 * Materialize a supported/provisional preset into loadout target fields.
 * Returns null when the preset cannot supply Defence or style affinities.
 */
export function materializeTargetPreset(
  preset: TargetPresetRecord,
  options: MaterializeTargetPresetOptions,
): MaterializedTargetFields | null {
  if (preset.support === "unsupported") return null;
  const defenceLevel = preset.stats.defenceLevel;
  if (defenceLevel == null || !Number.isFinite(defenceLevel) || defenceLevel < 0) {
    return null;
  }
  const profile = preset.stats.affinities;
  if (!profile) return null;
  const armour =
    preset.stats.armour != null && Number.isFinite(preset.stats.armour) && preset.stats.armour >= 0
      ? preset.stats.armour
      : 0;
  const affinity = affinityForStyle(profile, options.style);
  const fields: MaterializedTargetFields = {
    defenceLevel,
    armour,
    affinity,
  };
  if (profile.weakness != null) {
    fields.weaknessAffinity = resolveAffinityPercent(profile.weakness);
  }
  if (preset.stats.size != null && preset.stats.size >= 1) {
    fields.size = Math.floor(preset.stats.size);
  }
  if (preset.stats.lifePoints != null && preset.stats.lifePoints > 0) {
    fields.maximumLifePoints = Math.floor(preset.stats.lifePoints);
  }
  if (preset.stats.poisonImmune === true) fields.poisonImmune = true;
  if (preset.stats.undead === true) fields.undead = true;
  if (preset.stats.demon === true) fields.demon = true;
  if (preset.stats.dragon === true) fields.dragon = true;
  const interval = attackRateTicksToIntervalSeconds(preset.stats.attackRateTicks);
  if (interval != null) {
    fields.incomingHitIntervalSeconds = interval;
    fields.attackRateTicks = Math.floor(preset.stats.attackRateTicks!);
  }
  return fields;
}

/** Compare materialized preset values against a live target for Modified detection. */
export function targetDiffersFromPreset(
  target: {
    defenceLevel: number;
    armour?: number;
    affinity: number;
    size?: number;
    maximumLifePoints?: number;
    poisonImmune?: boolean;
    undead?: boolean;
    demon?: boolean;
    dragon?: boolean;
  },
  materialized: MaterializedTargetFields,
): boolean {
  if (target.defenceLevel !== materialized.defenceLevel) return true;
  if ((target.armour ?? 0) !== materialized.armour) return true;
  if (target.affinity !== materialized.affinity) return true;
  if ((target.size ?? 1) !== (materialized.size ?? 1)) return true;
  if ((target.maximumLifePoints ?? null) !== (materialized.maximumLifePoints ?? null)) return true;
  if ((target.poisonImmune === true) !== (materialized.poisonImmune === true)) return true;
  if ((target.undead === true) !== (materialized.undead === true)) return true;
  if ((target.demon === true) !== (materialized.demon === true)) return true;
  if ((target.dragon === true) !== (materialized.dragon === true)) return true;
  return false;
}
