import type { CalcStats } from "@/components/combat/loadoutStats";
import type { Loadout } from "@/components/combat/loadout/model";
import type { BuildState, RegionId } from "@/league";
import { REGION_IDS, unlockedRegions } from "@/league";
import type { BlessingPath } from "@/league/blessings";
import { secondsToTicks } from "../core/ticks";
import { equippedSetCounts } from "../shared/equipment";
import { OBJECTIVE_HORIZON_TICKS } from "./objective";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  type AuthoredSeedBar,
  type SerializableModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverSearchTier,
} from "./worker/serializable";
import { serializeLeague } from "./worker/revive";
import type { ObjectiveProfileId, ObjectiveWeights } from "./contracts";
import type { CombatStyle } from "../types";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { engineSpecs } from "../abilities/registry";
import { clampSolverBarSizes, DEFAULT_MAX_BAR_SIZE, MIN_SOLVER_BAR_SIZE } from "./solutionStore";

export interface PackSolverRequestInput {
  stats: CalcStats;
  loadout: Loadout;
  build: BuildState;
  style?: CombatStyle;
  tier?: SolverSearchTier;
  profileId?: ObjectiveProfileId;
  customWeights?: ObjectiveWeights;
  seed?: number;
  maxBarSize?: number;
  minBarSize?: number;
  includePartial?: boolean;
  includeUnknownAvailability?: boolean;
  disabledAbilityIds?: readonly string[];
  /** Final exact horizon seconds (default 300). */
  durationSeconds?: number;
  /** Explore horizon seconds (default 60). */
  exploreSeconds?: number;
  userBar?: readonly string[];
  now?: number;
  useBuildRegions?: boolean;
  /** Extra unlocked regions when not using build. */
  unlockedRegions?: readonly RegionId[];
}

function modifierSourcesFrom(stats: CalcStats, loadout: Loadout): SerializableModifierSources {
  const counts = equippedSetCounts({
    equipmentSlots: loadout.equipmentSlots,
    equipmentIds: [...stats.equipmentIds],
  });
  const setCounts: (readonly [string, number])[] = [...counts.entries()].map(
    ([setId, pieces]) => [setId, pieces] as const,
  );
  return {
    ...emptyModifierSources(),
    vulnerability: loadout.buffs.vulnerability === true,
    styleCurseId: loadout.buffs.styleCurse ?? "none",
    amZiFlatDamage: stats.equipmentEffects.amZiFlatDamage ?? 0,
    amHejDamageBonus: stats.equipmentEffects.amHejDamageBonus ?? 0,
    setCounts,
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
    ultimatums: loadout.perks.ultimatums ?? 0,
    lunging: loadout.perks.lunging ?? 0,
  };
}

export function packSimBase(stats: CalcStats, loadout: Loadout): SerializableRevolutionSimBase {
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
    modifierSources: modifierSourcesFrom(stats, loadout),
  };
}

function staticSeedBars(style: CombatStyle): AuthoredSeedBar[] {
  return combatRevolutionBars.records
    .filter((b) => b.style === style && b.supported && (b.target == null || b.target === "single"))
    .map((b) => {
      const ids = revoManagedSlots(b, engineSpecs)
        .filter((s) => s.modelledBy === "engine" && s.spec)
        .map((s) => s.spec!.id);
      return { id: b.id, abilityIds: ids, baseline: b.mode === "revo++" };
    })
    .filter((s) => s.abilityIds.length > 0);
}

/** Pack a structured-clone-safe solver request from live combat UI state. */
export function packSolverRequest(input: PackSolverRequestInput): SerializableSolverRequest {
  // Freeze once per request — never re-sample Date.now() per evaluation.
  const now = input.now ?? Date.now();
  const style = input.style ?? input.loadout.style;
  const durationSeconds = input.durationSeconds ?? 300;
  /** Short explore horizon for ranking; full 300s only on finalists. */
  const exploreSeconds = input.exploreSeconds ?? 30;
  const unrestricted = input.useBuildRegions === false;
  const regions = unrestricted
    ? (input.unlockedRegions ?? [...REGION_IDS])
    : unlockedRegions(input.build);
  const includeUnknownAvailability =
    input.includeUnknownAvailability ?? (unrestricted ? true : undefined);

  const sizes = clampSolverBarSizes(
    input.minBarSize ?? MIN_SOLVER_BAR_SIZE,
    input.maxBarSize ?? DEFAULT_MAX_BAR_SIZE,
  );

  return defaultSerializableRequest({
    loadout: packSimBase(input.stats, input.loadout),
    style,
    durationTicks: Math.max(secondsToTicks(durationSeconds), OBJECTIVE_HORIZON_TICKS),
    exploreDurationTicks: secondsToTicks(exploreSeconds),
    seed: input.seed ?? 1,
    tier: input.tier ?? "thorough",
    profileId: input.profileId ?? "balanced",
    customWeights: input.customWeights,
    minBarSize: sizes.minBarSize,
    maxBarSize: sizes.maxBarSize,
    includePartial: input.includePartial,
    includeUnknownAvailability,
    disabledAbilityIds: input.disabledAbilityIds,
    unlockedRegions: regions as RegionId[],
    blessingPicks: input.build.blessingPicks as readonly BlessingPath[],
    ruleset: input.stats.league.ruleset,
    now,
    authoredSeedBars: staticSeedBars(style),
    userBar: input.userBar,
  });
}
