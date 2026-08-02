import type { CritLayers } from "../../core/critical";
import type { HitCapRule } from "../../core/hitCaps";
import type { AbilityResult, AbilitySpec } from "../../pipeline/calculateAbility";
import type { CombatContext, CombatModifier } from "../../types";
import type { ResolvedEvent } from "../runtime/events";
import type { RotationState } from "../runtime/state";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import type { ResolvedLeagueRules } from "../../league/ruleset";

/** One queued cast; the simulator advances to its first legal tick. */
export interface RotationAction {
  abilityId: string;
}

export function rotationOf(...abilityIds: string[]): RotationAction[] {
  return abilityIds.map((abilityId) => ({ abilityId }));
}

export interface AdrenalineRules {
  /** Multiplier on listed ability gains; does not affect refunds or unrelated grants. */
  abilityGainMultiplier?: number;
  basicGainMultiplier?: number;
  /** Impatient perk rank (1-4) — state-changing RNG, branched by the drivers. */
  impatientRank?: number;
  impatientLevel20?: boolean;
  /** Relentless perk rank (1-5) — state-changing RNG, branched by the drivers. */
  relentlessRank?: number;
  relentlessLevel20?: boolean;
}

/**
 * Explicit outcomes for a cast's state-changing RNG points. The drivers
 * enumerate these to build probability-weighted branches; a missing flag means
 * "does not proc" (deterministic single-branch runs never proc).
 */
export type CastRngPointId = "impatient" | "relentless" | "avernic-rampage";
export type CastRng = Readonly<Partial<Record<CastRngPointId, boolean>>>;

export function rngProc(rng: CastRng | undefined, id: CastRngPointId): boolean {
  return rng?.[id] === true;
}

export interface ProcRules {
  cracklingRank?: number;
  aftershockRank?: number;
}

export interface SimulateInput {
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  abilities: readonly AbilitySpec[];
  rotation: readonly RotationAction[];
  modifiers?: CombatModifier[] | ((ability: AbilitySpec) => CombatModifier[]);
  context?: CombatContext;
  cap?: HitCapRule;
  /** Adrenaline available before the first cast. */
  startingAdrenaline?: number;
  /** Equipped catalogue ids used by mechanics with verified item requirements. */
  equipmentIds?: readonly string[];
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";
  /** Puncture damage is outside the current model. */
  ammo?: "deathspore" | "splintering";
  /** Weave the style auto-attack through idle GCDs and adrenaline shortfalls. */
  autoWeave?: boolean;
  adrenaline?: AdrenalineRules;
  /**
   * Planted Feet: base Sunshine / Death's Swiftness duration ×1.25 (→ 63 ticks).
   * Does not apply to greater variants.
   */
  plantedFeet?: boolean;
  /** Precise perk rank 1–6; raises minimum ability damage before the hit pipeline. */
  preciseRank?: number;
  /** Effective Tumeken count (0-5); its 5.4s activation is assumed complete before tick 0. */
  tumekensPieces?: number;
  /** False when another mechanic (Equilibrium) disables all set crit chance. */
  tumekensCritEnabled?: boolean;
  /** Set bonuses already active before tick 0 for this fixed loadout. */
  equipmentEffects?: ActiveEquipmentEffects;
  league?: ResolvedLeagueRules;
  procs?: ProcRules;
  /**
   * Mult on conjure spirit *basic autos* only (not putrid poison, not commands).
   * First Necromancer set: firstNecromancerConjureDamageMult(pieces). Default 1.
   */
  conjureBasicDamageMult?: number;
  /** Multiplier on the Spirit Pact lifetime, after the 5-tick summon animation. */
  conjureDurationMult?: number;
  /**
   * Target life-points percentage (0-100) for target-HP-dependent mechanics
   * (Bloodlust-empowered Flurry, Punish, Spectral Scythe). When absent those
   * mechanics apply no HP-scaled bonus and stay partially modeled — no default
   * is invented.
   */
  targetHpPercent?: number;
  /** Optional pre-active Natural Instinct window for Jaws adrenaline. */
  naturalInstinctUntilTick?: number;
}

export interface SimulateOptions {
  /**
   * Also compute `totalExpectedIncludingTails`: in-horizon damage plus the
   * still-scheduled (unlanded) tails of casts begun inside the horizon.
   */
  includeTails?: boolean;
}

/** createCastContext input: rotation/autoWeave belong to the manual driver only. */
export type CastContextInput = Omit<SimulateInput, "rotation" | "autoWeave"> & {
  horizonTicks?: number;
};

export interface CastRecord {
  tick: number;
  abilityId: string;
  result: AbilityResult;
  adrenalineAfter: number;
  adrenalineBefore: number;
  listedCost: number;
  effectiveCost: number;
  actualSpend: number;
  refund: number;
  adrenalineGained: number;
  /** Woven basic-attack cast, not part of the queued rotation. */
  auto?: boolean;
}

export type DamageSourceKind =
  | "ability-direct"
  | "ability-dot"
  | "equipment-passive"
  | "league-blessing"
  | "perk"
  | "conjure-or-familiar"
  | "auto-attack"
  | "other-modeled";

export interface DamageSourceBreakdown {
  kind: DamageSourceKind;
  damage: number;
}

export interface DamageEffectBreakdown {
  id: string;
  kind: DamageSourceKind;
  totalDamage: number;
  share: number;
  /** Distinct owning casts (abilities); 0 for pure procs / blessing riders. */
  casts: number;
  /** Probability rolls that produced expected activations (e.g. seven Inferno 5% rolls). */
  triggerRolls: number;
  /** Probability-weighted times the effect occurs. */
  expectedActivations: number;
  /** Probability-weighted separate hits; attached riders contribute 0. */
  expectedSeparateHits: number;
  /** Attached bonus components riding another hit. */
  attachedComponents: number;
  /** Damage tagged as bonus-damage (e.g. Big Boned); 0 when none. */
  bonusDamage: number;
  /** totalDamage / expectedActivations when activations > 0. */
  averagePerActivation: number;
  directDamage: number;
  dotDamage: number;
  criticalContribution: number;
  capLoss: number;
}

export interface RotationDamageAnalysis {
  bySource: DamageSourceBreakdown[];
  byEffect: DamageEffectBreakdown[];
  directDamage: number;
  dotDamage: number;
  criticalContribution: number;
  capLoss: number;
}

/**
 * Duration fields are always explicit. Never treat a bare tick count as both
 * "exact path length" and "E[ticks]" without reading `kind` / `rng`.
 */
export interface DurationSummary {
  /**
   * - deterministic: single path; all tick fields equal the exact length.
   * - stochastic: probability-weighted branches; fields may differ.
   * - fixed-window: horizon is the DPS denominator; path ticks still reported.
   */
  kind: "deterministic" | "stochastic" | "fixed-window";
  /** Probability-weighted mean terminal duration (exact when deterministic). */
  expectedTicks: number;
  /** Minimum terminal-branch duration in the support. */
  minimumTicks: number;
  /** Maximum terminal-branch duration in the support. */
  maximumTicks: number;
  /** Duration of the representative history (exact path when deterministic). */
  representativeTicks: number;
  /** Present when the run used a fixed horizon (Revolution duration). */
  fixedHorizonTicks?: number;
}

/**
 * Damage bounds. `expectedConditional*` are weighted means of per-branch path
 * extrema — useful diagnostics, never global support bounds.
 */
export interface DamageBoundsSummary {
  expectedDamage: number;
  /** Minimum achievable terminal-branch path-minimum (true support lower bound). */
  supportMinDamage: number;
  /** Maximum achievable terminal-branch path-maximum (true support upper bound). */
  supportMaxDamage: number;
  /** Weighted average of branch conditional minima (not a support bound). */
  expectedConditionalMin: number;
  /** Weighted average of branch conditional maxima (not a support bound). */
  expectedConditionalMax: number;
}

/**
 * DPS quantities. `primary` is always the headline metric for the run type:
 * fixed-window → E[D] / (horizon × tickSeconds);
 * natural-completion → E[D] / (E[T] × tickSeconds) (ratio of expectations).
 */
export interface DpsSummary {
  primary: number;
  /** E[D] / (E[T] × tickSeconds). Equals primary for natural-completion. */
  ratioOfExpectations: number;
  /**
   * E[D_i / T_i] across terminal classes. Only set for stochastic natural
   * completion (undefined for fixed-window and deterministic single-path).
   */
  expectedBranchDps?: number;
  /** DPS of the representative terminal class (or the sole deterministic path). */
  representativeDps: number;
}

export type HistoryKind = "complete" | "representative-terminal-class";

/**
 * Provenance of `casts` / `events`. When kind is representative-terminal-class,
 * those arrays are NOT the weighted event ledger and must not rebuild analysis.
 */
/**
 * Why this history class was chosen.
 * - sole-terminal: single complete path.
 * - highest-probability-mass: max weight among all terminals (all ok, or all failed).
 * - highest-successful-mass: max weight among successful only (partial failure;
 *   totals are success-conditional, so history matches that scope).
 */
export type HistorySelectionReason =
  | "sole-terminal"
  | "highest-probability-mass"
  | "highest-successful-mass";

export interface HistoryProvenance {
  kind: HistoryKind;
  /** Probability mass of the class that supplied casts/events (absolute, not renormalized). */
  classWeight: number;
  ticks: number;
  selectionReason: HistorySelectionReason;
  /**
   * True only for a single non-branching successful path. False after any
   * state-changing branching (including intermediate merges that later collapse
   * to one terminal class), and when any branch failed — events never rebuild
   * weighted ledgers in those cases.
   */
  eventsReconcileWithWeightedTotals: boolean;
}

/**
 * Partial branch failure. Weighted damage totals use successful branches only
 * (renormalized) when successfulWeight > 0; all-failed runs expose zeros and
 * totalsScope "none".
 */
export interface BranchFailureSummary {
  failedWeight: number;
  successfulWeight: number;
  totalsScope: "successful-branches-renormalized" | "none";
  primaryReason: string;
  reasons: ReadonlyArray<{ reason: string; weight: number }>;
}

export interface StochasticRngSummary {
  method: "probability-weighted branching";
  terminalClasses: number;
  successfulClasses: number;
  failedClasses: number;
  /** Raw weight sum before any renormalization (should be ~1). */
  probabilityMass: number;
  representative: {
    classWeight: number;
    ticks: number;
    selectionReason: Exclude<HistorySelectionReason, "sole-terminal">;
    historyKind: "representative-terminal-class";
    eventsReconcileWithWeightedTotals: boolean;
  };
  failure?: BranchFailureSummary;
  /**
   * @deprecated Use `failure.failedWeight`. Kept for solver/UI during migration.
   */
  failedWeight?: number;
  /**
   * @deprecated Use `representative.classWeight`.
   */
  representativeClassWeight: number;
  /**
   * @deprecated Use `representative.ticks`.
   */
  representativeClassTicks: number;
}

export interface TailMetrics {
  /** In-window expected damage (same as totalExpected for fixed-window). */
  inWindowExpectedDamage: number;
  /** Expected damage from tails landing at or after the horizon. */
  postWindowTailDamage: number;
  /** inWindow + postWindow. Never use this as fixed-window DPS numerator. */
  totalIncludingTails: number;
}

export interface RotationSummary {
  ok: boolean;
  error?: string;
  /** Exact for complete history; representative terminal class when history.kind says so. */
  casts: CastRecord[];
  duration: DurationSummary;
  /**
   * Convenience: duration.expectedTicks.
   * Deterministic runs: exact path length.
   * Stochastic runs: E[ticks] — inspect duration / rng for support and representative.
   */
  ticks: number;
  /**
   * Horizon the run was asked to fill (revolution duration). When set, totals
   * count only events landing before it (half-open [0, horizonTicks)) and
   * primary DPS divides by the horizon.
   */
  horizonTicks?: number;
  damage: DamageBoundsSummary;
  /**
   * Expected damage (E[D] over the probability mass used for totals).
   * Same as damage.expectedDamage.
   */
  totalExpected: number;
  /**
   * @deprecated Prefer damage.supportMinDamage. Equals the true support lower
   * bound (not a weighted mean of path minima).
   */
  totalMin: number;
  /**
   * @deprecated Prefer damage.supportMaxDamage. Equals the true support upper
   * bound (not a weighted mean of path maxima).
   */
  totalMax: number;
  dps: number;
  dpsDetail: DpsSummary;
  metric: {
    type: "fixed-window" | "natural-completion";
    denominatorTicks: number;
    damageCounted: number;
    tails: "excluded" | "included-separately" | "included-in-natural-completion";
  };
  perAbility: Record<string, number>;
  /** Expected damage landing on each tick — DoT tails land on their sourced ticks. */
  damageByTick: Record<number, number>;
  /** Landed events for complete history or the representative terminal class. */
  events: ResolvedEvent[];
  history: HistoryProvenance;
  /** Reconciled engine-owned aggregations; never rebuilt from representative events. */
  analysis: RotationDamageAnalysis;
  /**
   * Opt-in second metric (SimulateOptions.includeTails). Never presented as
   * fixed-window DPS.
   */
  tails?: TailMetrics;
  /** @deprecated Use tails.totalIncludingTails. */
  totalExpectedIncludingTails?: number;
  /** @deprecated Use tails.postWindowTailDamage. */
  postWindowTailDamage?: number;
  /**
   * Present only when state-changing RNG forced probability-weighted branching.
   */
  rng?: StochasticRngSummary;
  /** Present when any terminal class failed (also nested under rng when branching). */
  failure?: BranchFailureSummary;
}

export type CastAttempt = { ok: true } | { ok: false; error: string };

export interface CastContext {
  getState(): RotationState;
  costOf(ability: AbilitySpec): number;
  firstLegalTick(abilityId: string): number;
  /**
   * The one canonical time path: lands every queued event due by targetTick in
   * (tick, seq) order (damage resolved against state at each land tick), applies
   * passive generation over the crossed interval, expires crossed clocks, and
   * stops with state representing exactly targetTick.
   */
  advanceTo(targetTick: number): void;
  /**
   * One atomic cast transition: advance to the candidate tick, re-check
   * requirements/affordability against the advanced state (rejection leaves the
   * state otherwise untouched), resolve the empowered variant, start the
   * cooldown and occupancy, schedule hit events with provenance, then apply
   * immediate on-cast grants/windows.
   */
  performCast(ability: AbilitySpec, readyTick: number, auto: boolean, rng?: CastRng): CastAttempt;
  /** Off-GCD utility casts (Runic Charge): state-machine update and a cast record
   *  without consuming or advancing the global cooldown. */
  performOffGcdCast(ability: AbilitySpec): void;
  /** Remove a cast's pending events (channel cancellation); returns the count. */
  cancelCastEvents(castSeq: number): number;
  finish(error?: string, horizonTicks?: number, options?: SimulateOptions): RotationSummary;
  byId: Map<string, AbilitySpec>;
  basicByStyle: Map<AbilitySpec["style"], AbilitySpec>;
}
