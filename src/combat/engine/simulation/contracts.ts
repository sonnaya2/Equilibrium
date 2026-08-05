import type { CritLayers } from "../../core/critical";
import type { HitCapRule } from "../../core/hitCaps";
import type { AbilityResult, AbilitySpec } from "../../pipeline/calculateAbility";
import type { CombatContext, CombatModifier } from "../../types";
import type { ResolvedEvent } from "../runtime/events";
import type { RotationState } from "../runtime/state";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import type { ResolvedLeagueRules } from "../../league/ruleset";
import type { AdrenalineTransaction } from "../../shared/adrenalineTransaction";

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
  /** Flat +% on adrenaline-generating basics (Fury of the Small = 1). Applied before Invigorating mult. */
  basicAdrenalineFlatBonus?: number;
  /** Extra max adrenaline (Heightened Senses = 10). */
  maxAdrenalineBonus?: number;
  /** CoE ultimate refund (0 or 10). */
  conservationOfEnergyRefund?: number;
  /**
   * Ring of Vigour active (equipped ring and/or permanent passive, already OR-resolved).
   * Weapon specials use 90% of original adren cost for requirement and spend.
   * Ultimate refund is RING_OF_VIGOUR_REFUND when active and the cast qualifies.
   */
  ringOfVigour?: boolean;
  /** Impatient perk rank (1-4) - state-changing RNG, branched by the drivers. */
  impatientRank?: number;
  impatientLevel20?: boolean;
  /** Relentless perk rank (1-5) - state-changing RNG, branched by the drivers. */
  relentlessRank?: number;
  relentlessLevel20?: boolean;
}

/** State-changing RNG flags for probability-weighted branches; missing = no proc. */
export type CastRngPointId =
  | "impatient"
  | "relentless"
  | "avernic-rampage"
  | "spectral_scythe_soul";
export type CastRng = Readonly<Partial<Record<CastRngPointId, boolean>>>;

export function rngProc(rng: CastRng | undefined, id: CastRngPointId): boolean {
  return rng?.[id] === true;
}

export interface ProcRules {
  cracklingRank?: number;
  aftershockRank?: number;
}

/**
 * Prebuilt ability id / basic-auto maps (solver compiled context).
 * When present, createRuntime uses these and skips mapAbilitiesById / mapBasicsByStyle.
 */
export interface AbilityRegistry {
  readonly byId: ReadonlyMap<string, AbilitySpec>;
  readonly basicByStyle: ReadonlyMap<AbilitySpec["style"], AbilitySpec>;
}

export interface SimulateInput {
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  abilities: readonly AbilitySpec[];
  /** Optional prebuilt registry; createRuntime reuses without remapping. */
  abilityRegistry?: AbilityRegistry;
  rotation: readonly RotationAction[];
  modifiers?: CombatModifier[] | ((ability: AbilitySpec) => CombatModifier[]);
  context?: CombatContext;
  cap?: HitCapRule;
  /** Adrenaline available before the first cast. */
  startingAdrenaline?: number;
  /** Equipped catalogue ids used by mechanics with verified item requirements. */
  equipmentIds?: readonly string[];
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";
  /**
   * Style ammo mechanic (Deathspore free-cast, Puncture). Packed on Manual,
   * Revolution, and solver via resolved model / equipment derivation.
   */
  ammo?: "deathspore" | "splintering";
  /** Caroming rank 1-4; rewrites Ricochet hit bands at prepare. */
  caromingRank?: number;
  /** Weave the style auto-attack through idle GCDs and adrenaline shortfalls. */
  autoWeave?: boolean;
  adrenaline?: AdrenalineRules;
  /** Planted Feet: Sunshine / Death's Swiftness base duration x1.25 (63 ticks); not greater variants. */
  plantedFeet?: boolean;
  /** Strength cape 99: Dismember +3 bleed hits (evaluate/UI may pre-patch; engine may also take flag). */
  strengthCape99?: boolean;
  /** Precise perk rank 1-6; raises minimum ability damage before the hit pipeline. */
  preciseRank?: number;
  /** Effective Tumeken count (0-5); its 5.4s activation is assumed complete before tick 0. */
  tumekensPieces?: number;
  /** False when another mechanic (Equilibrium) disables all set crit chance. */
  tumekensCritEnabled?: boolean;
  /** Set bonuses already active before tick 0 for this fixed loadout. */
  equipmentEffects?: ActiveEquipmentEffects;
  league?: ResolvedLeagueRules;
  procs?: ProcRules;
  /** Mult on conjure spirit basic autos only (not poison/commands). First Necro set; default 1. */
  conjureBasicDamageMult?: number;
  /** Multiplier on the Spirit Pact lifetime, after the 5-tick summon animation. */
  conjureDurationMult?: number;
  /** Target LP% (0-100) for HP-gated mechanics (Bloodlust Flurry, Punish, Spectral Scythe); absent = no HP scale. */
  targetHpPercent?: number;
  /** Optional pre-active Natural Instinct window for Jaws adrenaline. */
  naturalInstinctUntilTick?: number;
  /**
   * Explicit residual souls at tick 0 (Analysis Volley control).
   * Absent = engine default 0. Clamped 0..cap in createRuntime.
   */
  startingResidualSouls?: number;
}

/**
 * Bookkeeping depth for simulation outputs.
 * - score-only: ranking metrics only (search hot path)
 * - summary: light diagnostics (dps/ticks/perAbility/support); no casts/events/analysis
 * - full-analysis: complete RotationSummary (default; UI / forensics)
 */
export type SimulationDetailLevel = "score-only" | "summary" | "full-analysis";

export const DEFAULT_SIMULATION_DETAIL_LEVEL: SimulationDetailLevel = "full-analysis";

export function resolveDetailLevel(level?: SimulationDetailLevel): SimulationDetailLevel {
  return level ?? DEFAULT_SIMULATION_DETAIL_LEVEL;
}

/** Presentation event log + cast hit arrays (full-analysis only). */
export function keepsPresentationHistory(level: SimulationDetailLevel): boolean {
  return level === "full-analysis";
}

/** Weighted analysis ledgers (full-analysis only). */
export function keepsAnalysisLedgers(level: SimulationDetailLevel): boolean {
  return level === "full-analysis";
}

/** Per-ability damage map (summary + full-analysis). */
export function keepsPerAbilityMap(level: SimulationDetailLevel): boolean {
  return level !== "score-only";
}

/**
 * Live-set width for one sim attempt. Discarded mass stays residual (never reassigned).
 * maximumResidualWeight is an acceptance threshold for adaptive fidelity, not a sim discard control.
 */
export interface BranchBudget {
  maxLiveBranches: number;
  maxIntermediateBranches: number;
  /** Completeness: residualWeight must be <= this after the attempt. */
  maximumResidualWeight: number;
}

export interface SimulateOptions {
  /**
   * Also compute `totalExpectedIncludingTails`: in-horizon damage plus the
   * still-scheduled (unlanded) tails of casts begun inside the horizon.
   */
  includeTails?: boolean;
  /**
   * Bookkeeping depth. Default full-analysis so UI/tests stay unchanged.
   * Solver search opts into score-only explicitly.
   */
  detailLevel?: SimulationDetailLevel;
  /**
   * Branch width for this sim. Omitted -> engine defaults (64 live / 128 intermediate).
   * Passed through; not a global constant raise.
   */
  branchBudget?: BranchBudget;
}

/** createCastContext input: rotation/autoWeave belong to the manual driver only. */
export type CastContextInput = Omit<SimulateInput, "rotation" | "autoWeave"> & {
  horizonTicks?: number;
  /** Stored on runtime for hot-path accounting; default full-analysis. */
  detailLevel?: SimulationDetailLevel;
};

export interface CastRecord {
  tick: number;
  abilityId: string;
  result: AbilityResult;
  /** After channel occupancy + completion effects (passive gen, etc.). */
  adrenalineAfter: number;
  adrenalineBefore: number;
  /**
   * After ability-economy resources (tx.afterResources), before channel advance.
   * Prefer adrenalineTransaction when present.
   */
  adrenalineAfterResources?: number;
  listedCost: number;
  effectiveCost: number;
  actualSpend: number;
  /**
   * Spend prevented by Relentless only (effectiveCost when relentless, else 0).
   * Not CoE / RoV (those are grants on the transaction).
   */
  refund: number;
  /**
   * totalAbilityGain + otherImmediate + coe + vigour from the transaction.
   * Not after - before (channel passive gen must not inflate this).
   */
  adrenalineGained: number;
  /** Full ability-economy ledger when resources ran. */
  adrenalineTransaction?: AdrenalineTransaction;
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
  /** Bonus-damage riders on parent skill; 0 on the rider row. Do not sum with Total across rows. */
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
 * Explicit duration fields; read `kind`/`rng` before treating ticks as path length vs E[T].
 * deterministic: all fields = exact length. stochastic: fields may differ.
 * fixed-window: horizon is DPS denominator; path ticks still reported.
 */
export interface DurationSummary {
  kind: "deterministic" | "stochastic" | "fixed-window";
  /** Probability-weighted mean terminal duration (exact when deterministic). */
  expectedTicks: number;
  minimumTicks: number;
  maximumTicks: number;
  /** Representative history duration (exact path when deterministic). */
  representativeTicks: number;
  /** Set when the run used a fixed horizon (Revolution duration). */
  fixedHorizonTicks?: number;
}

/**
 * How primary expectedDamage / totalExpected relate to residual mass.
 * - unit-mass: full unit measure EV (residualWeight ~ 0; concrete covers unit measure).
 * - known-mass-contribution: sum w_i D_i over expanded concrete only (= concreteMass * E[D|concrete]).
 *   Residual not assigned damage. NOT unit-mass EV. NOT the conditional mean renormalized to 1.
 * - concrete-terminals: diagnostic token for E[D|concrete] (conditional mean over kept mass).
 *   Primary totalExpected never uses this when residual > 0 (use known-mass-contribution).
 */
export type DamageTotalsBasis = "unit-mass" | "known-mass-contribution" | "concrete-terminals";

/**
 * Damage bounds. Primary expectedDamage is never a conditional mean treated as unit-mass EV.
 * residual ~ 0: expectedDamage is unit-mass EV (scope unit-mass).
 * residual > 0: expectedDamage is known-mass contribution sum w_i D_i
 * (scope known-mass-contribution); E[D|concrete] lives on conditionalConcreteMean.
 * Never success-renormalized. expectedConditional* = weighted means of per-branch extrema.
 */
export interface DamageBoundsSummary {
  /**
   * Primary damage total. scope selects the measure:
   * unit-mass: full unit EV (residual ~ 0).
   * known-mass-contribution: sum w_i D_i over expanded mass only (residual > 0).
   * Never E[D|concrete] with residual treated as zero for full EV, and never the
   * conditional mean renormalized to unit mass while residual remains.
   */
  expectedDamage: number;
  /**
   * Machine-readable basis for expectedDamage. Mirrors rng.totalsBasis when branching.
   * Absent on older payloads - residualWeight > 0 without scope is legacy concrete-terminals
   * (conditional mean); new residual payloads emit known-mass-contribution.
   */
  scope?: DamageTotalsBasis;
  /** E[D|concrete]: weight-normalized mean over expanded terminals. Diagnostic when residual. */
  conditionalConcreteMean?: number;
  /**
   * concreteMass * conditionalConcreteMean (= sum w_i D_i over expanded mass).
   * Equals expectedDamage when scope is known-mass-contribution or unit-mass with mass ~ 1.
   */
  knownMassExpectedDamage?: number;
  /** Expanded terminal weight sum (success + fail banked). */
  concreteMass?: number;
  /** Unexpanded residual weight (cap discards). */
  residualMass?: number;
  /**
   * True when residual ~ 0 and exactness is exact (safe for solver ranking on unit-mass EV).
   * False / absent when residual remains or totals are approximated.
   */
  eligibleForRanking?: boolean;
  /** True support lower bound (min concrete terminal-branch path-minimum). */
  supportMinDamage: number;
  /** True support upper bound (max concrete terminal-branch path-maximum). */
  supportMaxDamage: number;
  /** Weighted avg of branch conditional minima (not a support bound). */
  expectedConditionalMin: number;
  /** Weighted avg of branch conditional maxima (not a support bound). */
  expectedConditionalMax: number;
}

/**
 * primary uses the same figure as totalExpected / damage.expectedDamage (per scope).
 * fixed-window = E[D]/(horizon*tickSeconds); natural = E[D]/(E[T]*tickSeconds).
 * With residual > 0 this is known-mass contribution / duration (diagnostic only).
 */
export interface DpsSummary {
  primary: number;
  /** E[D]/(E[T]*tickSeconds); equals primary for natural-completion. */
  ratioOfExpectations: number;
  /** E[D_i/T_i]; stochastic natural-completion only. */
  expectedBranchDps?: number;
  representativeDps: number;
}

export type HistoryKind = "complete" | "representative-terminal-class";

/**
 * History pick reason. sole-terminal | highest-probability-mass | highest-successful-mass
 * (success-conditional when partial failure). representative-terminal-class is not the weighted ledger.
 */
export type HistorySelectionReason =
  "sole-terminal" | "highest-probability-mass" | "highest-successful-mass";

export interface HistoryProvenance {
  kind: HistoryKind;
  /** Absolute probability mass of the class that supplied casts/events. */
  classWeight: number;
  ticks: number;
  selectionReason: HistorySelectionReason;
  /**
   * True only for a single non-branching successful path; else events must not rebuild weighted totals.
   */
  eventsReconcileWithWeightedTotals: boolean;
}

/** exact = residualWeight ~ 0 (concrete mass covers unit measure); approximated = residual remains. */
export type BranchExactness = "exact" | "approximated";

/**
 * Primary totals scope over concrete terminals only (residual is never mixed in).
 * - "unconditional-all-mass": weight mean over every expanded terminal (success + fail
 *   banked). Name keeps the anti-success-renorm wire token; when residualWeight > 0 the
 *   primary damage field is known-mass contribution (see rng.totalsBasis), not unit-mass EV.
 * - "none": no successful mass (all failed / empty); banked E[D] still reported.
 * Engine never emits "successful-branches-renormalized".
 */
export type BranchTotalsScope = "unconditional-all-mass" | "none";

/**
 * Partial branch failure. Primary totals stay unconditional over concrete success+fail
 * mass (not success-renormalized). Residual is separate on rng. successfulWeight /
 * conditionalOnSuccess are diagnostics only.
 */
export interface BranchFailureSummary {
  failedWeight: number;
  /** Successful path probability; diagnostic, not a primary-totals divisor. */
  successfulWeight: number;
  totalsScope: BranchTotalsScope;
  primaryReason: string;
  reasons: ReadonlyArray<{ reason: string; weight: number }>;
  /** E[D | success]; secondary diagnostic only - never primary DPS numerator. */
  conditionalOnSuccessExpectedDamage?: number;
  /** E[D | failure] over failed paths (banked damage); diagnostic. */
  failedPathExpectedDamage?: number;
}

export interface StochasticRngSummary {
  method: "probability-weighted branching";
  terminalClasses: number;
  successfulClasses: number;
  failedClasses: number;
  /**
   * Concrete terminal weight sum (success + fail expanded).
   * concreteMass + residualWeight ~ 1.
   */
  probabilityMass: number;
  /**
   * Same as probabilityMass - concrete expanded measure.
   * Prefer this name when distinguishing residual; probabilityMass kept for older readers.
   */
  concreteMass: number;
  /**
   * Unexpanded / dropped mass (branch caps). Not assigned damage.
   * When > 0, primary expectedDamage is known-mass contribution (not unit-mass EV,
   * not E[D|concrete] as unit-mass).
   */
  residualWeight: number;
  /**
   * Machine-readable primary totals basis (same tokens as damage.scope).
   * unit-mass when residual ~ 0.
   * known-mass-contribution when residual > 0 (sum w_i D_i over expanded mass).
   * concrete-terminals is legacy/diagnostic for E[D|concrete] only; primary residual
   * payloads use known-mass-contribution.
   */
  totalsBasis: DamageTotalsBasis;
  /** exact when residualWeight ~ 0; approximated when residual mass remains. */
  exactness: BranchExactness;
  representative: {
    classWeight: number;
    ticks: number;
    selectionReason: Exclude<HistorySelectionReason, "sole-terminal">;
    historyKind: "representative-terminal-class";
    eventsReconcileWithWeightedTotals: boolean;
  };
  failure?: BranchFailureSummary;
  /**
   * @deprecated Use `failure.failedWeight`.
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
  /** duration.expectedTicks (exact path if deterministic; E[ticks] if stochastic). */
  ticks: number;
  /**
   * Revolution horizon: damage lands in [0, horizonTicks); primary DPS divides by horizon.
   */
  horizonTicks?: number;
  damage: DamageBoundsSummary;
  /**
   * Primary expected damage (same as damage.expectedDamage).
   * residual ~ 0: unit-mass EV.
   * residual > 0: known-mass contribution (sum w_i D_i); not E[D|concrete] as unit-mass,
   * not residual zero-filled into a silent full EV. See damage.scope / rng.totalsBasis.
   * Never success-renormalized.
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
  /**
   * Damage landing on each tick.
   * residual ~ 0: weight-normalized means (unit-mass scale).
   * residual > 0: known-mass contribution per tick (conditional tick mean * concreteMass).
   */
  damageByTick: Record<number, number>;
  /** Landed events for complete history or the representative terminal class. */
  events: ResolvedEvent[];
  history: HistoryProvenance;
  /** Reconciled engine-owned aggregations; never rebuilt from representative events. */
  analysis: RotationDamageAnalysis;
  /** Opt-in (includeTails); not the fixed-window DPS numerator. */
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
   * Advance clock: land due events in (tick, seq) order, passive gen, expire clocks; state at targetTick.
   */
  advanceTo(targetTick: number): void;
  /**
   * Atomic cast: advance, re-check affordability (reject leaves state), schedule hits, on-cast grants.
   */
  performCast(ability: AbilitySpec, readyTick: number, auto: boolean, rng?: CastRng): CastAttempt;
  /** Off-GCD utility (e.g. Runic Charge): cast record without consuming GCD. */
  performOffGcdCast(ability: AbilitySpec): void;
  /** Remove a cast's pending events (channel cancellation); returns the count. */
  cancelCastEvents(castSeq: number): number;
  finish(error?: string, horizonTicks?: number, options?: SimulateOptions): RotationSummary;
  byId: ReadonlyMap<string, AbilitySpec>;
  basicByStyle: ReadonlyMap<AbilitySpec["style"], AbilitySpec>;
}
