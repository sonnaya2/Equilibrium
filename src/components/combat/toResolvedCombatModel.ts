/**
 * Thin UI adapter: Loadout + Build options to ResolvedCombatModel.
 * Reuses loadoutStats() without a second calculation path.
 */
import {
  buildResolvedCombatModel,
  serializeLeague,
  type HostCombatResolveInput,
  type ResolvedCombatModel,
} from "@/combat/model";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import {
  NARAGI_EDICT_RELIC,
  NARAGI_LEVEL_OVERRIDE,
  SLIVER_OF_EDICTS_ID,
} from "@/combat/league/naragiEdict";
import { formatRingOfVigourSources, ringOfVigourActiveSources } from "@/combat/shared/ringOfVigour";
import { hasPassive } from "@/combat/shared/equipment";
import { weaponPoisonDurationTicks } from "@/combat/poison/mechanics";
import {
  sanitizeArchaeologyState,
  sanitizeSelectedRelics,
} from "@/combat/shared/archaeologyRelics";
import { type Loadout } from "./useLoadout";
import { loadoutStats, type CalcStats, type LoadoutStatsOptions } from "./loadoutStats";
import { computedLoadoutBase, loadoutWeaponConfig } from "./loadout/weaponConfiguration";

function sanitizedArchaeologyIds(
  loadout: Loadout,
  options: LoadoutStatsOptions,
): readonly string[] {
  const archState = loadout.archaeology ?? { selectedIds: [], energyCap: 500 as const };
  if (options.unlockedRegions != null) {
    return sanitizeArchaeologyState(archState, options.unlockedRegions).selectedIds;
  }
  return sanitizeSelectedRelics({
    selectedIds: archState.selectedIds ?? [],
    energyCap: archState.energyCap,
  });
}

/**
 * Effective base AD off (loadout level) vs on (Naragi 255 window).
 * Same scale used for land-time overrideBase in the sim.
 */
export function naragiBaseDamageCompare(
  loadout: Loadout,
  statsBase: number,
  weaponTierOverride: number | null = null,
): { off: number; on: number } {
  const overrides = weaponTierOverride == null ? [] : [weaponTierOverride];
  const formulaNormal = computedLoadoutBase(loadout, overrides);
  const formulaOverride = baseAbilityDamage(
    NARAGI_LEVEL_OVERRIDE,
    loadoutWeaponConfig(loadout, overrides),
  );
  const on =
    formulaNormal > 0 ? Math.floor((statsBase * formulaOverride) / formulaNormal) : statsBase;
  return { off: statsBase, on };
}

/** Map already-resolved CalcStats + Loadout into host model input (no re-stage). */
export function hostInputFromLoadoutStats(
  loadout: Loadout,
  stats: CalcStats,
  options: LoadoutStatsOptions = {},
): HostCombatResolveInput {
  const vigourSources = ringOfVigourActiveSources({
    equipmentIds: stats.equipmentIds,
    ringOfVigourPassive: loadout.buffs.ringOfVigourPassive,
    unlockedRegions: options.unlockedRegions,
  });

  // Precompute base AD at Naragi 255 so land-time override swaps formula base exactly.
  const { on: overrideBase } = naragiBaseDamageCompare(
    loadout,
    stats.base,
    stats.weaponTierOverride,
  );
  const sliverWorn = loadout.equipmentSlots?.pocket === SLIVER_OF_EDICTS_ID;
  const naragiPicked =
    options.relics?.includes(NARAGI_EDICT_RELIC) === true ||
    stats.league.relicNames?.has(NARAGI_EDICT_RELIC) === true;
  const activateNaragiAtStart =
    loadout.buffs.sliverOfEdictsActive === true && sliverWorn && naragiPicked;

  return {
    style: loadout.style,
    base: stats.base,
    level: stats.level,
    overrideBase,
    overrideLevel: NARAGI_LEVEL_OVERRIDE,
    ...(activateNaragiAtStart ? { activateNaragiAtStart: true } : {}),
    accuracy: stats.dp,
    ...(stats.targetAccuracyProfile ? { targetAccuracyProfile: stats.targetAccuracyProfile } : {}),
    crit: {
      chance: stats.critChance,
      disabled: stats.critsDisabled,
      damageBonus: stats.critDamageBonus,
      critualConvertedDamageBonus: stats.convertedCritChance,
    },
    adrenaline: stats.adrenaline,
    procs: stats.procs,
    plantedFeet: stats.plantedFeet,
    strengthCape99: stats.strengthCape99,
    preciseRank: stats.preciseRank,
    ammunition: stats.ammunition,
    conjureBasicDamageMult: stats.conjureBasicDamageMult,
    conjureDurationMult: stats.conjureDurationMult,
    tumekensPieces: stats.tumekensPieces,
    equipmentEffects: stats.equipmentEffects,
    nativeSpecialPolicy: {
      useEquippedWeaponSpecial: loadout.buffs.useEquippedWeaponSpecial === true,
    },
    league: serializeLeague(stats.league),
    context: stats.combatContext,
    targetHpPercent: loadout.target?.hpPercent,
    targetMaximumLifePoints: loadout.target?.maximumLifePoints,
    cap: stats.cap,
    startingAdrenaline: stats.startingAdrenaline,
    equipmentIds: stats.equipmentIds,
    weaponConfiguration: stats.weaponConfiguration,
    equipmentSlots: loadout.equipmentSlots,
    playerPoison: {
      potion: loadout.buffs.weaponPoison,
      potionUntilTick: weaponPoisonDurationTicks(loadout.buffs.weaponPoison),
      kwuarmPotency: loadout.buffs.kwuarmPotency,
      cinderbane: hasPassive(stats.equipmentEffects, "cinderbane-weapon-poison"),
      blowpipe: hasPassive(stats.equipmentEffects, "blowpipe-weapon-poison"),
      laniakea: hasPassive(stats.equipmentEffects, "laniakea-weapon-poison"),
    },
    vulnerability: loadout.buffs.vulnerability === true,
    styleCurseId: loadout.buffs.styleCurse ?? "none",
    amZiFlatDamage: stats.equipmentEffects.amZiFlatDamage ?? 0,
    amHejDamageBonus: stats.equipmentEffects.amHejDamageBonus ?? 0,
    slayer: {
      demon: loadout.perks.demonSlayer ?? 0,
      dragon: loadout.perks.dragonSlayer ?? 0,
      undead: loadout.perks.undeadSlayer ?? 0,
    },
    target: {
      demon: loadout.target?.demon,
      dragon: loadout.target?.dragon,
      undead: loadout.target?.undead,
      poisonImmune: loadout.target?.poisonImmune,
    },
    // Tuska empower: both required; never invent level when on-task alone.
    ...(loadout.target?.onSlayerTask === true ? { slayerOnTask: true } : {}),
    ...(loadout.slayerLevel != null &&
    Number.isFinite(loadout.slayerLevel) &&
    loadout.slayerLevel > 0
      ? { slayerLevel: Math.floor(loadout.slayerLevel) }
      : {}),
    slayerHelmet: stats.slayerHelmet,
    salve: stats.salve,
    ultimatums: loadout.perks.ultimatums ?? 0,
    lunging: loadout.perks.lunging ?? 0,
    caroming: loadout.perks.caroming ?? 0,
    berserkersFuryBonus: stats.berserkersFury.active ? stats.berserkersFury.bonus : 0,
    diagnostics: {
      slayerHelmet: stats.slayerHelmet,
      salve: stats.salve,
      berserkersFury: {
        active: stats.berserkersFury.active,
        bonus: stats.berserkersFury.bonus,
        currentLifePoints: stats.berserkersFury.currentLifePoints,
        maximumLifePoints: stats.berserkersFury.maximumLifePoints,
        currentHealthPercent: stats.berserkersFury.currentHealthPercent,
      },
      powerburstRemainingTicks: Math.max(0, Math.floor(stats.league.powerburstUntilTick ?? 0)),
      ringOfVigourActive: stats.adrenaline?.ringOfVigour === true,
      ringOfVigourSources:
        vigourSources.length > 0 ? [formatRingOfVigourSources(vigourSources)] : [],
      archaeologySelectedIds: sanitizedArchaeologyIds(loadout, options),
      maxAdrenaline: stats.maxAdrenaline,
    },
  };
}

/**
 * Loadout + options → existing stages (loadoutStats) → immutable combat model.
 * Pass `stats` when the caller already resolved loadoutStats with the same options/now
 * to avoid a second stage run (powerburst tick freeze).
 */
export function toResolvedCombatModel(
  loadout: Loadout,
  options: LoadoutStatsOptions = {},
  stats?: CalcStats,
): ResolvedCombatModel {
  const resolved = stats ?? loadoutStats(loadout, options);
  return buildResolvedCombatModel(hostInputFromLoadoutStats(loadout, resolved, options));
}

/** Single freeze: one loadoutStats + one model (shared `now`). */
export function resolveLoadoutCombat(
  loadout: Loadout,
  options: LoadoutStatsOptions = {},
): { stats: CalcStats; model: ResolvedCombatModel; now: number } {
  const now = options.now ?? Date.now();
  const opts = { ...options, now };
  const stats = loadoutStats(loadout, opts);
  const model = toResolvedCombatModel(loadout, opts, stats);
  return { stats, model, now };
}
