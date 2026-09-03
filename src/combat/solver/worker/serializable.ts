import {
  SOLVER_SCHEMA_VERSION,
  type AbilityCategory,
  type ObjectiveProfileId,
  type ObjectiveWeights,
  type ProofLabel,
  type SearchTier,
} from "../contracts";
import type {
  AdrenalineRules,
  PlayerVitalityInput,
  ProcRules,
} from "../../engine/simulation/contracts";
import type { HitCapRule } from "../../core/hitCaps";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import type {
  ActiveBlessingTierPassive,
  BlessingChoice,
  BlessingId,
  BlessingPath,
} from "@/league/blessings";
import type { RegionId } from "@/league";
import type { CombatContext, CombatStyle } from "../../types";
import type { PlayerPoisonProfile } from "../../poison/mechanics";
import type { ResolvedRangedAmmunitionProfile } from "../../styles/ranged/ammunitionProfile";
import type { EnchantedBoltChanceModifiers } from "../../styles/ranged/enchantedBolt";
import type { ResolvedTargetAccuracyProfile } from "../../target/genericTarget";
import type { TrueEquilibriumResolution } from "../../league/ruleset";
import type { MagicCombatSpell } from "../../styles/magic/ancientSpells";

export { SOLVER_SCHEMA_VERSION };
export type { AbilityCategory };

export type SolverSearchTier = SearchTier;

/**
 * Data needed to rebuild cast modifiers without shipping function closures across
 * the worker boundary. Mirrors the non-function parts of loadoutStats' modifier
 * assembly (vulnerability, curses, equipment flats, sets, slayers, per-cast perks).
 */
export interface SerializableSlayerHelmetSource {
  tierId: "full" | "reinforced" | "strong" | "mighty" | "corrupted";
  source: "equipped" | "stand";
  damageMult: number;
}

export interface SerializableSalveSource {
  variantId: "salve" | "salve-e";
  damageMult: number;
}

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
    elementalWeakness?: "water" | "fire" | "other" | "unknown";
    dragonfireImmune?: boolean;
  };
  /** Pre-resolved Full Slayer Helmet on-hit damage (host resolve; never re-equip). */
  slayerHelmet?: SerializableSlayerHelmetSource | null;
  /** Pre-resolved Salve on-hit damage (host resolve from amulet slot). */
  salve?: SerializableSalveSource | null;
  ultimatums: number;
  lunging: number;
  /** Caroming rank 1-4 (weapon gizmo); 0 = off. */
  caroming?: number;
  /** Flanking rank; only applies when flankingActive. */
  flanking?: number;
  /** True when the loadout asserts the target is not facing the player. */
  flankingActive?: boolean;
  /** Shield Bashing rank (Debilitate only when that ability exists). */
  shieldBashing?: number;
  /** Spendthrift rank (EV extra damage). */
  spendthrift?: number;
  /** Ruthless rank; stacks in ruthlessStacks. */
  ruthless?: number;
  /** Ruthless kill stacks 0-5 at fight open. */
  ruthlessStacks?: number;
  /**
   * Precomputed Berserker's Fury damage bonus fraction (0.03 = +3%).
   * 0 / omit = inactive. Resolved on the host from LP vs max (incl. Powerburst).
   */
  berserkersFuryBonus?: number;
}

/** ResolvedLeagueRules with blessingIds as an array so structuredClone works. */
export interface SerializableLeagueRules {
  ruleset: "base" | "equilibrium";
  blessings: readonly BlessingChoice[];
  tierPassives?: readonly ActiveBlessingTierPassive[];
  blessingIds: readonly BlessingId[];
  /** Active relic display names. */
  relics?: readonly string[];
  totalArmour: number;
  offhandArmourValue?: number;
  defenceLevel?: number;
  maximumLife: number;
  /** Frozen remaining Powerburst until-tick (half-open); 0 = inactive. */
  powerburstUntilTick: number;
  targetSize: number;
  occupiedTiles: number;
  areaTargets?: number;
  prayerBonus?: number;
  trueEquilibrium?: TrueEquilibriumResolution;
  herbloreLevel?: number;
}

/**
 * Precomputed simulation numbers for the worker (preferred over shipping a full
 * Loadout / React-adjacent graph). Reconstruct modifiers via modifierSources.
 */
export interface SerializableRevolutionSimBase {
  base: number;
  magicSpell?: MagicCombatSpell;
  poisonBase?: number;
  level: number;
  /** Base AD while temporary level override is active (Naragi 255). */
  overrideBase?: number;
  poisonOverrideBase?: number;
  overrideLevel?: number;
  /** Activate Sliver of Edicts at combat start. */
  activateNaragiAtStart?: boolean;
  accuracy: number;
  targetAccuracyProfile?: ResolvedTargetAccuracyProfile;
  crit: {
    chance: number;
    disabled?: boolean;
    damageBonus?: number;
    critualConvertedDamageBonus?: number;
    guaranteed?: boolean;
  };
  adrenaline?: AdrenalineRules;
  procs?: ProcRules;
  plantedFeet?: boolean;
  /** Strength cape (99): extend Dismember by three bleed hits in the worker catalogue. */
  strengthCape99?: boolean;
  preciseRank?: number;
  ammunition?: ResolvedRangedAmmunitionProfile | null;
  enchantedBoltChanceModifiers?: EnchantedBoltChanceModifiers;
  /** Caroming rank 1-4 for Ricochet band construction. */
  caromingRank?: number;
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  tumekensPieces?: number;
  equipmentEffects: ActiveEquipmentEffects;
  nativeSpecialPolicy?: {
    useEquippedWeaponSpecial: boolean;
    afterAbilityId?: string | null;
  };
  /** EoF stored special ability id; required with Essence of Finality for gated specials. */
  eofStoredSpecialId?: string | null;
  league: SerializableLeagueRules;
  context?: CombatContext;
  targetHpPercent?: number;
  targetMaximumLifePoints?: number;
  playerVitality?: PlayerVitalityInput;
  playerPoison?: PlayerPoisonProfile;
  targetPoisonImmune?: boolean;
  /** Barkscales / Icyenic / Revenge incoming auto cadence (seconds). */
  incomingHitIntervalSeconds?: number;
  cap?: HitCapRule;
  startingAdrenaline?: number;
  naturalInstinctUntilTick?: number;
  startingResidualSouls?: number;
  slayerOnTask?: boolean;
  slayerLevel?: number;
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
    caroming: number;
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
    weaponPoison?: PlayerPoisonProfile["potion"];
    kwuarmPotency?: PlayerPoisonProfile["kwuarmPotency"];
    herbloreLevel?: number;
  };
  target?: {
    hpPercent?: number;
    maximumLifePoints?: number;
    demon?: boolean;
    dragon?: boolean;
    undead?: boolean;
    poisonImmune?: boolean;
    elementalWeakness?: "water" | "fire" | "other" | "unknown";
    dragonfireImmune?: boolean;
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
 * Full solve request - structured-clone safe, no React, no function closures.
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
  /** Ownership / availability overrides - these ability ids are treated as locked out. */
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
  /**
   * Parallel-agent search recipe (set by the pool).
   * default | evolutionary (agent 1) | anneal_local (agent 2, unhinged).
   */
  agentRecipe?: "default" | "evolutionary" | "anneal_local";
}

/** Proof note when search found no full-horizon upgrade over the current bar. */
export const CURRENT_BAR_REMAINS_BEST_NOTE = "current bar remains best";

/**
 * Explicit honesty contract for consumers (Apply, chrome, merge).
 * Always set by buildSolverResultDto; do not invent on exploratory previews.
 */
export interface SolverResultHonestyDTO {
  status: "ok" | "degraded" | "failed";
  fullyValidated: boolean;
  beatsBar: boolean;
  stochasticExactness: string | null;
  residualMass: number;
  currentBarScore: number;
  proposedBarScore: number;
  improvement: number;
  applyAllowed: boolean;
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
  /**
   * Exact solve-job identity payload that produced this result
   * (`solveContextPayload(request)` / stable stringify of canonicalSolveContext).
   * Used to reject cache hits when request context diverges.
   */
  solveIdentity: string;
  proofLabel?: ProofLabel;
  /**
   * Honesty surface: status, validation, residual, bar compare, Apply.
   * Prefer these over digging through proof notes for gates.
   */
  honesty?: SolverResultHonestyDTO;
  /** Winner stochastic metadata when disclosed. */
  rng?: {
    residualWeight?: number;
    exactness?: string;
  };
  /** Best exploratory (search-horizon) score seen - not mixed with full robust. */
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
  /**
   * Phase 5 incumbent comparison (baseline = current user bar).
   * Always emitted from buildSolverResultDto when SolveResult carries them.
   * Aliases: currentBarScore -> baselineScore; proposedBarScore -> winnerScore.
   */
  baselineBar?: readonly string[] | null;
  baselineScore?: number;
  winnerScore?: number;
  scoreImprovement?: number;
  percentImprovement?: number | null;
  /** Explicit false: current bar remains best; Apply stays disabled. */
  isUpgrade?: boolean;
  /** True only for an upgrade with a full-rankable best. */
  validForApply?: boolean;
  /** Optional compact summary; may carry residual/exactness for proof chrome. */
  summary?: {
    totalExpected: number;
    dps: number;
    ticks: number;
    ok: boolean;
    error?: string;
    rng?: {
      residualWeight?: number;
      exactness?: string;
      failedWeight?: number;
      probabilityMass?: number;
    };
    failure?: {
      failedWeight?: number;
      successfulWeight?: number;
      totalsScope?: string;
      primaryReason?: string;
    };
  };
  proof?: SolverProofDTO;
  top?: readonly {
    bar: readonly string[];
    score: number;
    fingerprint?: string;
  }[];
  /**
   * Phase-0 parallel pool instrumentation (optional; set by SolverAgentPool only).
   * See protocol.SolverPoolMetrics for field meanings.
   */
  poolMetrics?: import("./protocol").SolverPoolMetrics;
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
    slayerHelmet: null,
    salve: null,
    ultimatums: 0,
    lunging: 0,
    caroming: 0,
    flanking: 0,
    flankingActive: false,
    shieldBashing: 0,
    spendthrift: 0,
    ruthless: 0,
    ruthlessStacks: 0,
    berserkersFuryBonus: 0,
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
    maxBarSize: 11,
    minBarSize: 4,
    permittedCategories: ["basic", "enhanced", "threshold", "ultimate"],
    unlockedRegions: [],
    blessingPicks: [],
    ruleset: "base",
    now: 0,
    authoredSeedBars: [],
    ...partial,
  };
}
