/**
 * Project ResolvedCombatModel into existing sim/solver plain payloads (no Maps).
 */
import { indexActiveBlessings, type BlessingId } from "@/league/blessings";
import type { ResolvedLeagueRules } from "../league/ruleset";
import { STANDARD_HIT_CAP } from "../core/hitCaps";
import type {
  SerializableLeagueRules,
  SerializableRevolutionSimBase,
} from "../solver/worker/serializable";
import type { ResolvedCombatModel } from "./contracts";

/** Rebuild ResolvedLeagueRules (blessingIds as Set) from a cloneable payload. */
export function reviveLeague(league: SerializableLeagueRules): ResolvedLeagueRules {
  const relics = [...(league.relics ?? [])];
  return {
    ruleset: league.ruleset,
    blessings: league.blessings,
    blessingsById: indexActiveBlessings(league.blessings),
    tierPassives: league.tierPassives ?? [],
    blessingIds: new Set<BlessingId>(league.blessingIds),
    relics,
    relicNames: new Set(relics),
    totalArmour: league.totalArmour,
    maximumLife: league.maximumLife,
    powerburstUntilTick: Math.max(0, Math.floor(league.powerburstUntilTick ?? 0)),
    targetSize: league.targetSize,
    occupiedTiles: league.occupiedTiles,
    areaTargets: Math.max(1, Math.floor(league.areaTargets ?? 1)),
    prayerBonus: Math.max(0, league.prayerBonus ?? 0),
    trueEquilibrium: league.trueEquilibrium ?? {
      uniquePathCount: 0,
      baseAbilityDamage: 0,
      armour: 0,
      maximumLife: 0,
      critChance: 0,
      critDamage: 0,
      prayerBonus: 0,
    },
    herbloreLevel: league.herbloreLevel,
  };
}

/** Flatten a live ResolvedLeagueRules into a structured-clone-safe form. */
export function serializeLeague(league: ResolvedLeagueRules): SerializableLeagueRules {
  return {
    ruleset: league.ruleset,
    blessings: league.blessings,
    tierPassives: league.tierPassives,
    blessingIds: [...league.blessingIds],
    relics: [...league.relics],
    totalArmour: league.totalArmour,
    maximumLife: league.maximumLife,
    powerburstUntilTick: Math.max(0, Math.floor(league.powerburstUntilTick ?? 0)),
    targetSize: league.targetSize,
    occupiedTiles: league.occupiedTiles,
    areaTargets: league.areaTargets,
    prayerBonus: league.prayerBonus,
    trueEquilibrium: league.trueEquilibrium,
    herbloreLevel: league.herbloreLevel,
  };
}

/**
 * Project model → SerializableRevolutionSimBase for pack/identity/worker.
 * Field set matches packSimBase output (no diagnostics).
 */
export function projectSerializableSimBase(
  model: ResolvedCombatModel,
): SerializableRevolutionSimBase {
  return {
    base: model.base,
    level: model.level,
    ...(model.overrideBase != null ? { overrideBase: model.overrideBase } : {}),
    ...(model.overrideLevel != null ? { overrideLevel: model.overrideLevel } : {}),
    ...(model.activateNaragiAtStart === true ? { activateNaragiAtStart: true } : {}),
    accuracy: model.accuracy,
    crit: {
      chance: model.crit.chance,
      disabled: model.crit.disabled,
      damageBonus: model.crit.damageBonus,
      critualConvertedDamageBonus: model.crit.critualConvertedDamageBonus,
    },
    adrenaline: model.adrenaline,
    procs: model.procs,
    plantedFeet: model.plantedFeet,
    strengthCape99: model.strengthCape99,
    preciseRank: model.preciseRank,
    ammo: model.ammo,
    caromingRank: model.caromingRank,
    conjureBasicDamageMult: model.conjureBasicDamageMult,
    conjureDurationMult: model.conjureDurationMult,
    tumekensPieces: model.tumekensPieces,
    equipmentEffects: model.equipmentEffects,
    nativeSpecialPolicy: model.nativeSpecialPolicy,
    league: {
      ...model.league,
      blessingIds: [...model.league.blessingIds],
      relics: [...(model.league.relics ?? [])],
      powerburstUntilTick: Math.max(0, Math.floor(model.league.powerburstUntilTick ?? 0)),
    },
    context: model.context,
    targetHpPercent: model.target.hpPercent,
    playerPoison: { ...model.playerPoison },
    targetPoisonImmune: model.target.poisonImmune === true,
    cap: model.cap ?? { cap: STANDARD_HIT_CAP, bypass: false },
    startingAdrenaline: model.startingAdrenaline,
    ...(model.naturalInstinctUntilTick != null
      ? { naturalInstinctUntilTick: model.naturalInstinctUntilTick }
      : {}),
    ...(model.startingResidualSouls != null
      ? { startingResidualSouls: model.startingResidualSouls }
      : {}),
    ...(model.slayerOnTask != null ? { slayerOnTask: model.slayerOnTask } : {}),
    ...(model.slayerLevel != null ? { slayerLevel: model.slayerLevel } : {}),
    equipmentIds: [...model.equipmentIds],
    weaponConfiguration: model.weaponConfiguration,
    modifierSources: {
      ...model.modifierSources,
      setCounts: [...model.modifierSources.setCounts].map(([id, n]) => [id, n] as const),
      slayer: { ...model.modifierSources.slayer },
      target: { ...model.modifierSources.target },
      slayerHelmet: model.modifierSources.slayerHelmet
        ? { ...model.modifierSources.slayerHelmet }
        : null,
      salve: model.modifierSources.salve ? { ...model.modifierSources.salve } : null,
    },
  };
}
