/** Revolution-bar solver contracts. Pure types for evaluate/search layers. */

/** Bumped when evaluation inputs change shape (e.g. Big Boned always-on). */
export const SOLVER_SCHEMA_VERSION = 4 as const;

export type Bar = readonly string[];

export type SearchTier = "thorough" | "extreme" | "unhinged";

export type ProofLabel = "globally-optimal" | "best-found" | "converged";

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

/** Minimal summary surface the objective reads — damageByTick only for numbers. */
export interface ScoreableSummary {
  ok: boolean;
  error?: string;
  horizonTicks?: number;
  damageByTick: Record<number, number>;
  rng?: {
    failedWeight?: number;
  };
}

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

export interface ScoredBar extends ObjectiveWindowDpms {
  bar: Bar;
  fingerprint: string;
  minDpm: number;
  weightedMean: number;
  robustScore: number;
  profileId: ObjectiveProfileId;
  /** Optional ranking alias (search may mirror robustScore here). */
  score?: number;
  source?: string;
}

export interface SearchStats {
  evaluations: number;
  cacheHits: number;
  cacheMisses: number;
  uniqueBars: number;
  elapsedMs: number;
  generations?: number;
  restarts?: number;
  bestScore?: number;
}

/**
 * Solver request skeleton — evaluation context is opaque to search; fingerprint
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
   * Length need not equal bar size — extra pins are ignored, missing are free.
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
}

/** Search-time evaluation modes. */
export type EvalMode = "search" | "full" | "finalize";

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
  autoAttack?: boolean;
  /** Rough expected ability damage for seed heuristics (hit-band mean if known). */
  averageDamage?: number;
  occupancyTicks?: number;
  cooldownTicks?: number;
  supportStatus?: "partially-modeled" | "not-modeled" | "mechanics-unverified";
  weaponRequirement?: "twohand" | "dualwield" | "mainhand" | "conduit" | "death-guard-and-conduit";
  requiredEquipmentAnyOf?: readonly string[];
}

export type EvaluateFn = (input: { bar: readonly string[]; mode?: EvalMode }) => EvalResult;

/** Solve orchestrator output (search layer). */
export interface SolveResult {
  best: ScoredBar;
  top: ScoredBar[];
  proof: ProofLabel;
  evaluationsUsed: number;
  evaluationBudget: number;
  exhaustiveCompleted: boolean;
  tier: SearchTier;
  seedBestScore: number;
  stats: SearchStats;
}

// ── Eligibility / candidate pool / exact evaluate ─────────────────────────

export type ExclusionCode =
  | "duplicate-id"
  | "unknown-id"
  | "size-below-min"
  | "size-above-max"
  | "off-gcd"
  | "auto-attack"
  | "replacement-group"
  | "style-mismatch"
  | "weapon-requirement"
  | "equipment-requirement"
  | "partial-support"
  | "not-modeled"
  | "mechanics-unverified"
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
  includeAutos?: boolean;
  includeOffGcd?: boolean;
  /** Include supportStatus specs (default false). */
  includePartial?: boolean;
  allow?: readonly string[];
  deny?: readonly string[];
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "shield" | "defender" | "necromancy";
  equipmentIds?: readonly string[];
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
  crit: { chance: number; disabled?: boolean; damageBonus?: number; guaranteed?: boolean };
  /** Full AbilitySpec[] at runtime; PoolAbility is the documented minimum. */
  abilities: readonly PoolAbility[];
  equipmentIds?: readonly string[];
  weaponConfiguration?: CandidatePoolOptions["weaponConfiguration"];
  startingAdrenaline?: number;
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
}

export interface RevolutionBarEvaluation {
  ok: boolean;
  exploratory: boolean;
  score: number;
  reasons: ExclusionReason[];
  bar: Bar;
  resolved?: readonly PoolAbility[];
  /** Present when simulateRevolution ran. */
  summary?: ScoreableSummary & {
    totalExpected?: number;
    dps?: number;
    ticks?: number;
    ok: boolean;
    error?: string;
  };
  objective?: ObjectiveScore;
  metrics?: {
    dpm: number;
    totalExpected: number;
    openingDpm?: number;
    developedDpm?: number;
    steadyDpm?: number;
  };
  profileId: ObjectiveProfileId;
}
