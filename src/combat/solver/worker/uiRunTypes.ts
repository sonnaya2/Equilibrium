/** Clone-safe UI Run bar job payloads (worker protocol). */
import type { CombatStyle } from "../../types";
import type { SerializableRevolutionSimBase } from "./serializable";
import type { BranchFidelityAttemptMeta } from "../branchFidelity";
import type { UiRunProbeResult } from "../uiRunCore";
import type { RotationSummary } from "../../engine/simulation/simulate";

export interface SerializableUiRunRequest {
  loadout: SerializableRevolutionSimBase;
  barIds: readonly string[];
  style: CombatStyle;
  durationTicks: number;
  /** When set, single-cap probe (score-only). */
  maxLiveBranches?: number;
  /** When true, full-analysis at maxLiveBranches (required). */
  fullAnalysis?: boolean;
}

export interface UiRunProbeWorkerResult {
  kind: "probe";
  probe: UiRunProbeResult;
}

export interface UiRunFullWorkerResult {
  kind: "full";
  summary: RotationSummary;
  meta: BranchFidelityAttemptMeta;
}

export type UiRunWorkerResult = UiRunProbeWorkerResult | UiRunFullWorkerResult;
