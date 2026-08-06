import type { BuildState, RegionId } from "@/league";
import { REGION_IDS, unlockedRegions } from "@/league";
import type { BlessingPath } from "@/league/blessings";
import { secondsToTicks } from "../core/ticks";
import type { ActiveEquipmentEffects } from "../shared/equipment";
import type { AdrenalineRules, ProcRules } from "../engine/simulation/contracts";
import type { HitCapRule } from "../core/hitCaps";
import type { CombatContext, CombatStyle } from "../types";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { weaponConfigurationFromBarSetup } from "../styles/melee/abilities";
import { engineSpecs } from "../abilities/registry";
import {
  defaultSerializableRequest,
  type AuthoredSeedBar,
  type SerializableLeagueRules,
  type SerializableModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverSearchTier,
} from "./worker/serializable";
import type { ObjectiveProfileId, ObjectiveWeights } from "./contracts";
import { ABSOLUTE_MAX_BAR_SIZE, clampSolverBarSizes, MIN_SOLVER_BAR_SIZE } from "./barPolicy";
import { TIER_HORIZON_SECONDS } from "./solve";
import type { ResolvedCombatModel } from "../model/contracts";
import { resolveModifierSourcesFromHost } from "../model/modifierSources";
import { projectSerializableSimBase } from "../model/simulationInput";
import type { PlayerPoisonProfile } from "../poison/mechanics";
import type { StyleAmmoId } from "../styles/ranged/ammoModel";

/**
 * Neutral combat-domain snapshot for solver packing.
 * Built by the UI adapter (or tests) - never imports components/CalcStats/Loadout.
 */
export interface SolverPackSnapshot {
  base: number;
  level: number;
  overrideBase?: number;
  overrideLevel?: number;
  activateNaragiAtStart?: boolean;
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
  ammo?: StyleAmmoId;
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  tumekensPieces?: number;
  tumekensCritEnabled?: boolean;
  equipmentEffects: ActiveEquipmentEffects;
  league: SerializableLeagueRules;
  context?: CombatContext;
  targetHpPercent?: number;
  playerPoison?: PlayerPoisonProfile;
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
  slayerHelmet?: SerializableModifierSources["slayerHelmet"];
  salve?: SerializableModifierSources["salve"];
  ultimatums?: number;
  lunging?: number;
  caroming?: number;
  /** Precomputed Berserker's Fury damage bonus fraction; 0 / omit = off. */
  berserkersFuryBonus?: number;
  /** Precomputed set counts; when omitted derived from equipmentSlots + equipmentIds. */
  setCounts?: readonly (readonly [string, number])[];
}

export interface PackSolverRequestInput {
  /**
   * Preferred: already-resolved combat model (no UI re-derive).
   * When set, loadout sim base is projected from the model; snapshot is ignored.
   */
  model?: ResolvedCombatModel;
  /**
   * Temporary / test path: neutral snapshot (may reassemble modifierSources).
   * Required when model is omitted.
   */
  snapshot?: SolverPackSnapshot;
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
  return resolveModifierSourcesFromHost({
    setCounts: snapshot.setCounts,
    equipmentSlots: snapshot.equipmentSlots,
    equipmentIds: snapshot.equipmentIds,
    vulnerability: snapshot.vulnerability,
    styleCurseId: snapshot.styleCurseId,
    amZiFlatDamage: snapshot.amZiFlatDamage,
    amHejDamageBonus: snapshot.amHejDamageBonus,
    slayer: snapshot.slayer,
    target: snapshot.target,
    slayerHelmet: snapshot.slayerHelmet,
    salve: snapshot.salve,
    ultimatums: snapshot.ultimatums,
    lunging: snapshot.lunging,
    caroming: snapshot.caroming,
    berserkersFuryBonus: snapshot.berserkersFuryBonus,
  });
}

/** Pack a structured-clone-safe sim base from a neutral combat snapshot. */
export function packSimBase(snapshot: SolverPackSnapshot): SerializableRevolutionSimBase {
  return {
    base: snapshot.base,
    level: snapshot.level,
    ...(snapshot.overrideBase != null ? { overrideBase: snapshot.overrideBase } : {}),
    ...(snapshot.overrideLevel != null ? { overrideLevel: snapshot.overrideLevel } : {}),
    ...(snapshot.activateNaragiAtStart === true ? { activateNaragiAtStart: true } : {}),
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
    ammo: snapshot.ammo,
    caromingRank: snapshot.caroming,
    conjureBasicDamageMult: snapshot.conjureBasicDamageMult,
    conjureDurationMult: snapshot.conjureDurationMult,
    tumekensPieces: snapshot.tumekensPieces,
    tumekensCritEnabled: snapshot.tumekensCritEnabled,
    equipmentEffects: snapshot.equipmentEffects,
    league: snapshot.league,
    context: snapshot.context,
    targetHpPercent: snapshot.targetHpPercent,
    playerPoison: snapshot.playerPoison ? { ...snapshot.playerPoison } : undefined,
    cap: snapshot.cap,
    startingAdrenaline: snapshot.startingAdrenaline,
    equipmentIds: snapshot.equipmentIds,
    weaponConfiguration: snapshot.weaponConfiguration,
    modifierSources: modifierSourcesFrom(snapshot),
  };
}

/**
 * Preferred pack path: ResolvedCombatModel already holds modifierSources + league freeze.
 * No re-derive from equipment slots / Loadout perks.
 */
export function packSimBaseFromModel(model: ResolvedCombatModel): SerializableRevolutionSimBase {
  return projectSerializableSimBase(model);
}

/** Resolve request loadout from model (preferred) or snapshot (compat). */
export function resolvePackSimBase(input: {
  model?: ResolvedCombatModel;
  snapshot?: SolverPackSnapshot;
}): SerializableRevolutionSimBase {
  if (input.model) return packSimBaseFromModel(input.model);
  if (input.snapshot) return packSimBase(input.snapshot);
  throw new Error("packSolverRequest requires model or snapshot");
}

function staticSeedBars(
  style: CombatStyle,
  weaponConfiguration?: SerializableRevolutionSimBase["weaponConfiguration"],
): AuthoredSeedBar[] {
  return combatRevolutionBars.records
    .filter((b) => b.style === style && b.supported && (b.target == null || b.target === "single"))
    .map((b) => {
      // Prefer loadout shape; fall back to wiki bar setup for Adaptive form.
      const shape = weaponConfiguration ?? weaponConfigurationFromBarSetup(b.setup);
      const ids = revoManagedSlots(b, engineSpecs, shape)
        .filter((s) => s.modelledBy === "engine" && s.spec)
        .map((s) => s.spec!.id);
      return { id: b.id, abilityIds: ids, baseline: b.mode === "revo++" };
    })
    .filter((s) => s.abilityIds.length > 0);
}

/** Prepend wiki early-bar conjure_* when a necro authored seed omitted all summons. */
function ensureNecroConjuresOnSeedIds(
  abilityIds: readonly string[],
  style: CombatStyle,
  weaponConfiguration?: SerializableRevolutionSimBase["weaponConfiguration"],
): string[] {
  if (style !== "necromancy") return [...abilityIds];
  if (abilityIds.some((id) => id.startsWith("conjure_"))) return [...abilityIds];
  const seeds = staticSeedBars(style, weaponConfiguration);
  const baseline = seeds.find((s) => s.baseline) ?? seeds[0];
  const conjures =
    baseline?.abilityIds.filter((id) => id.startsWith("conjure_")) ??
    (["conjure_undead_army"] as const);
  const existing = new Set(abilityIds);
  const inject = conjures.filter((id) => !existing.has(id));
  return inject.length === 0 ? [...abilityIds] : [...inject, ...abilityIds];
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

  const simBase = resolvePackSimBase(input);
  const ruleset = input.model?.league.ruleset ?? input.snapshot?.league.ruleset ?? "base";
  const wc = simBase.weaponConfiguration;
  const authoredSeedBars = staticSeedBars(style, wc).map((s) => ({
    ...s,
    abilityIds: ensureNecroConjuresOnSeedIds(s.abilityIds, style, wc),
  }));
  // userBar is first-class incumbent: never inject conjures (seeds only).
  const userBar = input.userBar != null ? [...input.userBar] : undefined;

  return defaultSerializableRequest({
    loadout: simBase,
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
    ruleset,
    now,
    authoredSeedBars,
    userBar,
  });
}
