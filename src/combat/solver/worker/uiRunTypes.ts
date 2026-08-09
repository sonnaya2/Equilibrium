import type { CombatStyle } from "../../types";
import type { RotationSummary } from "../../engine/simulation/simulate";
import type { StochasticRunMeta } from "../uiRunCore";
import type { SerializableRevolutionSimBase } from "./serializable";

export function toSerializableUiRunSummary(summary: RotationSummary): RotationSummary {
  return {
    ...summary,
    events: summary.events.map(({ castSnap: _castSnap, ...event }) => event),
  };
}

export interface SerializableUiRunRequest {
  loadout: SerializableRevolutionSimBase;
  barIds: readonly string[];
  style: CombatStyle;
  durationTicks: number;
}

export interface UiRunWorkerResult {
  summary: RotationSummary;
  meta: StochasticRunMeta;
}
