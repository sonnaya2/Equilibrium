import type { DamageSourceKind } from "../simulation/contracts";

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
  /** Distinct owning casts (ability-family events), weight-averaged after merges. */
  casts: number;
  /** Probability rolls that produced expected activations (e.g. Inferno 5%). */
  triggerRolls: number;
  /** Probability-weighted times the effect occurs. */
  expectedActivations: number;
  /** Probability-weighted separate hits; attached riders contribute 0. */
  expectedSeparateHits: number;
  /** Attached bonus components (Big Boned, Cinders rider, …). */
  attachedComponents: number;
  /**
   * Bonus-damage riders attributed onto this parent skill (how much Big Boned
   * added on its hits). Always 0 on the rider's own row - rider Total is the
   * bonus amount. Do not sum Bonus across rows with Total (would double-count).
   */
  bonusDamage: number;
}

export interface RuntimeAnalysisState {
  effects: Map<string, EffectAnalysisLedger>;
  sources: Map<DamageSourceKind, number>;
  directDamage: number;
  dotDamage: number;
  criticalContribution: number;
  capLoss: number;
  /**
   * Per-run cast identity for cast-count dedup before any branch merge.
   * Keys are `effectId:sourceCast`. Not part of the merge signature - only the
   * numeric `casts` field is weight-averaged after merge.
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
    effects: new Map([...state.effects].map(([id, ledger]) => [id, { ...ledger }])),
    sources: new Map(state.sources),
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
    effects.set(id, {
      id,
      kind: sample.kind,
      totalDamage: mix(left?.totalDamage ?? 0, right?.totalDamage ?? 0),
      directDamage: mix(left?.directDamage ?? 0, right?.directDamage ?? 0),
      dotDamage: mix(left?.dotDamage ?? 0, right?.dotDamage ?? 0),
      criticalContribution: mix(left?.criticalContribution ?? 0, right?.criticalContribution ?? 0),
      capLoss: mix(left?.capLoss ?? 0, right?.capLoss ?? 0),
      casts: mix(left?.casts ?? 0, right?.casts ?? 0),
      triggerRolls: mix(left?.triggerRolls ?? 0, right?.triggerRolls ?? 0),
      expectedActivations: mix(left?.expectedActivations ?? 0, right?.expectedActivations ?? 0),
      expectedSeparateHits: mix(left?.expectedSeparateHits ?? 0, right?.expectedSeparateHits ?? 0),
      attachedComponents: mix(left?.attachedComponents ?? 0, right?.attachedComponents ?? 0),
      bonusDamage: mix(left?.bonusDamage ?? 0, right?.bonusDamage ?? 0),
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
    directDamage: mix(a.directDamage, b.directDamage),
    dotDamage: mix(a.dotDamage, b.dotDamage),
    criticalContribution: mix(a.criticalContribution, b.criticalContribution),
    capLoss: mix(a.capLoss, b.capLoss),
    // Post-merge castKeys are unused; numeric casts already mixed.
    castKeys: new Set(),
    // Offsets are set by branch mergePair from path totals after this mix.
    supportMinOffset: a.supportMinOffset,
    supportMaxOffset: a.supportMaxOffset,
  };
}
