/**
 * Canonical simulation fingerprint for Rotation / Revolution result validity.
 * Covers every material SimulateInput / revolution input field.
 */
import { stableStringify } from "@/combat/solver/fingerprint";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { CalcStats } from "./loadoutStats";

export type ManualRunFingerprintParts = {
  mode: "manual";
  stats: CalcStats;
  queue: readonly string[];
  autoWeave: boolean;
  ammo: string;
  useBuild: boolean;
  targetHpPercent?: number;
  /** Manual damage line when useBuild is false. */
  manual?: {
    base: number;
    level: number;
    accuracy: number;
    critChance: number;
  };
};

export type RevolutionRunFingerprintParts = {
  mode: "revolution";
  stats: CalcStats;
  barIds: readonly string[];
  durationSeconds: number;
  style: string;
  targetHpPercent?: number;
};

export type UiRunFingerprintParts = ManualRunFingerprintParts | RevolutionRunFingerprintParts;

/** Minimal probe: castModifiersFor only reads id/category for Ultimatums/Lunging. */
function probeModIds(stats: CalcStats, id: string, category: AbilitySpec["category"]): string[] {
  return stats
    .castModifiersFor({ id, category } as AbilitySpec)
    .map((m) => m.id)
    .sort();
}

function statsCore(stats: CalcStats, targetHpPercent?: number): Record<string, unknown> {
  const a = stats.adrenaline;
  return {
    base: stats.base,
    level: stats.level,
    dp: stats.dp,
    critChance: stats.critChance,
    critsDisabled: stats.critsDisabled === true,
    critDamageBonus: stats.critDamageBonus ?? 0,
    startingAdrenaline: stats.startingAdrenaline,
    maxAdrenaline: stats.maxAdrenaline,
    cap: stats.cap,
    weaponConfiguration: stats.weaponConfiguration,
    equipmentIds: [...(stats.equipmentIds ?? [])].sort(),
    plantedFeet: stats.plantedFeet === true,
    strengthCape99: stats.strengthCape99 === true,
    preciseRank: stats.preciseRank ?? 0,
    conjureBasicDamageMult: stats.conjureBasicDamageMult ?? 1,
    conjureDurationMult: stats.conjureDurationMult ?? 1,
    tumekensPieces: stats.tumekensPieces ?? 0,
    tumekensCritEnabled: stats.tumekensCritEnabled === true,
    procs: stats.procs ?? null,
    targetHpPercent: targetHpPercent ?? null,
    adrenaline: a
      ? {
          abilityGainMultiplier: a.abilityGainMultiplier ?? 1,
          basicGainMultiplier: a.basicGainMultiplier ?? 1,
          basicAdrenalineFlatBonus: a.basicAdrenalineFlatBonus ?? 0,
          maxAdrenalineBonus: a.maxAdrenalineBonus ?? 0,
          conservationOfEnergyRefund: a.conservationOfEnergyRefund ?? 0,
          ringOfVigour: a.ringOfVigour === true,
          impatientRank: a.impatientRank ?? 0,
          impatientLevel20: a.impatientLevel20 === true,
          relentlessRank: a.relentlessRank ?? 0,
          relentlessLevel20: a.relentlessLevel20 === true,
        }
      : null,
    equipmentEffects: stats.equipmentEffects
      ? {
          vestments: stats.equipmentEffects.vestments,
          passiveIds: [...(stats.equipmentEffects.passiveIds ?? [])].sort(),
          amZiFlatDamage: stats.equipmentEffects.amZiFlatDamage,
          amHejDamageBonus: stats.equipmentEffects.amHejDamageBonus,
        }
      : null,
    league: stats.league
      ? {
          ruleset: stats.league.ruleset,
          blessingIds: [...(stats.league.blessingIds ?? [])].sort(),
          totalArmour: stats.league.totalArmour,
          maximumLife: stats.league.maximumLife,
          targetTiles: stats.league.targetTiles,
        }
      : null,
    combatContext: stats.combatContext ?? null,
    globalModIds: stats.globalModifiers.map((m) => m.id).sort(),
    // Ability-aware factory (Ultimatums / Lunging) - not on globalModifiers alone.
    ultimatumsProbe: probeModIds(stats, "overpower", "ultimate"),
    lungingProbe: probeModIds(stats, "dismember", "basic"),
  };
}

/**
 * Fingerprint of every input that changes a Rotation / Revolution result.
 * Cosmetic UI state (analysis open, cast expand) is intentionally excluded.
 */
export function uiRunFingerprint(parts: UiRunFingerprintParts): string {
  if (parts.mode === "manual") {
    return stableStringify({
      mode: "manual",
      core: statsCore(parts.stats, parts.targetHpPercent),
      queue: [...parts.queue],
      autoWeave: parts.autoWeave,
      ammo: parts.ammo,
      useBuild: parts.useBuild,
      manual: parts.useBuild ? null : (parts.manual ?? null),
    });
  }
  return stableStringify({
    mode: "revolution",
    core: statsCore(parts.stats, parts.targetHpPercent),
    barIds: [...parts.barIds],
    durationSeconds: parts.durationSeconds,
    style: parts.style,
  });
}
