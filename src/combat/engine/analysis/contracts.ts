import type { DamageSourceKind, SongDamageAnalysis } from "../simulation/contracts";

export interface EffectAnalysisSourceLedger {
  blessingId: string;
  totalDamage: number;
  directDamage: number;
  dotDamage: number;
  criticalContribution: number;
  capLoss: number;
  expectedCasts: number;
  expectedTriggerRolls: number;
  expectedActivations: number;
  expectedSeparateHits: number;
  expectedAttachedComponents: number;
  expectedPlayerPoisonHits: number;
  bonusDamage: number;
}

export interface EffectAnalysisLedger {
  id: string;
  kind: DamageSourceKind;
  totalDamage: number;
  directDamage: number;
  dotDamage: number;
  criticalContribution: number;
  capLoss: number;
  expectedCasts: number;
  expectedTriggerRolls: number;
  expectedActivations: number;
  expectedSeparateHits: number;
  expectedAttachedComponents: number;
  expectedPlayerPoisonHits: number;
  bonusDamage: number;
  sources?: Map<string, EffectAnalysisSourceLedger>;
  analysisGroupId?: string;
  analysisGroupActivations?: number;
  minimumDamage?: number;
  maximumDamage?: number;
}

export interface RuntimeAnalysisState {
  effects: Map<string, EffectAnalysisLedger>;
  sources: Map<DamageSourceKind, number>;
  playerPoisonContinuationAttempts: number;
  playerPoisonContinuationActivations: number;
  directDamage: number;
  dotDamage: number;
  criticalContribution: number;
  capLoss: number;
  castKeys: Set<string>;
  supportMinOffset: number;
  supportMaxOffset: number;
  song: SongDamageAnalysis;
}

export function emptyAnalysisState(): RuntimeAnalysisState {
  return {
    effects: new Map(),
    sources: new Map(),
    playerPoisonContinuationAttempts: 0,
    playerPoisonContinuationActivations: 0,
    directDamage: 0,
    dotDamage: 0,
    criticalContribution: 0,
    capLoss: 0,
    castKeys: new Set(),
    supportMinOffset: 0,
    supportMaxOffset: 0,
    song: {
      pieceCount: 0,
      enabled: false,
      twoPiece: false,
      finalStacks: 0,
      peakStacks: 0,
      empowermentRolls: 0,
      empowermentActivations: 0,
      immediateHitCount: 0,
      soulfireCasts: 0,
      conflagrateConsumptions: 0,
      essenceFlatBonusDamage: 0,
      timedAdrenalineGained: 0,
    },
  };
}

export function cloneAnalysisState(state: RuntimeAnalysisState): RuntimeAnalysisState {
  return {
    effects: new Map(
      [...state.effects].map(([id, ledger]) => [
        id,
        {
          ...ledger,
          ...(ledger.sources
            ? {
                sources: new Map(
                  [...ledger.sources].map(([sourceId, source]) => [sourceId, { ...source }]),
                ),
              }
            : {}),
        },
      ]),
    ),
    sources: new Map(state.sources),
    playerPoisonContinuationAttempts: state.playerPoisonContinuationAttempts,
    playerPoisonContinuationActivations: state.playerPoisonContinuationActivations,
    directDamage: state.directDamage,
    dotDamage: state.dotDamage,
    criticalContribution: state.criticalContribution,
    capLoss: state.capLoss,
    castKeys: new Set(state.castKeys),
    supportMinOffset: state.supportMinOffset,
    supportMaxOffset: state.supportMaxOffset,
    song: { ...state.song },
  };
}
