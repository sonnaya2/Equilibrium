import type { DamageSourceKind } from "../simulation/contracts";

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

/**
 * Engine-owned weighted analysis ledgers. Updated during event accounting and
 * merged with branch history - never reconstructed from representative events.
 */
export interface EffectAnalysisLedger {
  id: string;
  kind: DamageSourceKind;
  totalDamage: number;
  directDamage: number;
  dotDamage: number;
  criticalContribution: number;
  capLoss: number;
  /** Probability-weighted owning casts (ability-family events). */
  expectedCasts: number;
  /** Probability-weighted proc rolls (e.g. Inferno 5%). */
  expectedTriggerRolls: number;
  /** Probability-weighted times the effect occurs. */
  expectedActivations: number;
  /** Probability-weighted separate hits; attached riders contribute 0. */
  expectedSeparateHits: number;
  /** Probability-weighted attached bonus components (Big Boned, Cinders rider, etc.). */
  expectedAttachedComponents: number;
  /** Delayed player-poison hits earned by this effect's landed hits. */
  expectedPlayerPoisonHits: number;
  /**
   * Bonus-damage riders attributed onto this parent effect (how much Big Boned
   * added to its damage). Always 0 on the rider's own row - rider Total is the
   * bonus amount. Do not sum Bonus across rows with Total (would double-count).
   */
  bonusDamage: number;
  /** Same-effect blessing rows retained by their originating blessing. */
  sources?: Map<string, EffectAnalysisSourceLedger>;
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
  /**
   * Per-run cast identity for cast-count dedup before any branch merge.
   * Keys are `effectId:sourceCast`. Not part of the merge signature - only the
   * numeric `expectedCasts` field is weight-averaged after merge.
   */
  castKeys: Set<string>;
  /**
   * Offsets so support extrema survive weight-averaging of path conditionals.
   * `supportMin = totalMin + supportMinOffset` (offset ≤ 0 after any merge).
   * Future landings that bump `totalMin` keep support correct without replaying
   * the event log.
   */
  supportMinOffset: number;
  supportMaxOffset: number;
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
  };
}

/** Weight-average two analysis states (branch merge). */
export function mixAnalysisStates(
  a: RuntimeAnalysisState,
  b: RuntimeAnalysisState,
  weightA: number,
  weightB: number,
): RuntimeAnalysisState {
  const weight = weightA + weightB;
  const mix = (x: number, y: number) => (weightA * x + weightB * y) / weight;
  const effectIds = new Set([...a.effects.keys(), ...b.effects.keys()]);
  const effects = new Map<string, EffectAnalysisLedger>();
  for (const id of effectIds) {
    const left = a.effects.get(id);
    const right = b.effects.get(id);
    const sample = left ?? right!;
    const sourceIds = new Set([
      ...(left?.sources?.keys() ?? []),
      ...(right?.sources?.keys() ?? []),
    ]);
    const sources = new Map<string, EffectAnalysisSourceLedger>();
    for (const sourceId of sourceIds) {
      const sourceLeft = left?.sources?.get(sourceId);
      const sourceRight = right?.sources?.get(sourceId);
      const sourceSample = sourceLeft ?? sourceRight!;
      sources.set(sourceId, {
        blessingId: sourceSample.blessingId,
        totalDamage: mix(sourceLeft?.totalDamage ?? 0, sourceRight?.totalDamage ?? 0),
        directDamage: mix(sourceLeft?.directDamage ?? 0, sourceRight?.directDamage ?? 0),
        dotDamage: mix(sourceLeft?.dotDamage ?? 0, sourceRight?.dotDamage ?? 0),
        criticalContribution: mix(
          sourceLeft?.criticalContribution ?? 0,
          sourceRight?.criticalContribution ?? 0,
        ),
        capLoss: mix(sourceLeft?.capLoss ?? 0, sourceRight?.capLoss ?? 0),
        expectedCasts: mix(sourceLeft?.expectedCasts ?? 0, sourceRight?.expectedCasts ?? 0),
        expectedTriggerRolls: mix(
          sourceLeft?.expectedTriggerRolls ?? 0,
          sourceRight?.expectedTriggerRolls ?? 0,
        ),
        expectedActivations: mix(
          sourceLeft?.expectedActivations ?? 0,
          sourceRight?.expectedActivations ?? 0,
        ),
        expectedSeparateHits: mix(
          sourceLeft?.expectedSeparateHits ?? 0,
          sourceRight?.expectedSeparateHits ?? 0,
        ),
        expectedAttachedComponents: mix(
          sourceLeft?.expectedAttachedComponents ?? 0,
          sourceRight?.expectedAttachedComponents ?? 0,
        ),
        expectedPlayerPoisonHits: mix(
          sourceLeft?.expectedPlayerPoisonHits ?? 0,
          sourceRight?.expectedPlayerPoisonHits ?? 0,
        ),
        bonusDamage: mix(sourceLeft?.bonusDamage ?? 0, sourceRight?.bonusDamage ?? 0),
      });
    }
    effects.set(id, {
      id,
      kind: sample.kind,
      totalDamage: mix(left?.totalDamage ?? 0, right?.totalDamage ?? 0),
      directDamage: mix(left?.directDamage ?? 0, right?.directDamage ?? 0),
      dotDamage: mix(left?.dotDamage ?? 0, right?.dotDamage ?? 0),
      criticalContribution: mix(left?.criticalContribution ?? 0, right?.criticalContribution ?? 0),
      capLoss: mix(left?.capLoss ?? 0, right?.capLoss ?? 0),
      expectedCasts: mix(left?.expectedCasts ?? 0, right?.expectedCasts ?? 0),
      expectedTriggerRolls: mix(left?.expectedTriggerRolls ?? 0, right?.expectedTriggerRolls ?? 0),
      expectedActivations: mix(left?.expectedActivations ?? 0, right?.expectedActivations ?? 0),
      expectedSeparateHits: mix(left?.expectedSeparateHits ?? 0, right?.expectedSeparateHits ?? 0),
      expectedAttachedComponents: mix(
        left?.expectedAttachedComponents ?? 0,
        right?.expectedAttachedComponents ?? 0,
      ),
      expectedPlayerPoisonHits: mix(
        left?.expectedPlayerPoisonHits ?? 0,
        right?.expectedPlayerPoisonHits ?? 0,
      ),
      bonusDamage: mix(left?.bonusDamage ?? 0, right?.bonusDamage ?? 0),
      ...(sources.size > 0 ? { sources } : {}),
      ...(left?.minimumDamage !== undefined || right?.minimumDamage !== undefined
        ? { minimumDamage: mix(left?.minimumDamage ?? 0, right?.minimumDamage ?? 0) }
        : {}),
      ...(left?.maximumDamage !== undefined || right?.maximumDamage !== undefined
        ? { maximumDamage: mix(left?.maximumDamage ?? 0, right?.maximumDamage ?? 0) }
        : {}),
    });
  }
  const sourceKinds = new Set([...a.sources.keys(), ...b.sources.keys()]);
  const sources = new Map<DamageSourceKind, number>();
  for (const kind of sourceKinds) {
    sources.set(kind, mix(a.sources.get(kind) ?? 0, b.sources.get(kind) ?? 0));
  }
  return {
    effects,
    sources,
    playerPoisonContinuationAttempts: mix(
      a.playerPoisonContinuationAttempts,
      b.playerPoisonContinuationAttempts,
    ),
    playerPoisonContinuationActivations: mix(
      a.playerPoisonContinuationActivations,
      b.playerPoisonContinuationActivations,
    ),
    directDamage: mix(a.directDamage, b.directDamage),
    dotDamage: mix(a.dotDamage, b.dotDamage),
    criticalContribution: mix(a.criticalContribution, b.criticalContribution),
    capLoss: mix(a.capLoss, b.capLoss),
    // Post-merge castKeys are unused; expected casts are already mixed.
    castKeys: new Set(),
    // Offsets are set by branch mergePair from path totals after this mix.
    supportMinOffset: a.supportMinOffset,
    supportMaxOffset: a.supportMaxOffset,
  };
}
