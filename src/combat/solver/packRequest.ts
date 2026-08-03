import type { BuildState, RegionId } from "@/league";
import { REGION_IDS, unlockedRegions } from "@/league";
import type { BlessingPath } from "@/league/blessings";
import { secondsToTicks } from "../core/ticks";
import { equippedSetCounts } from "../shared/equipment";
import type { ActiveEquipmentEffects } from "../shared/equipment";
import type { AdrenalineRules, ProcRules } from "../engine/simulation/contracts";
import type { HitCapRule } from "../core/hitCaps";
import type { CombatContext, CombatStyle } from "../types";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { engineSpecs } from "../abilities/registry";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  type AuthoredSeedBar,
  type SerializableLeagueRules,
  type SerializableModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverSearchTier,
} from "./worker/serializable";
import type { ObjectiveProfileId, ObjectiveWeights } from "./contracts";
import {
  ABSOLUTE_MAX_BAR_SIZE,
  clampSolverBarSizes,
  MIN_SOLVER_BAR_SIZE,
} from "./barPolicy";
import { TIER_HORIZON_SECONDS } from "./solve";

/**
 * Neutral combat-domain snapshot for solver packing.
 * Built by the UI adapter (or tests) - never imports components/CalcStats/Loadout.
 */
export interface SolverPackSnapshot {
  base: number;
  level: number;
  accuracy: number;
  crit: {
    chance: number;
    disabled?: boolean;
    damageBonus?: number;
  };
  adrenaline?: AdrenalineRules;
  procs?: ProcRules;
  plantedFeet?: boolean;
  strengthCape99?: boolean;
  preciseRank?: number;
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  tumekensPieces?: number;
  tumekensCritEnabled?: boolean;
  equipmentEffects: ActiveEquipmentEffects;
  league: SerializableLeagueRules;
  context?: CombatContext;
  targetHpPercent?: number;
  cap?: HitCapRule;
  startingAdrenaline?: number;
  equipmentIds: readonly string[];
  weaponConfiguration: SerializableRevolutionSimBase["weaponConfiguration"];
  /** Slot map used to derive set piece counts when setCounts is omitted. */
  equipmentSlots?: Partial<Record<string, string | null>>;
  vulnerability?: boolean;
  styleCurseId?: string | "none";
  amZiFlatDamage?: number;
  amHejDamageBonus?: number;
  slayer?: { demon: number; dragon: number; undead: number };
  target?: { demon?: boolean; dragon?: boolean; undead?: boolean };
  ultimatums?: number;
  lunging?: number;
  /** Precomputed Berserker's Fury damage bonus fraction; 0 / omit = off. */
  berserkersFuryBonus?: number;
  /** Precomputed set counts; when omitted derived from equipmentSlots + equipmentIds. */
  setCounts?: readonly (readonly [string, number])[];
}

export interface PackSolverRequestInput {
  snapshot: SolverPackSnapshot;
  style: CombatStyle;
  build: BuildState;
  tier?: SolverSearchTier;
  profileId?: ObjectiveProfileId;
  customWeights?: ObjectiveWeights;
  seed?: number;
  maxBarSize?: number;
  minBarSize?: number;
  includePartial?: boolean;
  includeUnknownAvailability?: boolean;
  disabledAbilityIds?: readonly string[];
  /** Final exact horizon seconds (default: tier fullSeconds). */
  durationSeconds?: number;
  /** Explore horizon seconds (default: tier exploreSeconds). */
  exploreSeconds?: number;
  userBar?: readonly string[];
  now?: number;
  useBuildRegions?: boolean;
  /** Extra unlocked regions when not using build. */
  unlockedRegions?: readonly RegionId[];
}

function modifierSourcesFrom(snapshot: SolverPackSnapshot): SerializableModifierSources {
  const setCounts: (readonly [string, number])[] =
    snapshot.setCounts != null
      ? [...snapshot.setCounts]
      : [
          ...equippedSetCounts({
            equipmentSlots: snapshot.equipmentSlots,
            equipmentIds: [...snapshot.equipmentIds],
          }).entries(),
        ].map(([setId, pieces]) => [setId, pieces] as const);

  return {
    ...emptyModifierSources(),
    vulnerability: snapshot.vulnerability === true,
    styleCurseId: snapshot.styleCurseId ?? "none",
    amZiFlatDamage: snapshot.amZiFlatDamage ?? 0,
    amHejDamageBonus: snapshot.amHejDamageBonus ?? 0,
    setCounts,
    slayer: {
      demon: snapshot.slayer?.demon ?? 0,
      dragon: snapshot.slayer?.dragon ?? 0,
      undead: snapshot.slayer?.undead ?? 0,
    },
    target: {
      demon: snapshot.target?.demon,
      dragon: snapshot.target?.dragon,
      undead: snapshot.target?.undead,
    },
    ultimatums: snapshot.ultimatums ?? 0,
    lunging: snapshot.lunging ?? 0,
    berserkersFuryBonus:
      typeof snapshot.berserkersFuryBonus === "number" &&
      Number.isFinite(snapshot.berserkersFuryBonus) &&
      snapshot.berserkersFuryBonus > 0
        ? snapshot.berserkersFuryBonus
        : 0,
  };
}

/** Pack a structured-clone-safe sim base from a neutral combat snapshot. */
export function packSimBase(snapshot: SolverPackSnapshot): SerializableRevolutionSimBase {
  return {
    base: snapshot.base,
    level: snapshot.level,
    accuracy: snapshot.accuracy,
    crit: {
      chance: snapshot.crit.chance,
      disabled: snapshot.crit.disabled,
      damageBonus: snapshot.crit.damageBonus,
    },
    adrenaline: snapshot.adrenaline,
    procs: snapshot.procs,
    plantedFeet: snapshot.plantedFeet,
    strengthCape99: snapshot.strengthCape99,
    preciseRank: snapshot.preciseRank,
    conjureBasicDamageMult: snapshot.conjureBasicDamageMult,
    conjureDurationMult: snapshot.conjureDurationMult,
    tumekensPieces: snapshot.tumekensPieces,
    tumekensCritEnabled: snapshot.tumekensCritEnabled,
    equipmentEffects: snapshot.equipmentEffects,
    league: snapshot.league,
    context: snapshot.context,
    targetHpPercent: snapshot.targetHpPercent,
    cap: snapshot.cap,
    startingAdrenaline: snapshot.startingAdrenaline,
    equipmentIds: snapshot.equipmentIds,
    weaponConfiguration: snapshot.weaponConfiguration,
    modifierSources: modifierSourcesFrom(snapshot),
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

/** Pack a structured-clone-safe solver request from a neutral combat snapshot. */
export function packSolverRequest(input: PackSolverRequestInput): SerializableSolverRequest {
  // Freeze once per request - never re-sample Date.now() per evaluation.
  const now = input.now ?? Date.now();
  const style = input.style;
  const tier = input.tier ?? "thorough";
  const horizons = TIER_HORIZON_SECONDS[tier] ?? TIER_HORIZON_SECONDS.thorough;
  const durationSeconds = input.durationSeconds ?? horizons.fullSeconds;
  const exploreSeconds = input.exploreSeconds ?? horizons.exploreSeconds;
  const unrestricted = input.useBuildRegions === false;
  const regions = unrestricted
    ? (input.unlockedRegions ?? [...REGION_IDS])
    : unlockedRegions(input.build);
  const includeUnknownAvailability =
    input.includeUnknownAvailability ?? (unrestricted ? true : undefined);

  // Honor explicit size bounds (clamped to product floor/ceiling).
  const sizes = clampSolverBarSizes(
    input.minBarSize ?? MIN_SOLVER_BAR_SIZE,
    input.maxBarSize ?? ABSOLUTE_MAX_BAR_SIZE,
  );

  return defaultSerializableRequest({
    loadout: packSimBase(input.snapshot),
    style,
    durationTicks: Math.max(1, secondsToTicks(durationSeconds)),
    exploreDurationTicks: Math.max(1, secondsToTicks(exploreSeconds)),
    seed: input.seed ?? 1,
    tier,
    profileId: input.profileId ?? "balanced",
    customWeights: input.customWeights,
    minBarSize: sizes.minBarSize,
    maxBarSize: sizes.maxBarSize,
    includePartial: input.includePartial,
    includeUnknownAvailability,
    disabledAbilityIds: input.disabledAbilityIds,
    unlockedRegions: regions as RegionId[],
    blessingPicks: input.build.blessingPicks as readonly BlessingPath[],
    ruleset: input.snapshot.league.ruleset,
    now,
    authoredSeedBars: staticSeedBars(style),
    userBar: input.userBar,
  });
}
