export type DracolichSetId = "dracolich" | "elite-dracolich";

export interface DracolichSetSummary {
  setId: DracolichSetId | null;
  physicalPieces: number;
  effectivePieces: number;
  bowEligible: boolean;
  mixed: boolean;
  adrenalinePerRapidFireHit: number;
  infusionCritChance: number;
  infusionDurationTicks: number;
  thresholds: {
    three: boolean;
    four: boolean;
    five: boolean;
  };
}

export interface DracolichInfusionState {
  startsAtTick: number;
  expiresAtTick: number;
  critChance: number;
}

export const inactiveDracolichInfusion = (): DracolichInfusionState => ({
  startsAtTick: 0,
  expiresAtTick: 0,
  critChance: 0,
});

export function dracolichInfusionActive(state: DracolichInfusionState, tick: number): boolean {
  return tick >= state.startsAtTick && tick < state.expiresAtTick;
}

export function dracolichInfusionCritChance(state: DracolichInfusionState, tick: number): number {
  return dracolichInfusionActive(state, tick) ? state.critChance : 0;
}

export function dracolichAdrenalinePerRapidFireHit(
  effects: { dracolich?: DracolichSetSummary } | undefined,
): number {
  return effects?.dracolich?.adrenalinePerRapidFireHit ?? 0;
}

export function dracolichInfusionAtCompletion(
  effects: { dracolich?: DracolichSetSummary } | undefined,
  completionTick: number,
): DracolichInfusionState | undefined {
  const summary = effects?.dracolich;
  if (!summary?.bowEligible || !summary.thresholds.three || summary.infusionDurationTicks <= 0) {
    return undefined;
  }
  return {
    startsAtTick: completionTick,
    expiresAtTick: completionTick + summary.infusionDurationTicks,
    critChance: summary.infusionCritChance,
  };
}
