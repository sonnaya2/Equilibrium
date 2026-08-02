import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { RevolutionInput } from "../../engine/simulation/revolution";
import type { CombatModifier } from "../../types";
import type { ResolvedLeagueRules } from "../../league/ruleset";
import { leagueModifiers } from "../../league/ruleset";
import {
  additiveMeleeDamageModifier,
  amZiModifier,
  setDamageModifiers,
} from "../../shared/equipment";
import {
  lungingPerkModifier,
  raceSlayerPerkModifier,
  ultimatumsPerkModifier,
} from "../../shared/perks";
import { prayerDamageModifier, styleCurseById } from "../../shared/prayers";
import { vulnerabilityModifier } from "../../shared/vulnerability";
import type { BlessingId } from "@/league/blessings";
import {
  isSerializableSimBase,
  type SerializableLeagueRules,
  type SerializableModifierSources,
  type SerializableRevolutionSimBase,
  type SolverLoadoutPayload,
} from "./serializable";

/** Rebuild ResolvedLeagueRules (blessingIds as Set) from a cloneable payload. */
export function reviveLeague(league: SerializableLeagueRules): ResolvedLeagueRules {
  return {
    ruleset: league.ruleset,
    blessings: league.blessings,
    blessingIds: new Set<BlessingId>(league.blessingIds),
    totalArmour: league.totalArmour,
    maximumLife: league.maximumLife,
    targetTiles: league.targetTiles,
  };
}

/** Flatten a live ResolvedLeagueRules into a structured-clone-safe form. */
export function serializeLeague(league: ResolvedLeagueRules): SerializableLeagueRules {
  return {
    ruleset: league.ruleset,
    blessings: league.blessings,
    blessingIds: [...league.blessingIds],
    totalArmour: league.totalArmour,
    maximumLife: league.maximumLife,
    targetTiles: league.targetTiles,
  };
}

function setCountsMap(sources: SerializableModifierSources): Map<string, number> {
  return new Map(sources.setCounts);
}

/**
 * Rebuild the cast-modifier factory used by simulateRevolution / simulate.
 * Calls existing perk / equipment / prayer / league factories — no React.
 */
export function reviveModifiers(
  sources: SerializableModifierSources,
  league: ResolvedLeagueRules,
): (ability: AbilitySpec) => CombatModifier[] {
  const global: CombatModifier[] = [];
  global.push(...setDamageModifiers(setCountsMap(sources)));
  if (sources.vulnerability) global.push(vulnerabilityModifier());
  if (sources.styleCurseId && sources.styleCurseId !== "none") {
    const curse = styleCurseById(sources.styleCurseId);
    if (curse) global.push(prayerDamageModifier(curse));
  }
  if (sources.amZiFlatDamage > 0) global.push(amZiModifier(sources.amZiFlatDamage));
  if (sources.amHejDamageBonus > 0) {
    global.push(additiveMeleeDamageModifier(sources.amHejDamageBonus));
  }
  if (sources.slayer.demon > 0) {
    global.push(raceSlayerPerkModifier("demon", sources.target.demon === true));
  }
  if (sources.slayer.dragon > 0) {
    global.push(raceSlayerPerkModifier("dragon", sources.target.dragon === true));
  }
  if (sources.slayer.undead > 0) {
    global.push(raceSlayerPerkModifier("undead", sources.target.undead === true));
  }
  global.push(...leagueModifiers(league));

  return (ability: AbilitySpec) => [
    ...global,
    ...(sources.ultimatums > 0
      ? [ultimatumsPerkModifier(sources.ultimatums, ability.category)]
      : []),
    ...(sources.lunging > 0 ? [lungingPerkModifier(sources.lunging, ability.id)] : []),
  ];
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
    accuracy: sim.accuracy,
    crit: sim.crit,
    modifiers: reviveModifiers(sim.modifierSources, league),
    context: sim.context,
    cap: sim.cap,
    startingAdrenaline: sim.startingAdrenaline,
    equipmentIds: sim.equipmentIds,
    weaponConfiguration: sim.weaponConfiguration,
    adrenaline: sim.adrenaline,
    plantedFeet: sim.plantedFeet,
    preciseRank: sim.preciseRank,
    tumekensPieces: sim.tumekensPieces,
    tumekensCritEnabled: sim.tumekensCritEnabled,
    equipmentEffects: sim.equipmentEffects,
    league,
    procs: sim.procs,
    conjureBasicDamageMult: sim.conjureBasicDamageMult,
    conjureDurationMult: sim.conjureDurationMult,
    targetHpPercent: sim.targetHpPercent,
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
