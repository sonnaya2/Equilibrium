/**
 * Assemble an immutable ResolvedCombatModel from domain-neutral host input.
 */
import { STANDARD_HIT_CAP } from "../core/hitCaps";
import type { HostCombatResolveInput, ResolvedCombatModel } from "./contracts";
import { resolveModifierSourcesFromHost } from "./modifierSources";
import {
  NO_PLAYER_POISON,
  normalizeKwuarmPotency,
  normalizeWeaponPoisonChoice,
} from "../poison/mechanics";

function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) freezeDeep(item);
    return Object.freeze(value) as T;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    freezeDeep(obj[key]);
  }
  return Object.freeze(value);
}

function copyEquipmentEffects(
  effects: HostCombatResolveInput["equipmentEffects"],
): HostCombatResolveInput["equipmentEffects"] {
  return {
    activation: effects.activation,
    setCritChance: {
      unconditional: effects.setCritChance.unconditional,
      conditional: { ...effects.setCritChance.conditional },
    },
    passiveIds: [...effects.passiveIds],
    activeWeapon: effects.activeWeapon
      ? {
          ...effects.activeWeapon,
          passiveIds: [...effects.activeWeapon.passiveIds],
        }
      : undefined,
    enchantments: [...effects.enchantments],
    weaponClass: effects.weaponClass,
    defenderEquipped: effects.defenderEquipped,
    passage: { ...effects.passage },
    amZiFlatDamage: effects.amZiFlatDamage,
    amHejDamageBonus: effects.amHejDamageBonus,
    deathdealer: effects.deathdealer ? { ...effects.deathdealer } : undefined,
    dracolich: effects.dracolich
      ? {
          ...effects.dracolich,
          thresholds: { ...effects.dracolich.thresholds },
        }
      : undefined,
    songOfDestruction: effects.songOfDestruction
      ? { ...effects.songOfDestruction }
      : undefined,
    vestments: { ...effects.vestments },
  };
}

/**
 * Single factory: host-resolved facts → frozen ResolvedCombatModel.
 * Does not import Loadout or run loadout stages.
 */
export function buildResolvedCombatModel(input: HostCombatResolveInput): ResolvedCombatModel {
  const modifierSources = resolveModifierSourcesFromHost(input);
  const diag = input.diagnostics;
  const poison = input.playerPoison ?? NO_PLAYER_POISON;
  const model: ResolvedCombatModel = {
    style: input.style,
    base: input.base,
    level: input.level,
    ...(input.overrideBase != null ? { overrideBase: input.overrideBase } : {}),
    ...(input.overrideLevel != null ? { overrideLevel: input.overrideLevel } : {}),
    ...(input.activateNaragiAtStart === true ? { activateNaragiAtStart: true } : {}),
    accuracy: input.accuracy,
    ...(input.targetAccuracyProfile
      ? { targetAccuracyProfile: { ...input.targetAccuracyProfile } }
      : {}),
    crit: {
      chance: input.crit.chance,
      disabled: input.crit.disabled,
      damageBonus: input.crit.damageBonus,
      critualConvertedDamageBonus: input.crit.critualConvertedDamageBonus,
    },
    equipmentIds: [...input.equipmentIds],
    equipmentEffects: copyEquipmentEffects(input.equipmentEffects),
    weaponConfiguration: input.weaponConfiguration,
    nativeSpecialPolicy: {
      useEquippedWeaponSpecial: input.nativeSpecialPolicy?.useEquippedWeaponSpecial === true,
    },
    modifierSources: {
      ...modifierSources,
      setCounts: [...modifierSources.setCounts].map(([id, n]) => [id, n] as const),
      slayer: { ...modifierSources.slayer },
      target: { ...modifierSources.target },
      slayerHelmet: modifierSources.slayerHelmet ? { ...modifierSources.slayerHelmet } : null,
      salve: modifierSources.salve ? { ...modifierSources.salve } : null,
    },
    adrenaline: input.adrenaline ? { ...input.adrenaline } : {},
    procs: input.procs ? { ...input.procs } : {},
    plantedFeet: input.plantedFeet === true,
    strengthCape99: input.strengthCape99 === true,
    preciseRank: input.preciseRank ?? 0,
    ammunition: input.ammunition ?? null,
    enchantedBoltChanceModifiers: {
      rangedCape: input.enchantedBoltChanceModifiers?.rangedCape === true,
      eliteSeersVillage: input.enchantedBoltChanceModifiers?.eliteSeersVillage === true,
    },
    caromingRank: Math.max(0, Math.min(4, Math.floor(input.caromingRank ?? input.caroming ?? 0))),
    conjureBasicDamageMult: input.conjureBasicDamageMult ?? 1,
    conjureDurationMult: input.conjureDurationMult ?? 1,
    tumekensPieces: input.tumekensPieces ?? 0,
    target: {
      hpPercent: input.targetHpPercent,
      maximumLifePoints: input.targetMaximumLifePoints,
      demon: input.target?.demon,
      dragon: input.target?.dragon,
      undead: input.target?.undead,
      poisonImmune: input.target?.poisonImmune === true,
      elementalWeakness: input.target?.elementalWeakness ?? "unknown",
      dragonfireImmune: input.target?.dragonfireImmune === true,
    },
    ...(input.playerVitality
      ? {
          playerVitality: {
            maximumLifePoints: input.playerVitality.maximumLifePoints,
            currentLifePoints: input.playerVitality.currentLifePoints,
          },
        }
      : {}),
    playerPoison: {
      potion: normalizeWeaponPoisonChoice(poison.potion),
      potionUntilTick:
        Number.isFinite(poison.potionUntilTick) && poison.potionUntilTick > 0
          ? Math.floor(poison.potionUntilTick)
          : 0,
      kwuarmPotency: normalizeKwuarmPotency(poison.kwuarmPotency),
      cinderbane: poison.cinderbane === true,
      blowpipe: poison.blowpipe === true,
      laniakea: poison.laniakea === true,
    },
    league: {
      ruleset: input.league.ruleset,
      blessings: [...input.league.blessings],
      // T4 maximum-adrenaline lives on tierPassives; drop this and start=max (125) fails createRuntime.
      tierPassives: [...(input.league.tierPassives ?? [])],
      blessingIds: [...input.league.blessingIds],
      relics: [...(input.league.relics ?? [])],
      totalArmour: input.league.totalArmour,
      maximumLife: input.league.maximumLife,
      powerburstUntilTick: Math.max(0, Math.floor(input.league.powerburstUntilTick ?? 0)),
      targetSize: input.league.targetSize,
      occupiedTiles: input.league.occupiedTiles,
      areaTargets: Math.max(1, Math.floor(input.league.areaTargets ?? 1)),
      prayerBonus: Math.max(0, input.league.prayerBonus ?? 0),
      trueEquilibrium: input.league.trueEquilibrium ?? {
        uniquePathCount: 0,
        baseAbilityDamage: 0,
        armour: 0,
        maximumLife: 0,
        critChance: 0,
        critDamage: 0,
        prayerBonus: 0,
      },
      herbloreLevel: input.league.herbloreLevel,
    },
    context: input.context
      ? { ...input.context }
      : {
          style: input.style,
          ruleset: input.league.ruleset,
          targetSize: input.league.targetSize,
          occupiedTiles: input.league.occupiedTiles,
        },
    cap: input.cap
      ? { cap: input.cap.cap, bypass: input.cap.bypass === true }
      : { cap: STANDARD_HIT_CAP, bypass: false },
    startingAdrenaline: input.startingAdrenaline ?? 0,
    ...(input.naturalInstinctUntilTick != null
      ? { naturalInstinctUntilTick: input.naturalInstinctUntilTick }
      : {}),
    ...(input.startingResidualSouls != null
      ? { startingResidualSouls: input.startingResidualSouls }
      : {}),
    ...(input.slayerOnTask != null ? { slayerOnTask: input.slayerOnTask } : {}),
    ...(input.slayerLevel != null ? { slayerLevel: input.slayerLevel } : {}),
    ...(input.eofStoredSpecialId != null && input.eofStoredSpecialId !== ""
      ? { eofStoredSpecialId: input.eofStoredSpecialId }
      : {}),
    diagnostics: {
      slayerHelmet: diag.slayerHelmet ? { ...diag.slayerHelmet } : null,
      salve: diag.salve ? { ...diag.salve } : null,
      berserkersFury: { ...diag.berserkersFury },
      powerburstRemainingTicks: Math.max(0, Math.floor(diag.powerburstRemainingTicks)),
      ringOfVigourActive: diag.ringOfVigourActive === true,
      ringOfVigourSources: [...diag.ringOfVigourSources],
      archaeologySelectedIds: [...diag.archaeologySelectedIds],
      maxAdrenaline: diag.maxAdrenaline,
    },
  };
  return freezeDeep(model);
}

export function isResolvedCombatModel(value: unknown): value is ResolvedCombatModel {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.style === "string" &&
    typeof v.base === "number" &&
    typeof v.level === "number" &&
    typeof v.accuracy === "number" &&
    v.modifierSources !== undefined &&
    v.equipmentEffects !== undefined &&
    v.league !== undefined &&
    v.diagnostics !== undefined &&
    Array.isArray(v.equipmentIds)
  );
}
