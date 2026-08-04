/**
 * UI -> combat-domain adapters for Revolution solver packing.
 * Keeps CalcStats / Loadout types out of src/combat/solver.
 *
 * Preferred: ResolvedCombatModel (host already resolved helmet/salve/arch/RoV).
 * Compat: solverSnapshotFromUi maps CalcStats+Loadout → same snapshot shape.
 */
import type { ResolvedCombatModel } from "@/combat/model";
import type { SolverPackSnapshot } from "@/combat/solver";
import { serializeLeague } from "@/combat/solver";
import type { CalcStats } from "./loadoutStats";
import type { Loadout } from "./loadout/model";

/**
 * Preferred adapter: copy only pre-resolved model fields.
 * No re-derive from raw Loadout perks/slots/buffs.
 */
export function solverSnapshotFromResolvedModel(
  model: ResolvedCombatModel,
): SolverPackSnapshot {
  const sources = model.modifierSources;
  return {
    base: model.base,
    level: model.level,
    accuracy: model.accuracy,
    crit: {
      chance: model.crit.chance,
      disabled: model.crit.disabled,
      damageBonus: model.crit.damageBonus,
    },
    adrenaline: model.adrenaline,
    procs: model.procs,
    plantedFeet: model.plantedFeet,
    strengthCape99: model.strengthCape99,
    preciseRank: model.preciseRank,
    conjureBasicDamageMult: model.conjureBasicDamageMult,
    conjureDurationMult: model.conjureDurationMult,
    tumekensPieces: model.tumekensPieces,
    tumekensCritEnabled: model.tumekensCritEnabled,
    equipmentEffects: model.equipmentEffects,
    league: {
      ...model.league,
      blessingIds: [...model.league.blessingIds],
      relics: [...(model.league.relics ?? [])],
      powerburstUntilTick: Math.max(0, Math.floor(model.league.powerburstUntilTick ?? 0)),
    },
    context: model.context,
    targetHpPercent: model.target.hpPercent,
    cap: model.cap,
    startingAdrenaline: model.startingAdrenaline,
    equipmentIds: model.equipmentIds,
    weaponConfiguration: model.weaponConfiguration,
    // Precomputed sources only — pack must not re-scan slots for these.
    setCounts: [...sources.setCounts].map(([id, n]) => [id, n] as const),
    vulnerability: sources.vulnerability === true,
    styleCurseId: sources.styleCurseId ?? "none",
    amZiFlatDamage: sources.amZiFlatDamage ?? 0,
    amHejDamageBonus: sources.amHejDamageBonus ?? 0,
    slayer: {
      demon: sources.slayer.demon ?? 0,
      dragon: sources.slayer.dragon ?? 0,
      undead: sources.slayer.undead ?? 0,
    },
    target: {
      demon: sources.target.demon,
      dragon: sources.target.dragon,
      undead: sources.target.undead,
    },
    slayerHelmet: sources.slayerHelmet ?? null,
    salve: sources.salve ?? null,
    ultimatums: sources.ultimatums ?? 0,
    lunging: sources.lunging ?? 0,
    berserkersFuryBonus: sources.berserkersFuryBonus ?? 0,
  };
}

/**
 * Temporary compatibility wrapper for tests / fingerprints still on CalcStats.
 * Prefer solverSnapshotFromResolvedModel / packSimBaseFromModel.
 *
 * Helmet / salve / arch: copy from pre-resolved CalcStats only (never re-resolve).
 */
export function solverSnapshotFromUi(
  stats: CalcStats,
  loadout: Loadout,
): SolverPackSnapshot {
  return {
    base: stats.base,
    level: stats.level,
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
    tumekensCritEnabled: stats.tumekensCritEnabled,
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
    berserkersFuryBonus: stats.berserkersFury.active ? stats.berserkersFury.bonus : 0,
  };
}
