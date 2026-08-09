import type { AbilityHit, AbilitySpec } from "../pipeline/calculateAbility";
import { isBasicAttack } from "./adrenalineGain";

/** Style-extra keys read via index when present on Melee/Magic/Necro specs. */
const STYLE_EXTRA_KEYS = [
  "bloodlustGain",
  "bloodlustScale",
  "bloodlustExtraHits",
  "bloodlustMissingHp",
  "derivedHits",
  "necrosisGain",
  "soulGain",
  "soulCost",
  "soulChance",
  "critChanceBonusPct",
  "critDamageBonus",
  "channelled",
  "enables",
  "recastOf",
] as const;

function hitFingerprint(hit: AbilityHit): unknown {
  return {
    min: hit.band.minPct,
    max: hit.band.maxPct,
    tickOffset: hit.tickOffset ?? null,
    critEligible: hit.critEligible ?? null,
    dot: hit.dot ?? null,
    dotKind: hit.dotKind ?? null,
    bleedId: hit.bleedId ?? null,
  };
}

function sortedCopy(values: readonly string[] | undefined): string[] {
  return values ? [...values].sort() : [];
}

/**
 * Stable behavior identity for an AbilitySpec (not including id).
 * Used by runtime mapAbilitiesById to accept identical re-registration and
 * reject same-id conflicts that differ in mechanical fields.
 */
export function abilityBehaviorFingerprint(spec: AbilitySpec): string {
  const extra = spec as AbilitySpec & Record<string, unknown>;
  const styleExtras: Record<string, unknown> = {};
  for (const key of STYLE_EXTRA_KEYS) {
    if (key in extra && extra[key] !== undefined) {
      styleExtras[key] = extra[key];
    }
  }
  return JSON.stringify({
    style: spec.style,
    category: spec.category,
    name: spec.name,
    hits: (spec.hits ?? []).map(hitFingerprint),
    adrenalineGain: spec.adrenaline?.gain ?? null,
    adrenalineCost: spec.adrenaline?.cost ?? null,
    weaponSpecial: spec.weaponSpecial ?? null,
    requiresSpecialAccess: spec.requiresSpecialAccess ?? null,
    essenceCorruptionEligible: spec.essenceCorruptionEligible ?? null,
    essenceCorruptionMagicHitEligible: spec.essenceCorruptionMagicHitEligible ?? null,
    songAffectedDot: spec.songAffectedDot ?? null,
    minimumAutomaticRecastTicks: spec.minimumAutomaticRecastTicks ?? null,
    cooldownSeconds: spec.cooldownSeconds ?? null,
    channelTicks: spec.channelTicks ?? null,
    replacementGroup: spec.replacementGroup ?? null,
    cooldownGroup: spec.cooldownGroup ?? null,
    charges: spec.charges
      ? { max: spec.charges.max, secondChargeLevel: spec.charges.secondChargeLevel ?? null }
      : null,
    weaponRequirement: spec.weaponRequirement ?? null,
    requiredEquipmentAnyOf: sortedCopy(spec.requiredEquipmentAnyOf),
    requiredPassiveAnyOf: sortedCopy(spec.requiredPassiveAnyOf as readonly string[] | undefined),
    stateEffect: spec.stateEffect ?? null,
    appliesEffect: spec.appliesEffect ?? null,
    guaranteedCrit: spec.guaranteedCrit ?? null,
    area: spec.area ?? null,
    offGcd: spec.offGcd ?? null,
    basicAttack: isBasicAttack(spec),
    supportStatus: spec.supportStatus ?? null,
    bleedDurationExtension: spec.bleedDurationExtension ?? null,
    styleExtras,
  });
}
