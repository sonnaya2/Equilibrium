import {
  SOLVER_SCHEMA_VERSION,
  type AbilityCategory,
  type ObjectiveProfileId,
  type ObjectiveWeights,
  type ProofLabel,
  type SearchTier,
} from "../contracts";
import type { AdrenalineRules, ProcRules } from "../../engine/simulation/contracts";
import type { HitCapRule } from "../../core/hitCaps";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import type { BlessingChoice, BlessingId, BlessingPath } from "@/league/blessings";
import type { RegionId } from "@/league";
import type { CombatContext, CombatStyle } from "../../types";

export { SOLVER_SCHEMA_VERSION };
export type { AbilityCategory };

export type SolverSearchTier = SearchTier;

/**
 * Data needed to rebuild cast modifiers without shipping function closures across
 * the worker boundary. Mirrors the non-function parts of loadoutStats' modifier
 * assembly (vulnerability, curses, equipment flats, sets, slayers, per-cast perks).
 */
export interface SerializableModifierSources {
  vulnerability: boolean;
  /** Style curse id, or omit / "none" when inactive. */
  styleCurseId?: string | "none";
  amZiFlatDamage: number;
  amHejDamageBonus: number;
  /** Equipped set id → piece count pairs. */
  setCounts: readonly (readonly [string, number])[];
  slayer: {
    demon: number;
    dragon: number;
    undead: number;
  };
  target: {
    demon?: boolean;
    dragon?: boolean;
    undead?: boolean;
  };
  ultimatums: number;
  lunging: number;
}

/** ResolvedLeagueRules with blessingIds as an array so structuredClone works. */
export interface SerializableLeagueRules {
  ruleset: "base" | "equilibrium";
  blessings: readonly BlessingChoice[];
  blessingIds: readonly BlessingId[];
  totalArmour: number;
  maximumLife: number;
  /** Frozen remaining Powerburst until-tick (half-open); 0 = inactive. */
  powerburstUntilTick: number;
  targetTiles: number;
}

/**
 * Precomputed simulation numbers for the worker (preferred over shipping a full
 * Loadout / React-adjacent graph). Reconstruct modifiers via modifierSources.
 */
export interface SerializableRevolutionSimBase {
  base: number;
  level: number;
  accuracy: number;
  crit: {
    chance: number;
    disabled?: boolean;
    damageBonus?: number;
    guaranteed?: boolean;
  };
  adrenaline?: AdrenalineRules;
  procs?: ProcRules;
  plantedFeet?: boolean;
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
  weaponConfiguration: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";
  modifierSources: SerializableModifierSources;
  /**
   * Ability catalogue ids available to the worker (resolved against engine specs
   * on the worker side). Prefer ids over full AbilitySpec payloads.
   */
  abilityIds?: readonly string[];
}

/**
 * Minimal plain loadout snapshot for callers that have not precomputed sim
 * numbers yet. Worker-side search still prefers SerializableRevolutionSimBase.
 */
export interface SerializableLoadoutPlain {
  kind: "loadout";
  style: CombatStyle;
  equipmentSlots?: Partial<Record<string, string | null>>;
  equipmentIds?: readonly string[];
  perks?: Partial<{
    equilibrium: number;
    biting: number;
    bitingLevel20: boolean;
    invigorating: number;
    impatient: number;
    impatientLevel20: boolean;
    ultimatums: number;
    lunging: number;
    energising: number;
    crackling: number;
    aftershock: number;
    relentless: number;
    relentlessLevel20: boolean;
    precise: number;
    plantedFeet: number;
    demonSlayer: number;
    dragonSlayer: number;
    undeadSlayer: number;
  }>;
  buffs?: {
    vulnerability?: boolean;
    styleCurse?: string;
  };
  target?: {
    hpPercent?: number;
    demon?: boolean;
    dragon?: boolean;
    undead?: boolean;
  };
  startingAdrenaline?: number;
  base?: number;
  level?: number;
  accuracy?: number;
  critChance?: number;
}

export type SolverLoadoutPayload = SerializableRevolutionSimBase | SerializableLoadoutPlain;

export function isSerializableSimBase(
  value: SolverLoadoutPayload | unknown,
): value is SerializableRevolutionSimBase {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.base === "number" &&
    typeof v.level === "number" &&
    typeof v.accuracy === "number" &&
    v.modifierSources !== undefined &&
    v.equipmentEffects !== undefined &&
    v.league !== undefined &&
    !("kind" in v && v.kind === "loadout")
  );
}

export interface AuthoredSeedBar {
  id: string;
  abilityIds: readonly string[];
  baseline: boolean;
}

/**
 * Full solve request — structured-clone safe, no React, no function closures.
 * Prefer loadout as SerializableRevolutionSimBase so the worker never imports UI.
 */
export interface SerializableSolverRequest {
  schemaVersion: number;
  seed: number;
  tier: SolverSearchTier;
  profileId: ObjectiveProfileId;
  customWeights?: ObjectiveWeights;
  maxBarSize: number;
  minBarSize: number;
  style: CombatStyle;
  permittedCategories?: readonly AbilityCategory[];
  includePartial?: boolean;
  includeUnknownAvailability?: boolean;
  /** Ownership / availability overrides — these ability ids are treated as locked out. */
  disabledAbilityIds?: readonly string[];
  unlockedRegions: readonly RegionId[];
  /** Final evaluation horizon in ticks. */
  durationTicks: number;
  /** Shorter early-search horizon; falls back to durationTicks when omitted. */
  exploreDurationTicks?: number;
  loadout: SolverLoadoutPayload;
  blessingPicks: readonly BlessingPath[];
  ruleset: "base" | "equilibrium";
  now: number;
  authoredSeedBars: readonly AuthoredSeedBar[];
  userBar?: readonly string[];
}

/** Cloneable solver result (no Maps/Sets/functions). */
export interface SolverResultDTO {
  bar: readonly string[];
  score: number;
  windowDpms: number;
  evaluations: number;
  uniqueCandidates: number;
  seed: number;
  profileId: ObjectiveProfileId;
  tier: SolverSearchTier;
  durationTicks: number;
  proofLabel?: ProofLabel;
  /** Best exploratory (search-horizon) score seen — not mixed with full robust. */
  bestExploratoryScore?: number;
  /** Best full-horizon robust score seen (winner scale when finalize ran). */
  bestFullScore?: number;
  openingDpm?: number;
  developedDpm?: number;
  steadyDpm?: number;
  /**
   * Human-readable league assumptions for the scored loadout (e.g. Big Boned
   * per-hit outgoing damage model).
   */
  assumptions?: readonly string[];
  /** Optional compact summary numbers for the winning bar. */
  summary?: {
    totalExpected: number;
    dps: number;
    ticks: number;
    ok: boolean;
    error?: string;
  };
  proof?: SolverProofDTO;
  top?: readonly {
    bar: readonly string[];
    score: number;
    fingerprint?: string;
  }[];
}

export interface SolverProofDTO {
  /** Deterministic fingerprint of the winning evaluation inputs. */
  inputHash?: string;
  /** Expected score re-check after final eval; used for host-side sanity. */
  recheckScore?: number;
  label?: ProofLabel;
  notes?: readonly string[];
}

export function emptyModifierSources(): SerializableModifierSources {
  return {
    vulnerability: false,
    styleCurseId: "none",
    amZiFlatDamage: 0,
    amHejDamageBonus: 0,
    setCounts: [],
    slayer: { demon: 0, dragon: 0, undead: 0 },
    target: {},
    ultimatums: 0,
    lunging: 0,
  };
}

export function defaultSerializableRequest(
  partial: Partial<SerializableSolverRequest> &
    Pick<SerializableSolverRequest, "loadout" | "style" | "durationTicks">,
): SerializableSolverRequest {
  return {
    schemaVersion: SOLVER_SCHEMA_VERSION,
    seed: 1,
    tier: "thorough",
    profileId: "balanced",
    maxBarSize: 10,
    minBarSize: 6,
    permittedCategories: ["basic", "enhanced", "ultimate"],
    unlockedRegions: [],
    blessingPicks: [],
    ruleset: "base",
    now: 0,
    authoredSeedBars: [],
    ...partial,
  };
}
