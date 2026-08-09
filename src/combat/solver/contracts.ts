/** Revolution-bar solver contracts. Pure types for evaluate/search layers. */
import type { AdrenalineRules } from "../engine/simulation/contracts";
import type { ResolvedLeagueRules } from "../league/ruleset";

/** Bumped when evaluation inputs change shape (e.g. Basic Attack subtype). */
export const SOLVER_SCHEMA_VERSION = 10 as const;

/**
 * Bumped when objective math or score tagging semantics change.
 * Included in eval cache keys so search/full archives never mix scales.
 * v4: residual / known-mass not rankable on explore either.
 * v5: fixed-lane stateful RNG replaces adaptive global enumeration.
 */
export const OBJECTIVE_VERSION = 5 as const;

export type Bar = readonly string[];

export type SearchTier = "thorough" | "extreme" | "unhinged";

/**
 * Honest proof labels - only claim what was actually proven.
 * full-objective-global-optimum requires every feasible bar under the final
 * objective+horizon; exhaustive short-horizon search alone never qualifies.

 * Legacy labels remain in the union for UI/DTO type compatibility but the
 * solver never emits them (see finalize chooseProof).
 */
export type ProofLabel =
  | "full-objective-global-optimum"
  | "search-objective-exhaustive"
  | "full-shortlist-best"
  | "heuristic-best-found"
  | "degraded-exploratory-fallback"
  | "failed"
  | "budget-not-exhausted"
  | "stopped-early"
  | "heuristic-complete"
  /** @deprecated never emitted - use heuristic-best-found */
  | "best-found"
  /** @deprecated never emitted - use full-objective-global-optimum only when proven */
  | "globally-optimal"
  /** @deprecated never emitted - use budget-not-exhausted / stopped-early */
  | "converged";

export type ObjectiveProfileId = "balanced" | "burst" | "sustained" | "custom";

export type ObjectiveWindowId = "opening" | "developed" | "steady";

/** Inclusive min / inclusive max bar length (ability slots). */
export interface SizeBounds {
  min: number;
  max: number;
}

export interface SeedBar {
  bar: Bar;
  /** Optional precomputed robust score when the bar was already evaluated. */
  score?: number;
  label?: string;
}

/** Per-window contribution weights (normalized by sum when scoring). */
export interface ObjectiveWindowWeights {
  opening: number;
  developed: number;
  steady: number;
}

/** Mix of window mean vs worst-window floor. */
export interface RobustMixWeights {
  robustMean: number;
  robustMin: number;
}

export type ObjectiveWeights = ObjectiveWindowWeights & RobustMixWeights;

export interface ObjectiveWindowSpec {
  id: ObjectiveWindowId;
  /** Half-open tick range [startTick, endTick). */
  startTick: number;
  endTick: number;
  /** Window length in seconds (endTick - startTick) * tickSeconds. */
  seconds: number;
}

/**
 * Stochastic model exactness.
 */
export type SolverStochasticExactness = "exact" | "estimated" | "approximated";

/**
 * Machine-readable primary totals basis (mirrors engine damage.scope / rng.totalsBasis).
 * unit-mass: full unit measure EV (only rankable basis).
 * known-mass-contribution: partial mass contribution (diagnostic; never rank).
 * concrete-terminals: E[D|concrete] over kept terminals (conditional; never rank).
 */
export type SolverDamageTotalsBasis =
  "unit-mass" | "known-mass-contribution" | "concrete-terminals";

/**
 * Minimal summary surface the objective reads.
 * damageByTick ranks only when the ledger is unit-mass (residual ~ 0, totalsBasis
 * unit-mass or absent). Known-mass contribution and concrete-terminal conditional
 * ledgers must never enter scoreFromDamageByTick / ranking scores.
 */
export interface ScoreableSummary {
  ok: boolean;
  error?: string;
  horizonTicks?: number;
  /**
   * Primary expected damage. residual ~ 0: unit-mass EV.
   * residual > 0: known-mass contribution (sum w_i D_i), not E[D|concrete] as unit-mass.
   * Must not rank when residual / non-unit-mass scope is present.
   */
  totalExpected?: number;
  /**
   * Known-mass contribution diagnostic (engine may set). Never a ranking score alone.
   */
  knownMassExpectedDamage?: number;
  /**
   * Conditional mean over concrete terminals (engine may set). Must not rank.
   */
  conditionalConcreteMean?: number;
  /**
   * Tick ledger for robust windows.
   * Only unit-mass ledgers may pass scoreFromDamageByTick; residual / known-mass /
   * concrete-terminal ledgers are ineligible even if numbers look finite.
   */
  damageByTick: Record<number, number>;
  /** Prefer damage.scope when present (engine DamageBoundsSummary). */
  damage?: {
    scope?: SolverDamageTotalsBasis | string;
    knownMassExpectedDamage?: number;
    conditionalConcreteMean?: number;
  };
  rng?: {
    failedWeight?: number;
    /** Fixed-lane invariant: zero. */
    residualWeight?: number;
    /** Concrete expanded measure (success + fail). Prefer over probabilityMass. */
    concreteMass?: number;
    /** Alias of concreteMass for older readers. */
    probabilityMass?: number;
    /** Same tokens as damage.scope. Prefer when present. */
    totalsBasis?: SolverDamageTotalsBasis | string;
    exactness?: SolverStochasticExactness | string;
  };
}

/** Engine bookkeeping depth; mirrors SimulationDetailLevel without importing engine. */
export type EvalDetailLevel = "score-only" | "summary" | "full-analysis";

export interface ObjectiveWindowDpms {
  openingDpm: number;
  developedDpm: number;
  steadyDpm: number;
}

export interface ObjectiveScoreOk extends ObjectiveWindowDpms {
  ok: true;
  minDpm: number;
  weightedMean: number;
  robustScore: number;
  profileId: ObjectiveProfileId;
  weights: ObjectiveWeights;
}

export interface ObjectiveScoreFail {
  ok: false;
  reason: string;
  robustScore: 0;
  profileId: ObjectiveProfileId;
}

export type ObjectiveScore = ObjectiveScoreOk | ObjectiveScoreFail;

/** Evaluation mode: short exploratory, medium proportional-robust, or full-horizon. */
export type ScoreEvalMode = "search" | "medium" | "full";

/**
 * Tagged scored bar - search and full scores are never interchangeable units.
 * exploratory scores must not rank against robust scores.
 */
export interface ScoredBar {
  bar: Bar;
  fingerprint: string;
  /** Scalar used for ranking within the same mode only. */
  robustScore: number;
  /** Alias of robustScore for search layers that read `.score`. */
  score?: number;
  profileId: ObjectiveProfileId;
  /** search = short exploratory; medium = mid-horizon robust-shaped; full = final horizon. */
  mode: ScoreEvalMode;
  /** Multi-fidelity tag; medium is never validForFinalRanking. */
  fidelity?: "short" | "medium" | "full";
  objectiveType: ObjectiveProfileId;
  horizonTicks: number;
  exploratory: boolean;
  /** True only for finite full-horizon robust scores (never medium/search). */
  validForFinalRanking: boolean;
  failureReason?: string;
  minDpm: number;
  weightedMean: number;
  openingDpm: number;
  developedDpm: number;
  steadyDpm: number;
  source?: string;
}

export interface SearchStats {
  evaluations: number;
  searchEvaluations: number;
  fullEvaluations: number;
  cacheHits: number;
  cacheMisses: number;
  searchCacheHits: number;
  fullCacheHits: number;
  uniqueBars: number;
  elapsedMs: number;
  generations?: number;
  restarts?: number;
  /** Best exploratory score observed (search mode). */
  bestExploratoryScore?: number;
  /** Best full robust score observed. */
  bestFullScore?: number;
  /** @deprecated Prefer bestFullScore / bestExploratoryScore - mixed scale. */
  bestScore?: number;
}

/**
 * Solver request skeleton - evaluation context is opaque to search; fingerprint
 * it into `contextKey` so the eval cache cannot cross loadouts/rulesets.
 */
export interface SolverRequest {
  schemaVersion: typeof SOLVER_SCHEMA_VERSION;
  /** Candidate ability ids the search may place. */
  pool: readonly string[];
  size: SizeBounds;
  tier: SearchTier;
  profileId: ObjectiveProfileId;
  customWeights?: ObjectiveWeights;
  seed?: number;
  seedBars?: readonly SeedBar[];
  /** Opaque evaluation context (loadout, target, league, etc.). */
  contextKey?: unknown;
  maxEvaluations?: number;
  /**
   * Fixed ability ids by slot index; `null`/`undefined` = free slot.
   * Length need not equal bar size - extra pins are ignored, missing are free.
   */
  pinned?: ReadonlyArray<string | null | undefined>;
}

export interface SolverResult {
  best: ScoredBar | null;
  proof: ProofLabel;
  stats: SearchStats;
  top?: readonly ScoredBar[];
}

/** Cached evaluation payload (search layers fill this). */
export interface EvalResult {
  score: number;
  bar?: Bar;
  objective?: ObjectiveScore;
  /** Optional flag some mocks set; prefer isFiniteEval(score). */
  finite?: boolean;
  /** Mode the evaluator intended; defaults from request path. */
  mode?: ScoreEvalMode;
  exploratory?: boolean;
  validForFinalRanking?: boolean;
  horizonTicks?: number;
  fidelity?: "short" | "medium" | "full";
  failureReason?: string;
}

/** Search-time evaluation modes (finalize aliases full; medium is mid-fidelity). */
export type EvalMode = "search" | "medium" | "full" | "finalize";

/** Alias used by search tiers (same set as SearchTier). */
export type SolveTier = SearchTier;

/**
 * Minimal ability surface the search / exclusivity helpers need.
 * Full AbilitySpec satisfies this.
 */
export type AbilityCategory = "basic" | "enhanced" | "ultimate" | "utility";

export interface PoolAbility {
  id: string;
  name?: string;
  category?: AbilityCategory;
  replacementGroup?: string;
  /** Alias accepted by search exclusivity (defaults to replacementGroup). */
  exclusiveGroup?: string;
  cooldownGroup?: string;
  style?: string;
  offGcd?: boolean;
  basicAttack?: boolean;
  /** @deprecated Read compatibility for pre-modernisation callers. */
  autoAttack?: boolean;
  /** Rough expected ability damage for seed heuristics (hit-band mean if known). */
  averageDamage?: number;
  occupancyTicks?: number;
  cooldownTicks?: number;
  supportStatus?: "partially-modeled" | "not-modeled" | "mechanics-unverified";
  weaponRequirement?:
    "twohand" | "dualwield" | "mainhand" | "mainhand-empty" | "conduit" | "death-guard-and-conduit";
  requiredEquipmentAnyOf?: readonly string[];
  requiredPassiveAnyOf?: readonly string[];
}

export type EvaluateFn = (input: { bar: readonly string[]; mode?: EvalMode }) => EvalResult;

/** Solve outcome status - success never pretends after total failure. */
/**
 * ok: full-horizon rankable winner (upgrade or incumbent remains best).
 * failed: no validated full-horizon bar at all (exploratory is debug-only).
 * degraded: legacy status - finalize never emits it (Phase 4).
 */
export type SolveStatus = "ok" | "degraded" | "failed";

/**
 * Float guard for incumbent vs candidate full scores.
 * Candidate must beat incumbent by more than this to claim an upgrade.
 */
export const INCUMBENT_SCORE_TOLERANCE = 1e-9;

/** Solve orchestrator output (search layer). */
export interface SolveResult {
  status: SolveStatus;
  /**
   * Full-horizon rankable selection when status is ok.
   * Upgrade: proposed bar. No upgrade: incumbent (current bar remains best).
   * Null only when failed (nothing full-rankable).
   */
  best: ScoredBar | null;
  top: ScoredBar[];
  proof: ProofLabel;
  /** Search-budget evaluations only (excludes forced finalize). */
  searchEvaluations: number;
  /** Full-horizon rescoring evaluations (including forced). */
  fullEvaluations: number;
  totalEvaluations: number;
  searchBudget: number;
  /** @deprecated Use totalEvaluations - includes forced full rescores. */
  evaluationsUsed: number;
  evaluationBudget: number;
  exhaustiveCompleted: boolean;
  tier: SearchTier;
  seedBestScore: number;
  bestExploratoryScore: number;
  bestFullScore: number;
  validFullCandidateCount: number;
  /**
   * Normalized current user bar (Phase 5 incumbent). Always full-rescored when set.
   * Null when request had no legal user bar.
   */
  incumbentBar: readonly string[] | null;
  /** Full-horizon robust score of the incumbent; -Infinity when unrankable / absent. */
  incumbentScore: number;
  /** True only when best strictly beats the incumbent's validated full score. */
  isUpgrade: boolean;
  /** winnerScore - incumbentScore when isUpgrade; else 0. */
  scoreImprovement: number;
  /** 100 * scoreImprovement / |incumbentScore| when upgrade and denominator > 0; else null. */
  percentImprovement: number | null;
  /**
   * True only for an upgrade with a full-rankable best.
   * Apply / replace stays disabled when the current bar remains best.
   */
  validForApply: boolean;
  stats: SearchStats;
}

export type ExclusionCode =
  | "duplicate-id"
  | "unknown-id"
  | "size-below-min"
  | "size-above-max"
  | "off-gcd"
  /** @deprecated Read compatibility for solver diagnostics from schema 4. */
  | "auto-attack"
  | "replacement-group"
  | "style-mismatch"
  | "weapon-requirement"
  | "equipment-requirement"
  | "partial-support"
  | "not-modeled"
  | "mechanics-unverified"
  | "league-restriction"
  | "not-in-pool"
  | "sim-failed"
  | "score-failed";

export interface ExclusionReason {
  code: ExclusionCode;
  message: string;
  abilityId?: string;
  group?: string;
}

export interface CandidatePoolOptions {
  /** Include implicit Basic Attacks as explicit bar candidates (default false). */
  includeBasicAttacks?: boolean;
  /** @deprecated Use includeBasicAttacks. */
  includeAutos?: boolean;
  includeOffGcd?: boolean;
  /** Include supportStatus specs (default false). */
  includePartial?: boolean;
  allow?: readonly string[];
  deny?: readonly string[];
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";
  equipmentIds?: readonly string[];
  /** Active equipment passives (capability gates for Igneous upgrades, etc.). */
  passiveIds?: readonly string[];
  league?: ResolvedLeagueRules;
}

export interface CandidatePool {
  style: string;
  byId: ReadonlyMap<string, PoolAbility & { style: string }>;
  /** Stable-sorted ability ids. */
  ids: readonly string[];
  /** replacementGroup → member ids present in the pool. */
  exclusiveGroups: ReadonlyMap<string, readonly string[]>;
  options: CandidatePoolOptions;
}

/**
 * Size bounds for evaluate/eligibility. Prefer SizeBounds (`min`/`max`);
 * minSlots/maxSlots accepted as aliases.
 */
export type BarSizeBounds = SizeBounds | { minSlots: number; maxSlots: number };

/**
 * Plain sim fields matching RevolutionInput minus bar / style / durationTicks.
 * Kept structural (not importing engine types) so contracts stay Qt/React-free.
 */
export interface RevolutionEvalSimBase {
  base: number;
  level: number;
  accuracy: number;
  crit: {
    chance: number;
    disabled?: boolean;
    damageBonus?: number;
    critualConvertedDamageBonus?: number;
    guaranteed?: boolean;
  };
  /** Full AbilitySpec[] at runtime; PoolAbility is the documented minimum. */
  abilities: readonly PoolAbility[];
  equipmentIds?: readonly string[];
  weaponConfiguration?: CandidatePoolOptions["weaponConfiguration"];
  league?: ResolvedLeagueRules;
  startingAdrenaline?: number;
  adrenaline?: AdrenalineRules;
  // Additional SimulateInput fields are allowed by structural typing at the call site.
}

export interface RevolutionEvalRequest {
  bar: Bar;
  style: "melee" | "ranged" | "magic" | "necromancy";
  durationTicks: number;
  pool: CandidatePool;
  sim: RevolutionEvalSimBase;
  profileId: ObjectiveProfileId;
  customWeights?: ObjectiveWeights;
  includePartial?: boolean;
  size?: BarSizeBounds;
  /**
   * First-class user bar baseline: skip generation size band; allow catalogue
   * abilities excluded from candidate generation (forceSolver:false).
   */
  incumbentBaseline?: boolean;
  /**
   * Engine bookkeeping depth. Default full-analysis (product/tests).
   * Solver search/session passes score-only for ranking evals.
   */
  detailLevel?: EvalDetailLevel;
  /** Internal solver allowance for the engine's expected-charge Aftershock model. */
  allowExpectedDamageApproximation?: boolean;
}

/**
 * Exact bar evaluation with explicit mode tagging.
 * Search exploratory DPM and full robust scores never share a rank scale.
 */
export type MinimalEvaluationSummary = ScoreableSummary & {
  totalExpected?: number;
  dps?: number;
  ticks?: number;
  ok: boolean;
  error?: string;
};

export interface RevolutionBarEvaluation<
  TSummary extends ScoreableSummary = MinimalEvaluationSummary,
> {
  ok: boolean;
  /** search when horizon < robust windows; full at objective horizon. */
  mode: ScoreEvalMode;
  exploratory: boolean;
  /** Only true for successful full robust objective scores. */
  validForFinalRanking: boolean;
  horizonTicks: number;
  objectiveType: ObjectiveProfileId;
  score: number;
  reasons: ExclusionReason[];
  failureReason?: string;
  bar: Bar;
  resolved?: readonly PoolAbility[];
  /** Present when simulateRevolution ran. */
  summary?: TSummary;
  objective?: ObjectiveScore;
  metrics?: {
    dpm: number;
    totalExpected: number;
    openingDpm?: number;
    developedDpm?: number;
    steadyDpm?: number;
    /** Diagnostic only; never a ranking score. */
    knownMassExpectedDamage?: number;
    conditionalConcreteMean?: number;
  };
  profileId: ObjectiveProfileId;
}
