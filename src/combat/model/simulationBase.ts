/**
 * Shared simulation input base from ResolvedCombatModel + ability catalogue.
 * Manual and Revolution attach mode-specific fields only.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type {
  AdrenalineRules,
  CastContextInput,
  ProcRules,
  SimulateInput,
} from "../engine/simulation/contracts";
import type { RevolutionInput } from "../engine/simulation/revolution";
import type { HitCapRule } from "../core/hitCaps";
import type { CombatStyle } from "../types";
import type { ResolvedAbilityCatalogue } from "../abilities/catalogue";
import { mapSpecsThroughCatalogue, resolveAbilitySpecsFromCatalogue } from "../abilities/catalogue";
import type { HostCombatResolveInput, ResolvedCombatModel } from "./contracts";
import { buildResolvedCombatModel } from "./resolve";
import { modifiersFromSources, playerPoisonModifiersFromSources } from "./modifiers";
import { reviveLeague } from "./simulationInput";
import type { ResolvedLeagueRules } from "../league/ruleset";
import type { ActiveEquipmentEffects } from "../shared/equipment";

/** Shared fields for Manual simulate() and Revolution simulateRevolution(). */
export type SimulationInputBase = Omit<
  CastContextInput,
  "horizonTicks" | "detailLevel" | "rotation" | "autoWeave"
>;

/**
 * Full loadout path: model numbers + catalogue + reconstructed modifiers.
 * League Sets revived once; modifiers closed over that freeze.
 */
export function buildSimulationInputBase(
  model: ResolvedCombatModel,
  catalogue: ResolvedAbilityCatalogue,
): SimulationInputBase {
  const league = reviveLeague(model.league);
  const modFactory = modifiersFromSources(model.modifierSources, league);
  return {
    base: model.base,
    magicSpell: model.magicSpell,
    poisonBase: model.poisonBase,
    level: model.level,
    ...(model.overrideBase != null ? { overrideBase: model.overrideBase } : {}),
    ...(model.poisonOverrideBase != null ? { poisonOverrideBase: model.poisonOverrideBase } : {}),
    ...(model.overrideLevel != null ? { overrideLevel: model.overrideLevel } : {}),
    ...(model.activateNaragiAtStart === true ? { activateNaragiAtStart: true } : {}),
    accuracy: model.accuracy,
    ...(model.targetAccuracyProfile ? { targetAccuracyProfile: model.targetAccuracyProfile } : {}),
    crit: {
      chance: model.crit.chance,
      disabled: model.crit.disabled,
      damageBonus: model.crit.damageBonus,
      critualConvertedDamageBonus: model.crit.critualConvertedDamageBonus,
    },
    abilities: catalogue.catalogue,
    abilityRegistry: catalogue.abilityRegistry,
    modifiers: (ability) => modFactory(ability),
    context: model.context,
    cap: model.cap,
    startingAdrenaline: model.startingAdrenaline,
    equipmentIds: model.equipmentIds,
    weaponConfiguration: model.weaponConfiguration,
    adrenaline: model.adrenaline,
    plantedFeet: model.plantedFeet,
    strengthCape99: model.strengthCape99,
    preciseRank: model.preciseRank,
    ammunition: model.ammunition,
    enchantedBoltChanceModifiers: model.enchantedBoltChanceModifiers,
    caromingRank: model.caromingRank,
    tumekensPieces: model.tumekensPieces,
    equipmentEffects: {
      ...model.equipmentEffects,
      ...(model.equipmentEffects.songOfDestruction
        ? { songOfDestruction: { ...model.equipmentEffects.songOfDestruction } }
        : {}),
    },
    nativeSpecialPolicy: model.nativeSpecialPolicy,
    ...(model.eofStoredSpecialId != null && model.eofStoredSpecialId !== ""
      ? { eofStoredSpecialId: model.eofStoredSpecialId }
      : {}),
    league,
    procs: model.procs,
    conjureBasicDamageMult: model.conjureBasicDamageMult,
    conjureDurationMult: model.conjureDurationMult,
    targetHpPercent: model.target.hpPercent,
    targetMaximumLifePoints: model.target.maximumLifePoints,
    ...(model.playerVitality ? { playerVitality: { ...model.playerVitality } } : {}),
    targetClassification: {
      demon: model.target.demon,
      dragon: model.target.dragon,
      undead: model.target.undead,
      elementalWeakness: model.target.elementalWeakness,
      dragonfireImmune: model.target.dragonfireImmune,
    },
    playerPoison: model.playerPoison,
    playerPoisonModifiers: playerPoisonModifiersFromSources(model.modifierSources, league),
    targetPoisonImmune: model.target.poisonImmune === true,
    ...(model.target.incomingHitIntervalSeconds != null &&
    model.target.incomingHitIntervalSeconds > 0
      ? { incomingHitIntervalSeconds: model.target.incomingHitIntervalSeconds }
      : {}),
    ...(model.naturalInstinctUntilTick != null
      ? { naturalInstinctUntilTick: model.naturalInstinctUntilTick }
      : {}),
    ...(model.startingResidualSouls != null
      ? { startingResidualSouls: model.startingResidualSouls }
      : {}),
    ...(model.slayerOnTask != null ? { slayerOnTask: model.slayerOnTask } : {}),
    ...(model.slayerLevel != null ? { slayerLevel: model.slayerLevel } : {}),
  };
}

/** Manual custom-stat line (UI sliders). No full loadout modifiers / gear / league. */
export interface ManualStatLine {
  readonly base: number;
  readonly level: number;
  /** Damage Potential 0..1. */
  readonly accuracy: number;
  /** Crit chance 0..1. */
  readonly critChance: number;
}

/**
 * Scaffold from a resolved model (or partial) for adren economy kept in manual-stat mode.
 * League + equipmentEffects are for adren cap only (start-at-max with T4 / Vestments / HS).
 * Still no cast modifiers or Strength Cape catalogue patch.
 */
export interface ManualStatScaffold {
  readonly cap?: HitCapRule;
  readonly startingAdrenaline?: number;
  readonly adrenaline?: AdrenalineRules;
  readonly procs?: ProcRules;
  readonly league?: ResolvedLeagueRules;
  readonly equipmentEffects?: ActiveEquipmentEffects;
}

/**
 * Manual custom-stat constructor - deliberately separate from full loadout path.
 * No cast modifiers or Strength Cape catalogue patch. League / vestments only for adren cap.
 */
export function buildManualStatSimulationInputBase(
  line: ManualStatLine,
  catalogue: ResolvedAbilityCatalogue,
  scaffold: ManualStatScaffold = {},
): SimulationInputBase {
  return {
    base: Math.max(0, line.base),
    level: Math.min(Math.max(1, line.level), 145),
    accuracy: Math.min(Math.max(0, line.accuracy), 1),
    crit: { chance: Math.min(Math.max(0, line.critChance), 1) },
    abilities: catalogue.catalogue,
    abilityRegistry: catalogue.abilityRegistry,
    // No cast modifiers / plantedFeet / precise / conjure.
    cap: scaffold.cap,
    startingAdrenaline: scaffold.startingAdrenaline,
    adrenaline: scaffold.adrenaline,
    procs: scaffold.procs,
    ...(scaffold.league ? { league: scaffold.league } : {}),
    ...(scaffold.equipmentEffects
      ? {
          equipmentEffects: {
            ...scaffold.equipmentEffects,
            ...(scaffold.equipmentEffects.songOfDestruction
              ? { songOfDestruction: { ...scaffold.equipmentEffects.songOfDestruction } }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * Revolution "Use Loadout off" hybrid: slider damage line + empty cast modifiers,
 * but keep adren/procs/league/equipmentEffects from the scaffold model
 * (matches historical withManualRotationLine + Revo Run behavior).
 *
 * Optimize and Run must share this so scores align.
 */
export function toHybridManualCombatModel(
  scaffold: ResolvedCombatModel,
  line: ManualStatLine,
): ResolvedCombatModel {
  const base = Math.max(0, line.base);
  const level = Math.min(Math.max(1, line.level), 145);
  const accuracy = Math.min(Math.max(0, line.accuracy), 1);
  const critChance = Math.min(Math.max(0, line.critChance), 1);
  const input: HostCombatResolveInput = {
    style: scaffold.style,
    magicSpell: scaffold.magicSpell,
    base,
    level,
    accuracy,
    crit: {
      chance: critChance,
      disabled: false,
      damageBonus: 0,
      critualConvertedDamageBonus: 0,
    },
    adrenaline: scaffold.adrenaline,
    procs: scaffold.procs,
    plantedFeet: scaffold.plantedFeet,
    strengthCape99: scaffold.strengthCape99,
    preciseRank: scaffold.preciseRank,
    ammunition: scaffold.ammunition,
    enchantedBoltChanceModifiers: scaffold.enchantedBoltChanceModifiers,
    conjureBasicDamageMult: scaffold.conjureBasicDamageMult,
    conjureDurationMult: scaffold.conjureDurationMult,
    tumekensPieces: scaffold.tumekensPieces,
    equipmentEffects: {
      ...scaffold.equipmentEffects,
      ...(scaffold.equipmentEffects.songOfDestruction
        ? { songOfDestruction: { ...scaffold.equipmentEffects.songOfDestruction } }
        : {}),
    },
    nativeSpecialPolicy: scaffold.nativeSpecialPolicy,
    ...(scaffold.eofStoredSpecialId != null && scaffold.eofStoredSpecialId !== ""
      ? { eofStoredSpecialId: scaffold.eofStoredSpecialId }
      : {}),
    league: scaffold.league,
    context: { ...scaffold.context, style: scaffold.style },
    targetHpPercent: scaffold.target.hpPercent,
    targetMaximumLifePoints: scaffold.target.maximumLifePoints,
    ...(scaffold.playerVitality ? { playerVitality: { ...scaffold.playerVitality } } : {}),
    playerPoison: scaffold.playerPoison,
    cap: scaffold.cap,
    startingAdrenaline: scaffold.startingAdrenaline,
    // Preserve equipmentIds and weaponConfiguration from scaffold (Leng / passives).
    equipmentIds: scaffold.equipmentIds,
    weaponConfiguration: scaffold.weaponConfiguration,
    // Empty damage modifiers (castModifiersFor: () => []).
    setCounts: [],
    vulnerability: false,
    styleCurseId: "none",
    amZiFlatDamage: 0,
    amHejDamageBonus: 0,
    slayer: { demon: 0, dragon: 0, undead: 0 },
    target: {
      demon: false,
      dragon: false,
      undead: false,
      poisonImmune: scaffold.target.poisonImmune,
      elementalWeakness: scaffold.target.elementalWeakness,
      dragonfireImmune: scaffold.target.dragonfireImmune,
      ...(scaffold.target.incomingHitIntervalSeconds != null
        ? { incomingHitIntervalSeconds: scaffold.target.incomingHitIntervalSeconds }
        : {}),
    },
    slayerHelmet: null,
    salve: null,
    ultimatums: 0,
    lunging: 0,
    caroming: 0,
    berserkersFuryBonus: 0,
    diagnostics: {
      ...scaffold.diagnostics,
      slayerHelmet: null,
      salve: null,
      berserkersFury: {
        ...scaffold.diagnostics.berserkersFury,
        active: false,
        bonus: 0,
      },
    },
  };
  return buildResolvedCombatModel(input);
}

export function toManualSimulateInput(
  base: SimulationInputBase,
  parts: {
    rotation: SimulateInput["rotation"];
    autoWeave?: boolean;
    horizonTicks?: number;
  },
): SimulateInput {
  return {
    ...base,
    rotation: parts.rotation,
    autoWeave: parts.autoWeave,
    ...(parts.horizonTicks !== undefined ? { horizonTicks: parts.horizonTicks } : {}),
  };
}

export function toRevolutionInput(
  base: SimulationInputBase,
  parts: {
    bar: readonly AbilitySpec[];
    style: CombatStyle;
    durationTicks: number;
  },
): RevolutionInput {
  return {
    ...base,
    bar: parts.bar,
    style: parts.style,
    durationTicks: parts.durationTicks,
  };
}

/** Revolution bar specs resolved through catalogue (Strength Cape applied). */
export function resolveRevolutionBar(
  catalogue: ResolvedAbilityCatalogue,
  modelled: readonly AbilitySpec[],
): AbilitySpec[] {
  return mapSpecsThroughCatalogue(catalogue, modelled);
}

/** Rotation ability ids → specs via catalogue. */
export function resolveRotationSpecs(
  catalogue: ResolvedAbilityCatalogue,
  abilityIds: readonly string[],
): AbilitySpec[] {
  return resolveAbilitySpecsFromCatalogue(catalogue, abilityIds);
}
