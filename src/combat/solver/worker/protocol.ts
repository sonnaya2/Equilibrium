import type { SerializableSolverRequest, SolverProofDTO, SolverResultDTO } from "./serializable";

export type { SolverResultDTO, SolverProofDTO };

/** Search phase labels posted with progress (opaque to the host UI). */
export type SolverPhase = "seed" | "explore" | "exploit" | "finalize" | "paused" | "idle";

/**
 * Phase-0 parallel pool instrumentation (measure only, cloneable).
 * Reflects current independent per-agent budgets - not a shared global budget.
 */
export interface SolverPoolMetrics {
  /** Agents launched this run. */
  agentCount: number;
  /**
   * Per-agent evaluation budget (TIER_BUDGETS[tier] each agent still receives in full).
   * Independent-budget behavior: every agent spends this many evals on its own.
   */
  perAgentBudget: number;
  /**
   * Sum of per-agent budgets (= perAgentBudget * agentCount).
   * Measure-only stand-in until a real shared global budget ships.
   */
  globalBudgetSum: number;
  /**
   * Sum of uniqueCandidates across agents.
   * Known-wrong: agents double-count shared bars; not host-side set cardinality.
   */
  uniqueCandidatesSum: number;
  /** True when uniqueCandidatesSum is a naive sum (always true in Phase 0). */
  uniqueCandidatesSumKnownWrong: true;
  /**
   * Wall-clock ms from pool start until the first agent posted a final result.
   * Undefined until at least one agent finishes.
   */
  firstFinishedMs?: number;
  /**
   * Wall-clock ms from pool start until the last agent among those that finished
   * successfully so far (or all settled at result time).
   */
  lastFinishedMs?: number;
  /**
   * lastFinishedMs - firstFinishedMs: time waiting on the slowest finished agent
   * after the first finished. Undefined until both ends are known.
   */
  stragglerWaitMs?: number;
  /** Logical cores used when planning (navigator.hardwareConcurrency or override). */
  hardwareCores?: number;
  /**
   * Whether the planner holds back a core for the UI main thread.
   * Phase 0: false - preferredAgentCount may claim full hardwareConcurrency.
   */
  reservedCore: boolean;
  /** Agent indexes in the order they posted result (first finisher first). */
  finishOrder?: readonly number[];
  /** Per-agent evaluation counts (index-aligned with agent slots). */
  agentEvaluations?: readonly number[];
}

/**
 * Incremental search status. Keep fields cloneable - no Maps/Sets/functions.
 * topBarPreview is ability ids only so the UI can render without ability specs.
 */
export interface SolverProgress {
  evaluations: number;
  uniqueCandidates: number;
  /** Exploratory (search) best DPM - same units for the whole run. */
  bestScore: number;
  /** Explicit dual fields (honest). Prefer these over parsing proof.notes. */
  bestExploratoryScore?: number;
  bestFullScore?: number;
  searchEvaluations?: number;
  fullEvaluations?: number;
  /** Current evaluation scale for the latest step if useful. */
  evaluationMode?: "search" | "full" | "finalize";
  windowDpms: number;
  phase: SolverPhase;
  noImprovementCount: number;
  /** Best exploratory bar so far (stable until beaten). */
  topBarPreview: readonly string[];
  /**
   * Bar currently under evaluation. Changes every try so the UI can cycle
   * candidates; distinct from topBarPreview (best-so-far).
   */
  activeBarPreview?: readonly string[];
  /**
   * Merged display budget. Pool path sets this to perAgentBudget * agentCount
   * (global sum of independent budgets), not a shared cap.
   */
  evaluationBudget?: number;
  progressRatio?: number;
  finalizeStep?: number;
  finalizeTotal?: number;
  /**
   * Human-readable finalize status, e.g. "Full-horizon score 2/4".
   * UI should prefer this over inventing copy from phase alone.
   */
  scoringLabel?: string;
  /** Ability ids of the bar currently being full-scored (finalize only). */
  scoringBarPreview?: readonly string[];
  /** Parallel agent count when the pool is running (search phase). */
  agentCount?: number;
  /** Per-agent snapshot for UI worker glyphs (pool merge). */
  agents?: readonly SolverAgentSnapshot[];
  /**
   * Full-horizon evals served from the process-local eval memo (skip sim).
   * High during re-Optimize on the same loadout - scoring looks instant.
   */
  fullMemoHits?: number;
  /** Phase-0 pool instrumentation (optional; pool path only). */
  poolMetrics?: SolverPoolMetrics;
  proof?: SolverProofDTO;
}

/** One parallel agent’s live status (cloneable). */
export interface SolverAgentSnapshot {
  index: number;
  phase: SolverPhase;
  evaluations: number;
  bestScore: number;
  progressRatio?: number;
  /** True after that agent posted a final result. */
  finished?: boolean;
  /** Search recipe this worker runs (for UI grouping / hover). */
  recipe?: "default" | "evolutionary" | "anneal_local";
  /** Fixed bar length this worker searches. */
  barLength?: number;
  /**
   * 0-based finish rank among agents that posted a result (0 = first finisher).
   * Undefined while that agent is still running.
   */
  finishRank?: number;
  /** Independent per-agent evaluation budget (same as poolMetrics.perAgentBudget). */
  evaluationBudget?: number;
}

export interface StartSolverMessage {
  type: "start";
  requestId: number;
  payload: SerializableSolverRequest;
}

export interface CancelSolverMessage {
  type: "cancel";
  requestId: number;
}

export interface PauseSolverMessage {
  type: "pause";
  requestId: number;
}

export interface ResumeSolverMessage {
  type: "resume";
  requestId: number;
}

export type HostToWorkerMessage =
  StartSolverMessage | CancelSolverMessage | PauseSolverMessage | ResumeSolverMessage;

/** Immediate ACK before expensive imports/solve - clears host cold-start watchdog. */
export interface StartedSolverMessage {
  type: "started";
  requestId: number;
}

export interface ProgressSolverMessage {
  type: "progress";
  requestId: number;
  progress: SolverProgress;
}

export interface ResultSolverMessage {
  type: "result";
  requestId: number;
  result: SolverResultDTO;
}

export interface ErrorSolverMessage {
  type: "error";
  requestId: number;
  error: string;
}

export interface CancelledSolverMessage {
  type: "cancelled";
  requestId: number;
}

export type WorkerToHostMessage =
  | StartedSolverMessage
  | ProgressSolverMessage
  | ResultSolverMessage
  | ErrorSolverMessage
  | CancelledSolverMessage;

function isFiniteRequestId(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isHostToWorkerMessage(value: unknown): value is HostToWorkerMessage {
  if (value === null || typeof value !== "object") return false;
  const msg = value as { type?: unknown; requestId?: unknown };
  if (!isFiniteRequestId(msg.requestId)) return false;
  const t = msg.type;
  if (t === "start") {
    return (value as { payload?: unknown }).payload !== undefined;
  }
  return t === "cancel" || t === "pause" || t === "resume";
}

export function isWorkerToHostMessage(value: unknown): value is WorkerToHostMessage {
  if (value === null || typeof value !== "object") return false;
  const msg = value as { type?: unknown; requestId?: unknown };
  if (!isFiniteRequestId(msg.requestId)) return false;
  switch (msg.type) {
    case "started":
    case "cancelled":
      return true;
    case "progress":
      return (value as { progress?: unknown }).progress !== undefined;
    case "result":
      return (value as { result?: unknown }).result !== undefined;
    case "error":
      return typeof (value as { error?: unknown }).error === "string";
    default:
      return false;
  }
}
