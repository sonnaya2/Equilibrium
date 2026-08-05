/**
 * Thin UI adapter: Loadout + Build options → ResolvedCombatModel.
 * Reuses loadoutStats() only — no second calculation path.
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
import {
  formatRingOfVigourSources,
  ringOfVigourActiveSources,
} from "@/combat/shared/ringOfVigour";
import {
  sanitizeArchaeologyState,
  sanitizeSelectedRelics,
} from "@/combat/shared/archaeologyRelics";
import { type Loadout } from "./useLoadout";
import {
  loadoutStats,
  type CalcStats,
  type LoadoutStatsOptions,
} from "./loadoutStats";
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
): { off: number; on: number } {
  const formulaNormal = computedLoadoutBase(loadout);
  const formulaOverride = baseAbilityDamage(
    NARAGI_LEVEL_OVERRIDE,
    loadoutWeaponConfig(loadout),
  );
  const on =
    formulaNormal > 0
      ? Math.floor((statsBase * formulaOverride) / formulaNormal)
      : statsBase;
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
  const { on: overrideBase } = naragiBaseDamageCompare(loadout, stats.base);
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
    crit: {
      chance: stats.critChance,
      disabled: stats.critsDisabled,
      damageBonus: stats.critDamageBonus,
    },
    adrenaline: stats.adrenaline,
    procs: stats.procs,
    plantedFeet: stats.plantedFeet,
    strengthCape99: stats.strengthCape99,
    preciseRank: stats.preciseRank,
    conjureBasicDamageMult: stats.conjureBasicDamageMult,
    conjureDurationMult: stats.conjureDurationMult,
    tumekensPieces: stats.tumekensPieces,
    tumekensCritEnabled: stats.tumekensCritEnabled === true,
    equipmentEffects: stats.equipmentEffects,
    league: serializeLeague(stats.league),
    context: stats.combatContext,
    targetHpPercent: loadout.target?.hpPercent,
    cap: stats.cap,
    startingAdrenaline: stats.startingAdrenaline,
    equipmentIds: stats.equipmentIds,
    weaponConfiguration: stats.weaponConfiguration,
    equipmentSlots: loadout.equipmentSlots,
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
    },
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
      powerburstRemainingTicks: Math.max(
        0,
        Math.floor(stats.league.powerburstUntilTick ?? 0),
      ),
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
