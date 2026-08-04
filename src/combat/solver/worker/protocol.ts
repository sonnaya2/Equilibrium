import type { SerializableSolverRequest, SolverProofDTO, SolverResultDTO } from "./serializable";
import type { HostCoordBatch, WorkerCoordReport } from "./coord";

export type { SolverResultDTO, SolverProofDTO };
export type { HostCoordBatch, WorkerCoordReport };

/** Search phase labels posted with progress (opaque to the host UI). */
export type SolverPhase = "seed" | "explore" | "exploit" | "finalize" | "paused" | "idle";

/**
 * Parallel pool instrumentation (cloneable).
 * Phase 2: uniqueCandidates is host global visited set size when knownWrong is false.
 * globalBudget = perAgentBudget * agentCount preserves Phase-0 total evaluation capacity.
 */
export interface SolverPoolMetrics {
  /** Agents launched this run. */
  agentCount: number;
  /**
   * Per-agent local evaluation cap (TIER_BUDGETS[tier]).
   * Local search loops still use this; global work is capped by globalBudget.
   */
  perAgentBudget: number;
  /**
   * Shared evaluation budget across all agents (= perAgentBudget * agentCount).
   * Preserves Phase-0 total capacity while host may stop stragglers when spent.
   */
  globalBudget: number;
  /**
   * @deprecated alias of globalBudget (Phase-0 name). Prefer globalBudget.
   */
  globalBudgetSum: number;
  /**
   * Distinct bars for display: host visited-set size when knownWrong is false;
   * otherwise the naive multi-agent sum (same as uniqueCandidatesSum).
   */
  uniqueCandidates: number;
  /**
   * Always the naive sum of per-agent uniqueCandidates (measure-only).
   * Double-counts shared bars across agents; not host-set cardinality.
   */
  uniqueCandidatesSum: number;
  /**
   * False when uniqueCandidates is host-set cardinality (workers sent seenKeys).
   * True when uniqueCandidates is still the naive multi-agent sum.
   */
  uniqueCandidatesSumKnownWrong: boolean;
  /**
   * Lower-bound distinct bars from progress key samples (seenKeys + previews)
   * when no authoritative host set is available. Omitted when empty.
   */
  uniqueCandidatesEstimate?: number;
  /** Sum of per-agent evaluation counters (toward globalBudget). */
  globalEvaluations?: number;
  /** True when host requested soft-stop (budget exhausted or stop criterion). */
  coordStop?: boolean;
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
   * Whether the planner held back a core for the UI main thread this run.
   * See workerPlan.RESERVES_UI_CORE (only when hardwareCores > tierMax + 1).
   */
  reservedCore: boolean;
  /** Agent indexes in the order they posted result (first finisher first). */
  finishOrder?: readonly number[];
  /** Per-agent evaluation counts (index-aligned with agent slots). */
  agentEvaluations?: readonly number[];
  /** Agents hard-cancelled as stragglers after stop / budget. */
  stragglersCancelled?: number;
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
  evaluationMode?: "search" | "medium" | "full" | "finalize";
  /** Multi-fidelity tag for the current / last step. */
  fidelity?: "short" | "medium" | "full";
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
   * Merged display budget. Pool path: shared globalBudget (perAgent * agentCount).
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
  /** Pool instrumentation (optional; pool path only). */
  poolMetrics?: SolverPoolMetrics;
  /**
   * New bar identity keys since last progress (worker -> host, batched).
   * Host folds into the global visited set. Omitted on single-agent path.
   */
  seenKeys?: readonly string[];
  proof?: SolverProofDTO;
}

/** One parallel agent's live status (cloneable). */
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
  /** Optional pool coordination bootstrap (Phase 2). Older workers ignore. */
  coord?: {
    agentIndex: number;
    agentCount: number;
    perAgentBudget: number;
    globalBudget: number;
  };
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

/** Host -> worker: batched coordination (visited + incumbent + stop + budgets). */
export interface CoordSolverMessage {
  type: "coord";
  requestId: number;
  batch: HostCoordBatch;
}

export type HostToWorkerMessage =
  | StartSolverMessage
  | CancelSolverMessage
  | PauseSolverMessage
  | ResumeSolverMessage
  | CoordSolverMessage;

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

export interface CoordReportSolverMessage {
  type: "coord_report";
  requestId: number;
  report: WorkerCoordReport;
}

export type WorkerToHostMessage =
  | StartedSolverMessage
  | ProgressSolverMessage
  | ResultSolverMessage
  | ErrorSolverMessage
  | CancelledSolverMessage
  | CoordReportSolverMessage;

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
  if (t === "coord") {
    return (value as { batch?: unknown }).batch !== undefined;
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
    case "coord_report":
      return (value as { report?: unknown }).report !== undefined;
    default:
      return false;
  }
}
