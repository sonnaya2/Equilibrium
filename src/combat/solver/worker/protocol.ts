import type { SerializableSolverRequest, SolverProofDTO, SolverResultDTO } from "./serializable";

export type { SolverResultDTO, SolverProofDTO };

/** Search phase labels posted with progress (opaque to the host UI). */
export type SolverPhase = "seed" | "explore" | "exploit" | "finalize" | "paused" | "idle";

/**
 * Incremental search status. Keep fields cloneable — no Maps/Sets/functions.
 * topBarPreview is ability ids only so the UI can render without ability specs.
 */
export interface SolverProgress {
  evaluations: number;
  uniqueCandidates: number;
  bestScore: number;
  windowDpms: number;
  phase: SolverPhase;
  noImprovementCount: number;
  topBarPreview: readonly string[];
  /** Soft budget for UI fill (not a hard promise). */
  evaluationBudget?: number;
  /** 0–1 estimated progress for the track fill. */
  progressRatio?: number;
  /** Finalize shortlist re-score step (UI only — search budget is separate). */
  finalizeStep?: number;
  finalizeTotal?: number;
  proof?: SolverProofDTO;
}

// ── Main → Worker ──────────────────────────────────────────────────────────

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

// ── Worker → Main ──────────────────────────────────────────────────────────

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
  ProgressSolverMessage | ResultSolverMessage | ErrorSolverMessage | CancelledSolverMessage;

export function isHostToWorkerMessage(value: unknown): value is HostToWorkerMessage {
  if (value === null || typeof value !== "object") return false;
  const t = (value as { type?: unknown }).type;
  return t === "start" || t === "cancel" || t === "pause" || t === "resume";
}

export function isWorkerToHostMessage(value: unknown): value is WorkerToHostMessage {
  if (value === null || typeof value !== "object") return false;
  const t = (value as { type?: unknown }).type;
  return t === "progress" || t === "result" || t === "error" || t === "cancelled";
}
