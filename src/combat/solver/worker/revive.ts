import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { RevolutionInput } from "../../engine/simulation/revolution";
import type { CombatModifier } from "../../types";
import type { ResolvedLeagueRules } from "../../league/ruleset";
import {
  modifiersFromSources,
  playerPoisonModifiersFromSources,
  reviveLeague as reviveLeagueFromModel,
  serializeLeague as serializeLeagueFromModel,
} from "../../model";
import {
  isSerializableSimBase,
  type SerializableLeagueRules,
  type SerializableModifierSources,
  type SerializableRevolutionSimBase,
  type SolverLoadoutPayload,
} from "./serializable";

/** Rebuild ResolvedLeagueRules (blessingIds as Set) from a cloneable payload. */
export function reviveLeague(league: SerializableLeagueRules): ResolvedLeagueRules {
  return reviveLeagueFromModel(league);
}

/** Flatten a live ResolvedLeagueRules into a structured-clone-safe form. */
export function serializeLeague(league: ResolvedLeagueRules): SerializableLeagueRules {
  return serializeLeagueFromModel(league);
}

/**
 * Rebuild the cast-modifier factory used by simulateRevolution / simulate.
 * Delegates to combat-domain modifiersFromSources (single reconstruction path).
 */
export function reviveModifiers(
  sources: SerializableModifierSources,
  league: ResolvedLeagueRules,
): (ability: AbilitySpec) => CombatModifier[] {
  return modifiersFromSources(sources, league);
}

/** Sim fields shared by every bar evaluation (everything except bar/abilities/horizon). */
export type RevivedRevolutionBase = Omit<
  RevolutionInput,
  "bar" | "style" | "durationTicks" | "abilities"
>;

export function reviveRevolutionBase(sim: SerializableRevolutionSimBase): RevivedRevolutionBase {
  const league = reviveLeague(sim.league);
  return {
    base: sim.base,
    level: sim.level,
    overrideBase: sim.overrideBase,
    overrideLevel: sim.overrideLevel,
    ...(sim.activateNaragiAtStart === true ? { activateNaragiAtStart: true } : {}),
    accuracy: sim.accuracy,
    ...(sim.targetAccuracyProfile ? { targetAccuracyProfile: sim.targetAccuracyProfile } : {}),
    crit: sim.crit,
    modifiers: reviveModifiers(sim.modifierSources, league),
    context: sim.context,
    cap: sim.cap,
    startingAdrenaline: sim.startingAdrenaline,
    equipmentIds: sim.equipmentIds,
    weaponConfiguration: sim.weaponConfiguration,
    adrenaline: sim.adrenaline,
    plantedFeet: sim.plantedFeet,
    strengthCape99: sim.strengthCape99,
    preciseRank: sim.preciseRank,
    ammunition: sim.ammunition,
    caromingRank: sim.caromingRank ?? sim.modifierSources?.caroming ?? 0,
    tumekensPieces: sim.tumekensPieces,
    equipmentEffects: {
      ...sim.equipmentEffects,
      setCritChance: {
        unconditional: sim.equipmentEffects.setCritChance.unconditional,
        conditional: { ...sim.equipmentEffects.setCritChance.conditional },
      },
    },
    nativeSpecialPolicy: {
      useEquippedWeaponSpecial: sim.nativeSpecialPolicy?.useEquippedWeaponSpecial === true,
    },
    league,
    procs: sim.procs,
    conjureBasicDamageMult: sim.conjureBasicDamageMult,
    conjureDurationMult: sim.conjureDurationMult,
    targetHpPercent: sim.targetHpPercent,
    targetMaximumLifePoints: sim.targetMaximumLifePoints,
    targetClassification: {
      demon: sim.modifierSources.target.demon,
      dragon: sim.modifierSources.target.dragon,
      undead: sim.modifierSources.target.undead,
    },
    playerPoison: sim.playerPoison,
    playerPoisonModifiers: playerPoisonModifiersFromSources(sim.modifierSources, league),
    targetPoisonImmune: sim.targetPoisonImmune === true,
    naturalInstinctUntilTick: sim.naturalInstinctUntilTick,
    startingResidualSouls: sim.startingResidualSouls,
    slayerOnTask: sim.slayerOnTask,
    slayerLevel: sim.slayerLevel,
  };
}

export function buildRevolutionInput(
  sim: SerializableRevolutionSimBase,
  parts: {
    bar: readonly AbilitySpec[];
    style: AbilitySpec["style"];
    durationTicks: number;
    abilities: readonly AbilitySpec[];
  },
): RevolutionInput {
  return {
    ...reviveRevolutionBase(sim),
    bar: parts.bar,
    style: parts.style,
    durationTicks: parts.durationTicks,
    abilities: parts.abilities,
  };
}

/**
 * Resolve the preferred precomputed sim payload from a request loadout field.
 * Plain loadout snapshots cannot be revived here (would pull UI loadoutStats);
 * callers must precompute sim numbers on the host.
 */
export function requireSimBase(loadout: SolverLoadoutPayload): SerializableRevolutionSimBase {
  if (isSerializableSimBase(loadout)) return loadout;
  throw new Error(
    "solver loadout is a plain snapshot; precompute SerializableRevolutionSimBase on the host before posting to the worker",
  );
}
