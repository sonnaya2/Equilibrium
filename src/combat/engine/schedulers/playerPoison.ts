import {
  PLAYER_POISON_EFFECT_ID,
  PLAYER_POISON_FIRST_HIT_DELAY,
  PLAYER_POISON_STATUS_TICKS,
  PLAYER_POISON_ZERO_DAMAGE_DECAY_INDEX,
  activeEvolvingToxinStacks,
  evolvingToxinPoisonModifier,
  isTargetPoisonImmune,
  playerPoisonDamage,
  resolvePoisonApplication,
  type PoisonApplicationSnapshot,
  type PoisonDamageBand,
} from "../../poison/mechanics";
import { isRangedAmmoActive } from "../../styles/ranged/ammoModel";
import { envenomedPoisonImmunityDisableTicks } from "../../league/ruleset";
import { resolveLeagueAttachedTerms, type LeagueAttachedTerm } from "../../league/damage";
import { resolveHostDamageInstance } from "../../core/hostDamage";
import { runPipeline } from "../../pipeline/modifierPipeline";
import { contextWithProvenance } from "../../shared/damageProvenance";
import type { CombatModifier } from "../../types";
import {
  notePoisonAtomMerge,
  notePoisonOrderingScan,
  notePoisonProbabilityMaterialization,
  notePoisonTransitionCache,
} from "../../profiling/allocation";
import { keepsAnalysisLedgers } from "../simulation/contracts";
import { recordResolved } from "../resolution";
import { abilityDamageAt } from "../resolution/castHit";
import {
  NO_DAMAGE,
  type AttachedDamageComponent,
  type EventResolution,
  type ResolvedDamage,
} from "../resolution/types";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import {
  patchTarget,
  inactiveTargetWeaponPoisonState,
  internTargetWeaponPoisonFuture,
  type TargetWeaponPoisonAtom,
  type TargetWeaponPoisonDistribution,
  type TargetWeaponPoisonHitMultiplicity,
  type TargetWeaponPoisonPendingHit,
  type TargetWeaponPoisonState,
} from "../runtime/state";

type PoisonAtomWithHistory = TargetWeaponPoisonAtom & {
  readonly supportMin: number;
  readonly supportMax: number;
  readonly supportParents: readonly number[];
};

interface CachedPoisonDistribution {
  readonly atoms: readonly TargetWeaponPoisonAtom[];
  readonly nextAtomId: number;
  readonly futureId: number;
  readonly supportParentsByAtom: Readonly<Record<number, readonly number[]>>;
}

interface CachedPoisonLandTransition {
  readonly distribution: CachedPoisonDistribution;
  readonly result: PlayerPoisonLandResult;
}

interface CachedPoisonEventTransition {
  readonly distribution: CachedPoisonDistribution;
  readonly nextSeq: number;
  readonly continuationAttempts: number;
  readonly continuationActivations: number;
  readonly continuationHits: number;
}

const poisonLandTransitionCaches = new WeakMap<object, Map<string, CachedPoisonLandTransition>>();
const poisonEventTransitionCaches = new WeakMap<object, Map<string, CachedPoisonEventTransition>>();
const MAX_POISON_TRANSITIONS = 512;

function rememberPoisonTransition<T>(cache: Map<string, T>, key: string, value: T): void {
  cache.set(key, value);
  if (cache.size <= MAX_POISON_TRANSITIONS) return;
  const oldest = cache.keys().next().value;
  if (oldest !== undefined) cache.delete(oldest);
}

export interface PlayerPoisonEventOrder {
  tick: number;
  seq: number;
}

export interface PlayerPoisonLandOccurrence {
  occurrenceProbability: number;
  expectedOccurrences: number;
  applicationSuccessProbability: number;
  applicationSuccessMultiplicity: TargetWeaponPoisonHitMultiplicity;
  immunityDisabledUntilTick: number;
}

export interface PlayerPoisonLandResult {
  expectedAttempts: number;
  expectedSuccesses: number;
  expectedApplicationHits: number;
}

const DECAY_OVERFLOW = PLAYER_POISON_ZERO_DAMAGE_DECAY_INDEX;
const ZERO_DECAY_MASS = Array.from({ length: DECAY_OVERFLOW + 1 }, (_, index) =>
  index === 0 ? 1 : 0,
);
const SINGLE_COUNT_MASS = [0, 1];
const trailingDecayMassCache = new Map<string, number[]>();
const finiteCountMassCache = new Map<string, number[]>();
const geometricZeroDecayMassCache = new Map<number, number[]>();

function normalizedDecayMass(mass: readonly number[]): number[] {
  if (mass.length === DECAY_OVERFLOW + 1) return mass as number[];
  const normalized = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  for (let index = 0; index < mass.length; index++) {
    normalized[Math.min(index, DECAY_OVERFLOW)]! += mass[index] ?? 0;
  }
  return normalized;
}

function pointDecayMass(index = 0): number[] {
  if (index === 0) return ZERO_DECAY_MASS;
  const mass = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  mass[Math.min(Math.max(0, Math.floor(index)), DECAY_OVERFLOW)] = 1;
  return mass;
}

function decayMean(mass: readonly number[]): number {
  return mass.reduce((sum, probability, index) => sum + probability * index, 0);
}

function mixDecayMass(
  left: readonly number[],
  right: readonly number[],
  leftWeight: number,
  rightWeight: number,
): number[] {
  const total = leftWeight + rightWeight;
  const a = normalizedDecayMass(left);
  const b = normalizedDecayMass(right);
  return a.map((value, index) => (leftWeight * value + rightWeight * b[index]!) / total);
}

function shiftDecayMass(mass: readonly number[], steps: number): number[] {
  const source = normalizedDecayMass(mass);
  const shifted = new Array<number>(DECAY_OVERFLOW + 1).fill(0);
  const overflowStart = Math.max(0, DECAY_OVERFLOW - steps);
  for (let index = 0; index < overflowStart; index++) {
    shifted[index + steps] = source[index]!;
  }
  for (let index = overflowStart; index <= DECAY_OVERFLOW; index++) {
    shifted[DECAY_OVERFLOW]! += source[index]!;
  }
  return shifted;
}

function geometricZeroDecayMass(continuation: number): number[] {
  const cached = geometricZeroDecayMassCache.get(continuation);
  if (cached) return cached;
  const mass = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  for (let index = 0; index < DECAY_OVERFLOW; index++) {
    mass[index] = (1 - continuation) * continuation ** index;
  }
  mass[DECAY_OVERFLOW] = continuation ** DECAY_OVERFLOW;
  geometricZeroDecayMassCache.set(continuation, mass);
  return mass;
}

function geometricShiftDecayMass(initial: readonly number[], continuation: number): number[] {
  const shifted = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  const source = normalizedDecayMass(initial);
  for (let start = 0; start <= DECAY_OVERFLOW; start++) {
    const sourceMass = source[start]!;
    if (!(sourceMass > 0)) continue;
    const room = DECAY_OVERFLOW - start;
    for (let steps = 1; steps < room; steps++) {
      shifted[start + steps]! += sourceMass * (1 - continuation) * continuation ** (steps - 1);
    }
    shifted[DECAY_OVERFLOW]! += sourceMass * continuation ** Math.max(0, room - 1);
  }
  return shifted;
}

function choose(n: number, k: number): number {
  const count = Math.min(k, n - k);
  let value = 1;
  for (let index = 1; index <= count; index++) {
    value = (value * (n - count + index)) / index;
  }
  return value;
}

function trailingDecayMass(hitCount: number, successes: number): number[] {
  const key = `${hitCount}:${successes}`;
  const cached = trailingDecayMassCache.get(key);
  if (cached) return cached;
  const mass = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  const denominator = choose(hitCount, successes);
  for (let trailing = 0; trailing <= hitCount - successes; trailing++) {
    mass[Math.min(trailing, DECAY_OVERFLOW)]! +=
      choose(hitCount - trailing - 1, successes - 1) / denominator;
  }
  trailingDecayMassCache.set(key, mass);
  return mass;
}

function finiteCountMass(multiplicity: TargetWeaponPoisonHitMultiplicity): number[] | undefined {
  if (multiplicity.kind === "positive-geometric") return undefined;
  if (multiplicity.kind === "single") return SINGLE_COUNT_MASS;
  const { trials, probability } = multiplicity;
  const key = `${trials}:${probability}`;
  const cached = finiteCountMassCache.get(key);
  if (cached) return cached;
  const positive = 1 - (1 - probability) ** trials;
  const mass = Array.from({ length: trials + 1 }, () => 0);
  for (let count = 1; count <= trials; count++) {
    mass[count] =
      (choose(trials, count) * probability ** count * (1 - probability) ** (trials - count)) /
      positive;
  }
  finiteCountMassCache.set(key, mass);
  return mass;
}

function failedDecayMass(
  initial: readonly number[],
  multiplicity: TargetWeaponPoisonHitMultiplicity,
): number[] {
  const finite = finiteCountMass(multiplicity);
  if (!finite) {
    if (multiplicity.kind !== "positive-geometric") {
      throw new Error("unsupported poison hit multiplicity");
    }
    return geometricShiftDecayMass(initial, multiplicity.continuationProbability);
  }
  let combined = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  for (let count = 1; count < finite.length; count++) {
    const probability = finite[count]!;
    if (!(probability > 0)) continue;
    const shifted = shiftDecayMass(initial, count);
    combined = combined.map((value, index) => value + probability * shifted[index]!);
  }
  return combined;
}

function pendingOrderClasses(rt: SimulationRuntime): (tick: number, seq: number) => number {
  let sequencesByTick: Map<number, number[]> | undefined;
  return (tick, seq) => {
    if (!sequencesByTick) {
      sequencesByTick = new Map();
      const pending = rt.queue.pending();
      notePoisonOrderingScan(pending.length);
      for (const event of pending) {
        const sequences = sequencesByTick.get(event.tick);
        if (sequences) sequences.push(event.seq);
        else sequencesByTick.set(event.tick, [event.seq]);
      }
      for (const sequences of sequencesByTick.values()) {
        sequences.sort((left, right) => left - right);
      }
    }
    const sequences = sequencesByTick.get(tick);
    if (!sequences) return 0;
    let low = 0;
    let high = sequences.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (sequences[middle]! < seq) low = middle + 1;
      else high = middle;
    }
    return low;
  };
}

function normalizedAtom(atom: PoisonAtomWithHistory, atTick: number): PoisonAtomWithHistory {
  const immunityDisabledUntilTick =
    atom.immunityDisabledUntilTick > atTick ? atom.immunityDisabledUntilTick : 0;
  const live = atom.poison.active && atTick < atom.poison.expiresAtTick;
  return {
    ...atom,
    immunityDisabledUntilTick,
    poison: live
      ? atom.poison
      : {
          ...inactiveTargetWeaponPoisonState(),
          pendingApplicationHits: atom.poison.pendingApplicationHits,
        },
  };
}

function atomFutureKey(
  atom: TargetWeaponPoisonAtom,
  orderClass: (tick: number, seq: number) => number,
  horizon?: number,
): string {
  const poison = atom.poison;
  if (!poison.active) return [atom.immunityDisabledUntilTick, 0].join("\x1f");
  const liveUntil = Math.min(poison.expiresAtTick, horizon ?? Number.POSITIVE_INFINITY);
  const cadenceLive = poison.remainingHits > 0 && poison.nextHitTick < liveUntil;
  const cadenceHitLimit = cadenceLive
    ? Math.ceil((liveUntil - poison.nextHitTick) / poison.cadenceTicks)
    : 0;
  return [
    atom.immunityDisabledUntilTick,
    1,
    liveUntil,
    poison.effectiveTier,
    Math.min(poison.remainingHits, cadenceHitLimit),
    cadenceLive ? poison.cadenceTicks : 0,
    cadenceLive ? poison.nextHitTick : 0,
    cadenceLive ? orderClass(poison.nextHitTick, poison.pendingEventSeq) : 0,
    poison.sourceDamageMultiplier,
    poison.cinderbaneContinuation ? 1 : 0,
    poison.pendingApplicationHits
      .filter((hit) => horizon === undefined || hit.tick < horizon)
      .map((hit) =>
        [
          hit.tick,
          orderClass(hit.tick, hit.seq),
          hit.multiplicity.kind,
          hit.multiplicity.kind === "positive-binomial"
            ? `${hit.multiplicity.trials}:${hit.multiplicity.probability}`
            : hit.multiplicity.kind === "positive-geometric"
              ? hit.multiplicity.continuationProbability
              : 1,
        ].join(":"),
      )
      .join(","),
  ].join("\x1f");
}

function fixedHitCount(multiplicity: TargetWeaponPoisonHitMultiplicity): number | undefined {
  if (multiplicity.kind === "single") return 1;
  if (multiplicity.kind === "positive-binomial" && multiplicity.probability === 1) {
    return multiplicity.trials;
  }
  return undefined;
}

function compactPendingHits(
  hits: readonly TargetWeaponPoisonPendingHit[],
  orderClass: (tick: number, seq: number) => number,
): TargetWeaponPoisonPendingHit[] {
  const fixed = new Map<string, TargetWeaponPoisonPendingHit & { count: number }>();
  const other: TargetWeaponPoisonPendingHit[] = [];
  for (const hit of hits) {
    const count = fixedHitCount(hit.multiplicity);
    if (count === undefined) {
      other.push(hit);
      continue;
    }
    const key = `${hit.tick}\x1f${orderClass(hit.tick, hit.seq)}`;
    const current = fixed.get(key);
    if (current) {
      fixed.set(key, {
        ...current,
        count: current.count + count,
        seq: Math.min(current.seq, hit.seq),
      });
    } else {
      fixed.set(key, { ...hit, count });
    }
  }
  return [
    ...other,
    ...[...fixed.values()].map(({ count, ...hit }) => ({
      ...hit,
      multiplicity:
        count === 1
          ? ({ kind: "single" } as const)
          : ({ kind: "positive-binomial", trials: count, probability: 1 } as const),
    })),
  ].sort((left, right) => left.tick - right.tick || left.seq - right.seq);
}

function mergeAtoms(
  rt: SimulationRuntime,
  atoms: readonly PoisonAtomWithHistory[],
  atTick: number,
): PoisonAtomWithHistory[] {
  const merged = new Map<string, PoisonAtomWithHistory>();
  const orderClass = pendingOrderClasses(rt);
  for (const sourceAtom of atoms) {
    if (!(sourceAtom.probability > 0)) continue;
    const normalized = normalizedAtom(sourceAtom, atTick);
    const atom = {
      ...normalized,
      poison: {
        ...normalized.poison,
        pendingApplicationHits: compactPendingHits(
          normalized.poison.pendingApplicationHits,
          orderClass,
        ),
      },
    };
    const key = atomFutureKey(atom, orderClass, rt.horizon);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, atom);
      continue;
    }
    const probability = current.probability + atom.probability;
    const decayMass = mixDecayMass(
      current.poison.decayMass,
      atom.poison.decayMass,
      current.probability,
      atom.probability,
    );
    merged.set(key, {
      ...current,
      probability,
      poison: {
        ...current.poison,
        decayMass,
        decayIndex: decayMean(decayMass),
        pendingEventSeq: Math.min(current.poison.pendingEventSeq, atom.poison.pendingEventSeq),
      },
      supportMin: Math.min(current.supportMin, atom.supportMin),
      supportMax: Math.max(current.supportMax, atom.supportMax),
      supportParents: [...new Set([...current.supportParents, ...atom.supportParents])],
    });
  }
  const result = [...merged.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, atom]) => atom);
  notePoisonAtomMerge(atoms.length, result.length);
  return result;
}

function atomsWithHistory(distribution: TargetWeaponPoisonDistribution): PoisonAtomWithHistory[] {
  return distribution.atoms.map((atom) => {
    const support = distribution.supportByAtom[atom.id] ?? { min: 0, max: 0 };
    return {
      ...atom,
      supportMin: support.min,
      supportMax: support.max,
      supportParents: [atom.id],
    };
  });
}

function distributionFromCache(
  cached: CachedPoisonDistribution,
  current: TargetWeaponPoisonDistribution,
): TargetWeaponPoisonDistribution {
  return {
    atoms: cached.atoms,
    nextAtomId: cached.nextAtomId,
    futureId: cached.futureId,
    supportByAtom: Object.fromEntries(
      cached.atoms.map((atom) => {
        const parents = cached.supportParentsByAtom[atom.id] ?? [];
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        for (const parentId of parents) {
          const support = current.supportByAtom[parentId] ?? { min: 0, max: 0 };
          min = Math.min(min, support.min);
          max = Math.max(max, support.max);
        }
        return [
          atom.id,
          {
            min: Number.isFinite(min) ? min : 0,
            max: Number.isFinite(max) ? max : 0,
          },
        ];
      }),
    ),
  };
}

function distributionFromAtoms(
  rt: SimulationRuntime,
  atoms: readonly PoisonAtomWithHistory[],
  nextAtomId: number,
  atTick: number,
): { distribution: TargetWeaponPoisonDistribution; cached: CachedPoisonDistribution } {
  const merged = mergeAtoms(rt, atoms, atTick);
  notePoisonProbabilityMaterialization(merged.length);
  const futureAtoms = merged.map(
    ({ supportMin: _min, supportMax: _max, supportParents: _parents, ...atom }) => atom,
  );
  const key = JSON.stringify([nextAtomId, futureAtoms]);
  const { future } = internTargetWeaponPoisonFuture(
    rt.poisonFutureInterner,
    key,
    futureAtoms,
    nextAtomId,
  );
  const distribution = {
    atoms: future.atoms,
    nextAtomId: future.nextAtomId,
    futureId: future.id,
    supportByAtom: Object.fromEntries(
      merged.map((atom) => [atom.id, { min: atom.supportMin, max: atom.supportMax }]),
    ),
  };
  return {
    distribution,
    cached: {
      atoms: future.atoms,
      nextAtomId: future.nextAtomId,
      futureId: future.id,
      supportParentsByAtom: Object.fromEntries(
        merged.map((atom) => [atom.id, atom.supportParents]),
      ),
    },
  };
}

function freshPoisonState(
  atTick: number,
  source: PoisonApplicationSnapshot,
  pendingEventSeq: number,
  pendingApplicationHits: TargetWeaponPoisonPendingHit[],
): TargetWeaponPoisonState {
  return {
    active: true,
    expiresAtTick: atTick + PLAYER_POISON_STATUS_TICKS,
    effectiveTier: source.effectiveTier,
    decayMass: pointDecayMass(),
    decayIndex: 0,
    remainingHits: source.hitBudget - 1,
    cadenceTicks: source.cadenceTicks,
    nextHitTick: atTick + PLAYER_POISON_FIRST_HIT_DELAY + source.cadenceTicks,
    pendingEventSeq,
    sourceDamageMultiplier: source.sourceDamageMultiplier,
    cinderbaneContinuation: source.cinderbaneContinuation,
    sourceLabel: source.sourceLabel,
    pendingApplicationHits,
  };
}

function refreshPoisonWithoutApplicationHit(
  atTick: number,
  source: PoisonApplicationSnapshot,
  poison: TargetWeaponPoisonState,
): TargetWeaponPoisonState {
  const pendingHits = poison.pendingApplicationHits.reduce(
    (sum, hit) => sum + multiplicityExpectedHits(hit.multiplicity),
    0,
  );
  return {
    ...poison,
    active: true,
    expiresAtTick: atTick + PLAYER_POISON_STATUS_TICKS,
    effectiveTier: source.effectiveTier,
    decayMass: pointDecayMass(),
    decayIndex: 0,
    remainingHits: Math.max(0, source.hitBudget - pendingHits),
    cadenceTicks: source.cadenceTicks,
    sourceDamageMultiplier: source.sourceDamageMultiplier,
    cinderbaneContinuation: source.cinderbaneContinuation,
    sourceLabel: source.sourceLabel,
  };
}

function poisonSupport(distribution: TargetWeaponPoisonDistribution): {
  min: number;
  max: number;
} {
  if (distribution.atoms.length === 0) return { min: 0, max: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const atom of distribution.atoms) {
    const support = distribution.supportByAtom[atom.id] ?? { min: 0, max: 0 };
    min = Math.min(min, support.min);
    max = Math.max(max, support.max);
  }
  return { min, max };
}

function scaleDamage(damage: ResolvedDamage, probability: number): ResolvedDamage {
  return {
    ...damage,
    min: damage.min * probability,
    max: damage.max * probability,
    expected: damage.expected * probability,
    ...(damage.critExpected !== undefined
      ? { critExpected: damage.critExpected * probability }
      : {}),
    ...(damage.capLoss !== undefined ? { capLoss: damage.capLoss * probability } : {}),
    ...(damage.critical
      ? {
          critical: {
            ...damage.critical,
            contribution: damage.critical.contribution * probability,
          },
        }
      : {}),
  };
}

export function recordConditionalPoisonDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
  atomIds: readonly number[],
): void {
  if (atomIds.length === 0) return;
  const selected = new Set(atomIds);
  let distribution = rt.state.target.weaponPoison;
  const probability = distribution.atoms.reduce(
    (sum, atom) => sum + (selected.has(atom.id) ? atom.probability : 0),
    0,
  );
  if (!(probability > 0)) return;
  const supportBefore = poisonSupport(distribution);
  distribution = {
    ...distribution,
    supportByAtom: Object.fromEntries(
      distribution.atoms.map((atom) => {
        const support = distribution.supportByAtom[atom.id] ?? { min: 0, max: 0 };
        return [
          atom.id,
          selected.has(atom.id)
            ? {
                min: support.min + resolution.damage.min,
                max: support.max + resolution.damage.max,
              }
            : support,
        ];
      }),
    ),
  };
  rt.state = patchTarget(rt.state, { weaponPoison: distribution });
  const weightedDamage = scaleDamage(resolution.damage, probability);
  recordResolved(rt, event, {
    ...resolution,
    damage: weightedDamage,
    ...(resolution.components
      ? {
          components: resolution.components.map((component) => ({
            ...component,
            damage: scaleDamage(component.damage, probability),
            ...(component.analysis
              ? {
                  analysis: {
                    ...component.analysis,
                    expectedActivations: component.analysis.expectedActivations * probability,
                  },
                }
              : {}),
          })),
        }
      : {}),
  });
  const supportAfter = poisonSupport(rt.state.target.weaponPoison);
  rt.analysis.supportMinOffset += supportAfter.min - supportBefore.min - weightedDamage.min;
  rt.analysis.supportMaxOffset += supportAfter.max - supportBefore.max - weightedDamage.max;
}

export function playerPoisonProbabilityMass(distribution: TargetWeaponPoisonDistribution): number {
  return distribution.atoms.reduce((sum, atom) => sum + atom.probability, 0);
}

export function modalTargetWeaponPoison(
  distribution: TargetWeaponPoisonDistribution,
): TargetWeaponPoisonAtom {
  return distribution.atoms.reduce((best, atom) =>
    atom.probability > best.probability ? atom : best,
  );
}

function boundedProbability(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} outside 0-1: ${value}`);
  }
  return value;
}

function multiplicityExpectedHits(multiplicity: TargetWeaponPoisonHitMultiplicity): number {
  switch (multiplicity.kind) {
    case "single":
      return 1;
    case "positive-binomial": {
      const positive = 1 - (1 - multiplicity.probability) ** multiplicity.trials;
      return (multiplicity.trials * multiplicity.probability) / positive;
    }
    case "positive-geometric":
      return 1 / (1 - multiplicity.continuationProbability);
  }
}

function thinMultiplicity(
  multiplicity: TargetWeaponPoisonHitMultiplicity,
  chance: number,
): {
  successProbability: number;
  expectedSuccesses: number;
  successMultiplicity: TargetWeaponPoisonHitMultiplicity;
} {
  if (multiplicity.kind === "single") {
    return {
      successProbability: chance,
      expectedSuccesses: chance,
      successMultiplicity: { kind: "single" },
    };
  }
  if (multiplicity.kind === "positive-binomial") {
    const { trials, probability } = multiplicity;
    const sourcePositive = 1 - (1 - probability) ** trials;
    const thinnedProbability = probability * chance;
    return {
      successProbability: (1 - (1 - thinnedProbability) ** trials) / sourcePositive,
      expectedSuccesses: (trials * thinnedProbability) / sourcePositive,
      successMultiplicity: {
        kind: "positive-binomial",
        trials,
        probability: thinnedProbability,
      },
    };
  }
  if (multiplicity.kind !== "positive-geometric") {
    throw new Error("unsupported poison hit multiplicity");
  }
  const sourceContinuation = multiplicity.continuationProbability;
  const denominator = 1 - sourceContinuation * (1 - chance);
  return {
    successProbability: chance / denominator,
    expectedSuccesses: chance / (1 - sourceContinuation),
    successMultiplicity: {
      kind: "positive-geometric",
      continuationProbability: (sourceContinuation * chance) / denominator,
    },
  };
}

interface ContinuationOutcome {
  probability: number;
  successCount: number;
  decayMass: number[];
  multiplicity?: TargetWeaponPoisonHitMultiplicity;
}

function continuationOutcomes(
  multiplicity: TargetWeaponPoisonHitMultiplicity,
  chance: number,
  initialDecayMass: readonly number[],
): ContinuationOutcome[] {
  const finite = finiteCountMass(multiplicity);
  if (finite) {
    const failure = 1 - chance;
    const outcomes = new Map<number, { probability: number; decayMass: number[] }>();
    for (let hitCount = 1; hitCount < finite.length; hitCount++) {
      const hitCountProbability = finite[hitCount]!;
      if (!(hitCountProbability > 0)) continue;
      for (let successes = 0; successes <= hitCount; successes++) {
        const probability =
          hitCountProbability *
          choose(hitCount, successes) *
          chance ** successes *
          failure ** (hitCount - successes);
        if (!(probability > 0)) continue;
        const decayMass =
          successes === 0
            ? shiftDecayMass(initialDecayMass, hitCount)
            : trailingDecayMass(hitCount, successes);
        const current = outcomes.get(successes);
        if (!current) {
          outcomes.set(successes, { probability, decayMass });
          continue;
        }
        current.decayMass = mixDecayMass(
          current.decayMass,
          decayMass,
          current.probability,
          probability,
        );
        current.probability += probability;
      }
    }
    return [...outcomes.entries()].map(([successCount, outcome]) => ({
      ...outcome,
      successCount,
      ...(successCount > 0
        ? {
            multiplicity:
              successCount === 1
                ? ({ kind: "single" } as const)
                : ({
                    kind: "positive-binomial",
                    trials: successCount,
                    probability: 1,
                  } as const),
          }
        : {}),
    }));
  }
  const thinned = thinMultiplicity(multiplicity, chance);
  if (multiplicity.kind !== "positive-geometric") {
    throw new Error("unsupported poison hit multiplicity");
  }
  const sourceContinuation = multiplicity.continuationProbability;
  const failedContinuation = sourceContinuation * (1 - chance);
  return [
    {
      probability: 1 - thinned.successProbability,
      successCount: 0,
      decayMass: geometricShiftDecayMass(initialDecayMass, failedContinuation),
    },
    {
      probability: thinned.successProbability,
      successCount: thinned.expectedSuccesses / thinned.successProbability,
      decayMass: geometricZeroDecayMass(failedContinuation),
      multiplicity: thinned.successMultiplicity,
    },
  ];
}

function appendApplicationHit(
  poison: TargetWeaponPoisonState,
  tick: number,
  seq: number,
  multiplicity: TargetWeaponPoisonHitMultiplicity,
): TargetWeaponPoisonPendingHit[] {
  return [...poison.pendingApplicationHits, { tick, seq, multiplicity }].sort(
    (left, right) => left.tick - right.tick || left.seq - right.seq,
  );
}

export function applyPlayerPoisonLandOccurrence(
  rt: SimulationRuntime,
  atTick: number,
  source: PoisonApplicationSnapshot | null,
  occurrence: PlayerPoisonLandOccurrence,
  atomIds?: readonly number[],
): PlayerPoisonLandResult {
  const current = rt.state.target.weaponPoison;
  const occurrenceProbability = boundedProbability(
    occurrence.occurrenceProbability,
    "occurrenceProbability",
  );
  const applicationSuccessProbability = source
    ? boundedProbability(occurrence.applicationSuccessProbability, "applicationSuccessProbability")
    : 0;
  if (applicationSuccessProbability > occurrenceProbability + Number.EPSILON) {
    throw new RangeError("application success exceeds event occurrence probability");
  }
  const selected = atomIds ? new Set(atomIds) : null;
  const applicationHitOrder = source && applicationSuccessProbability > 0 ? rt.nextSeq++ : -1;
  const cadenceOrder = source && applicationSuccessProbability > 0 ? rt.nextSeq++ : -1;
  const transitionKey = [
    current.futureId,
    atTick,
    rt.horizon ?? -1,
    applicationHitOrder,
    cadenceOrder,
    occurrenceProbability,
    occurrence.expectedOccurrences,
    applicationSuccessProbability,
    JSON.stringify(occurrence.applicationSuccessMultiplicity),
    occurrence.immunityDisabledUntilTick,
    source ? JSON.stringify(source) : "",
    atomIds ? [...atomIds].sort((left, right) => left - right).join(",") : "*",
  ].join("\x1f");
  let transitionCache = poisonLandTransitionCaches.get(rt.poisonFutureInterner);
  if (!transitionCache) {
    transitionCache = new Map();
    poisonLandTransitionCaches.set(rt.poisonFutureInterner, transitionCache);
  }
  const cachedTransition = transitionCache.get(transitionKey);
  if (cachedTransition) {
    notePoisonTransitionCache(true);
    recordPlayerPoisonApplication(rt, "attempt", cachedTransition.result.expectedAttempts);
    recordPlayerPoisonApplication(rt, "success", cachedTransition.result.expectedSuccesses);
    rt.state = patchTarget(rt.state, {
      weaponPoison: distributionFromCache(cachedTransition.distribution, current),
    });
    return cachedTransition.result;
  }
  notePoisonTransitionCache(false);
  const atoms: PoisonAtomWithHistory[] = [];
  let nextAtomId = current.nextAtomId;
  let expectedAttempts = 0;
  let expectedSuccesses = 0;
  let expectedApplicationHits = 0;

  for (const atom of atomsWithHistory(current)) {
    if (selected && !selected.has(atom.id)) {
      atoms.push(atom);
      continue;
    }
    const disabledUntil =
      rt.input.targetPoisonImmune === true
        ? Math.max(atom.immunityDisabledUntilTick, occurrence.immunityDisabledUntilTick)
        : 0;
    const refreshesImmunity = disabledUntil > atom.immunityDisabledUntilTick;
    const eligible = !isTargetPoisonImmune(rt.input.targetPoisonImmune, disabledUntil, atTick);
    const successProbability = eligible ? applicationSuccessProbability : 0;
    if (source && eligible) {
      expectedAttempts += atom.probability * occurrence.expectedOccurrences;
      expectedSuccesses += atom.probability * occurrence.expectedOccurrences * source.procChance;
    }

    if (!refreshesImmunity) {
      const unchangedProbability = atom.probability * (1 - successProbability);
      if (unchangedProbability > 0) {
        atoms.push({ ...atom, probability: unchangedProbability });
      }
    } else {
      const noOccurrenceProbability = atom.probability * (1 - occurrenceProbability);
      if (noOccurrenceProbability > 0) {
        atoms.push({ ...atom, probability: noOccurrenceProbability });
      }
      const refreshOnlyProbability =
        atom.probability * (occurrenceProbability - successProbability);
      if (refreshOnlyProbability > 0) {
        atoms.push({
          ...atom,
          id: noOccurrenceProbability > 0 ? nextAtomId++ : atom.id,
          probability: refreshOnlyProbability,
          immunityDisabledUntilTick: disabledUntil,
        });
      }
    }

    const landedSuccessProbability = atom.probability * successProbability;
    if (source && landedSuccessProbability > 0) {
      const poisonLive = atom.poison.active && atTick < atom.poison.expiresAtTick;
      const earnsApplicationHit = !poisonLive || source.cinderbaneContinuation;
      const applicationHitLands =
        rt.horizon === undefined || atTick + PLAYER_POISON_FIRST_HIT_DELAY < rt.horizon;
      if (earnsApplicationHit && applicationHitLands) {
        expectedApplicationHits += source.cinderbaneContinuation
          ? atom.probability * occurrence.expectedOccurrences * source.procChance
          : landedSuccessProbability;
      }
      const keepsOriginalId = refreshesImmunity
        ? occurrenceProbability === 1 && successProbability === 1
        : successProbability === 1;
      atoms.push({
        ...atom,
        id: keepsOriginalId ? atom.id : nextAtomId++,
        probability: landedSuccessProbability,
        immunityDisabledUntilTick: disabledUntil,
        poison: earnsApplicationHit
          ? freshPoisonState(
              atTick,
              source,
              cadenceOrder,
              appendApplicationHit(
                atom.poison,
                atTick + PLAYER_POISON_FIRST_HIT_DELAY,
                applicationHitOrder,
                source.cinderbaneContinuation
                  ? occurrence.applicationSuccessMultiplicity
                  : { kind: "single" },
              ),
            )
          : refreshPoisonWithoutApplicationHit(atTick, source, atom.poison),
      });
    }
  }

  recordPlayerPoisonApplication(rt, "attempt", expectedAttempts);
  recordPlayerPoisonApplication(rt, "success", expectedSuccesses);
  const result = { expectedAttempts, expectedSuccesses, expectedApplicationHits };
  const built = distributionFromAtoms(rt, atoms, nextAtomId, atTick);
  rememberPoisonTransition(transitionCache, transitionKey, {
    distribution: built.cached,
    result,
  });
  rt.state = patchTarget(rt.state, {
    weaponPoison: built.distribution,
  });
  return result;
}

export function refreshPlayerPoisonImmunity(
  rt: SimulationRuntime,
  atTick: number,
  untilTick: number,
  occurrenceProbability = 1,
  atomIds?: readonly number[],
): void {
  if (rt.input.targetPoisonImmune !== true || untilTick <= atTick) return;
  applyPlayerPoisonLandOccurrence(
    rt,
    atTick,
    null,
    {
      occurrenceProbability,
      expectedOccurrences: occurrenceProbability,
      applicationSuccessProbability: 0,
      applicationSuccessMultiplicity: { kind: "single" },
      immunityDisabledUntilTick: untilTick,
    },
    atomIds,
  );
}

function recordPlayerPoisonApplication(
  rt: SimulationRuntime,
  kind: "attempt" | "success",
  amount = 1,
): void {
  if (!keepsAnalysisLedgers(rt.detailLevel) || !(amount > 0)) return;
  const existing = rt.analysis.effects.get(PLAYER_POISON_EFFECT_ID);
  const ledger = existing ?? {
    id: PLAYER_POISON_EFFECT_ID,
    kind: "player-poison" as const,
    totalDamage: 0,
    directDamage: 0,
    dotDamage: 0,
    criticalContribution: 0,
    capLoss: 0,
    expectedCasts: 0,
    expectedTriggerRolls: 0,
    expectedActivations: 0,
    expectedSeparateHits: 0,
    expectedAttachedComponents: 0,
    expectedPlayerPoisonHits: 0,
    bonusDamage: 0,
  };
  if (kind === "success") ledger.expectedActivations += amount;
  else ledger.expectedTriggerRolls += amount;
  rt.analysis.effects.set(PLAYER_POISON_EFFECT_ID, ledger);
}

function recordPlayerPoisonContinuationHits(rt: SimulationRuntime, amount: number): void {
  if (!keepsAnalysisLedgers(rt.detailLevel) || !(amount > 0)) return;
  const ledger = rt.analysis.effects.get(PLAYER_POISON_EFFECT_ID);
  if (ledger) ledger.expectedPlayerPoisonHits += amount;
}

function recordPlayerPoisonContinuation(
  rt: SimulationRuntime,
  attempts: number,
  activations: number,
  hits: number,
): void {
  if (keepsAnalysisLedgers(rt.detailLevel)) {
    rt.analysis.playerPoisonContinuationAttempts += attempts;
    rt.analysis.playerPoisonContinuationActivations += activations;
  }
  recordPlayerPoisonApplication(rt, "attempt", attempts);
  recordPlayerPoisonApplication(rt, "success", activations);
  recordPlayerPoisonContinuationHits(rt, hits);
}

interface ResolvedPlayerPoisonAttached {
  term: LeagueAttachedTerm;
  damage: PoisonDamageBand;
}

interface ResolvedPlayerPoisonHit {
  host: PoisonDamageBand;
  attached: readonly ResolvedPlayerPoisonAttached[];
}

type MutablePoisonDamageBand = { min: number; expected: number; max: number };

function zeroPoisonBand(): MutablePoisonDamageBand {
  return { min: 0, expected: 0, max: 0 };
}

function addScaledPoisonBand(
  target: MutablePoisonDamageBand,
  source: PoisonDamageBand | undefined,
  scale: number,
): void {
  if (!source) return;
  target.min += source.min * scale;
  target.expected += source.expected * scale;
  target.max += source.max * scale;
}

function poisonBandDelta(after: PoisonDamageBand, before: PoisonDamageBand): PoisonDamageBand {
  return {
    min: after.min - before.min,
    expected: after.expected - before.expected,
    max: after.max - before.max,
  };
}

function addResolvedPoisonAttached(
  target: Map<string, { term: LeagueAttachedTerm; damage: MutablePoisonDamageBand }>,
  source: readonly ResolvedPlayerPoisonAttached[],
  scale: number,
): void {
  for (const attached of source) {
    let entry = target.get(attached.term.id);
    if (!entry) {
      entry = { term: attached.term, damage: zeroPoisonBand() };
      target.set(attached.term.id, entry);
    }
    addScaledPoisonBand(entry.damage, attached.damage, scale);
  }
}

function resolvedPoisonHit(
  host: PoisonDamageBand,
  attached: ReadonlyMap<string, { term: LeagueAttachedTerm; damage: PoisonDamageBand }>,
): ResolvedPlayerPoisonHit {
  return { host, attached: [...attached.values()] };
}

function multiplicityKey(multiplicity: TargetWeaponPoisonHitMultiplicity): string {
  switch (multiplicity.kind) {
    case "single":
      return "s";
    case "positive-binomial":
      return `b:${multiplicity.trials}:${multiplicity.probability}`;
    case "positive-geometric":
      return `g:${multiplicity.continuationProbability}`;
  }
}

function resolvePlayerPoison(
  rt: SimulationRuntime,
  poison: TargetWeaponPoisonState,
  atTick: number,
  decayIndex: number,
): ResolvedPlayerPoisonHit {
  const toxin = rt.state.target.evolvingToxin;
  const stacks = activeEvolvingToxinStacks(toxin.stacks, toxin.expiresAtTick, atTick);
  const baseAbilityDamage = abilityDamageAt(rt, atTick);
  const league = rt.input.league;
  const attachedTerms = league
    ? resolveLeagueAttachedTerms({
        rules: league,
        source: { kind: "player_poison" },
        landTick: atTick,
        abilityBase: baseAbilityDamage,
      })
    : [];
  const cacheKey = [
    baseAbilityDamage,
    poison.effectiveTier,
    decayIndex,
    poison.sourceDamageMultiplier,
    stacks,
    attachedTerms.map((term) => `${term.id}:${term.amount}`).join(","),
  ].join("\x1f");
  const cached = rt.playerPoisonDamageCache.get(cacheKey) as ResolvedPlayerPoisonHit | undefined;
  if (cached) return cached;
  const baseBand = playerPoisonDamage(baseAbilityDamage, poison.effectiveTier, decayIndex, 1);
  const configured =
    rt.input.playerPoisonModifiers ??
    (() => {
      const ability = rt.byId.values().next().value;
      return typeof rt.input.modifiers === "function"
        ? ability
          ? rt.input.modifiers(ability)
          : []
        : (rt.input.modifiers ?? []);
    })();
  const modifiers: CombatModifier[] = configured.filter(
    (modifier) => modifier.appliesToPlayerPoison === true,
  );
  const toxinModifier = isRangedAmmoActive(
    rt.input.ammo,
    rt.input.context?.style,
    rt.input.equipmentIds,
  )
    ? evolvingToxinPoisonModifier(stacks)
    : null;
  if (toxinModifier) modifiers.push(toxinModifier);
  const provenance = { kind: "player_poison" as const };
  const context = contextWithProvenance(
    {
      ...(rt.input.context ?? { style: "melee" as const }),
      dotKind: "poison",
      damageSource: "dot",
      provenance,
    },
    provenance,
  );
  const apply = (damage: number) => runPipeline({ damage }, modifiers, context).damage;
  const applyBand = (band: PoisonDamageBand): PoisonDamageBand =>
    modifiers.length === 0
      ? band
      : {
          min: apply(band.min),
          expected: apply(band.expected),
          max: apply(band.max),
        };
  const resolveBand = (band: PoisonDamageBand): PoisonDamageBand =>
    applyBand({
      min: band.min * poison.sourceDamageMultiplier,
      expected: band.expected * poison.sourceDamageMultiplier,
      max: band.max * poison.sourceDamageMultiplier,
    });
  const composed = resolveHostDamageInstance(
    { host: baseBand, attached: attachedTerms },
    {
      add: (host, amount) => ({
        min: host.min + amount,
        expected: host.expected + amount,
        max: host.max + amount,
      }),
      resolve: resolveBand,
      delta: poisonBandDelta,
    },
  );
  const resolved: ResolvedPlayerPoisonHit = {
    host: composed.hostDamage,
    attached: composed.attached.map(({ term, damage }) => ({ term, damage })),
  };
  rt.playerPoisonDamageCache.set(cacheKey, resolved);
  return resolved;
}

function compareOrder(a: PlayerPoisonEventOrder, b: PlayerPoisonEventOrder): number {
  return a.tick - b.tick || a.seq - b.seq;
}

function resolvePlayerPoisonBatch(
  poison: TargetWeaponPoisonState,
  multiplicity: TargetWeaponPoisonHitMultiplicity,
  continuationChance: number,
  resolveAtDecay: (decayIndex: number) => ResolvedPlayerPoisonHit,
): ResolvedPlayerPoisonHit {
  const resolveOccupancy = (occupancy: readonly number[]): ResolvedPlayerPoisonHit => {
    const host = zeroPoisonBand();
    const attached = new Map<
      string,
      { term: LeagueAttachedTerm; damage: MutablePoisonDamageBand }
    >();
    for (let decayIndex = 0; decayIndex < occupancy.length; decayIndex++) {
      const probability = occupancy[decayIndex]!;
      if (!(probability > 0)) continue;
      const resolved = resolveAtDecay(decayIndex);
      addScaledPoisonBand(host, resolved.host, probability);
      addResolvedPoisonAttached(attached, resolved.attached, probability);
    }
    return resolvedPoisonHit(host, attached);
  };
  const resolveFixed = (hitCount: number): ResolvedPlayerPoisonHit => {
    let state = normalizedDecayMass(poison.decayMass);
    const occupancy = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
    for (let hit = 0; hit < hitCount; hit++) {
      for (let decayIndex = 0; decayIndex < state.length; decayIndex++) {
        occupancy[decayIndex]! += state[decayIndex]!;
      }
      const failed = shiftDecayMass(state, 1).map(
        (probability) => probability * (1 - continuationChance),
      );
      failed[0]! += continuationChance;
      state = failed;
    }
    return resolveOccupancy(occupancy);
  };
  const finite = finiteCountMass(multiplicity);
  if (finite) {
    const host = zeroPoisonBand();
    const attached = new Map<
      string,
      { term: LeagueAttachedTerm; damage: MutablePoisonDamageBand }
    >();
    for (let hitCount = 1; hitCount < finite.length; hitCount++) {
      const probability = finite[hitCount]!;
      if (!(probability > 0)) continue;
      const resolved = resolveFixed(hitCount);
      addScaledPoisonBand(host, resolved.host, probability);
      addResolvedPoisonAttached(attached, resolved.attached, probability);
    }
    return resolvedPoisonHit(host, attached);
  }
  if (multiplicity.kind !== "positive-geometric") {
    throw new Error("unsupported poison hit multiplicity");
  }
  const sourceContinuation = multiplicity.continuationProbability;
  const failure = 1 - continuationChance;
  const initial = normalizedDecayMass(poison.decayMass);
  const occupancy = Array.from({ length: DECAY_OVERFLOW + 1 }, () => 0);
  const totalOccupancy = 1 / (1 - sourceContinuation);
  occupancy[0] = initial[0]! + sourceContinuation * continuationChance * totalOccupancy;
  for (let decayIndex = 1; decayIndex < DECAY_OVERFLOW; decayIndex++) {
    occupancy[decayIndex] =
      initial[decayIndex]! + sourceContinuation * failure * occupancy[decayIndex - 1]!;
  }
  occupancy[DECAY_OVERFLOW] =
    (initial[DECAY_OVERFLOW]! + sourceContinuation * failure * occupancy[DECAY_OVERFLOW - 1]!) /
    (1 - sourceContinuation * failure);
  return resolveOccupancy(occupancy);
}

interface DuePlayerPoisonHit {
  atom: TargetWeaponPoisonAtom;
  kind: "cadence" | "application";
  pending?: TargetWeaponPoisonPendingHit;
  multiplicity: TargetWeaponPoisonHitMultiplicity;
}

function nextAtomPoisonHit(atom: TargetWeaponPoisonAtom): DuePlayerPoisonHit | undefined {
  const poison = atom.poison;
  let next: DuePlayerPoisonHit | undefined;
  if (
    poison.active &&
    poison.remainingHits > 0 &&
    poison.nextHitTick < poison.expiresAtTick &&
    poison.pendingEventSeq >= 0
  ) {
    next = { atom, kind: "cadence", multiplicity: { kind: "single" } };
  }
  const pending = poison.pendingApplicationHits[0];
  if (
    pending &&
    (!next ||
      compareOrder(
        { tick: pending.tick, seq: pending.seq },
        { tick: poison.nextHitTick, seq: poison.pendingEventSeq },
      ) < 0)
  ) {
    return { atom, kind: "application", pending, multiplicity: pending.multiplicity };
  }
  return next;
}

export function nextPlayerPoisonEvent(rt: SimulationRuntime): PlayerPoisonEventOrder | undefined {
  let next: PlayerPoisonEventOrder | undefined;
  for (const atom of rt.state.target.weaponPoison.atoms) {
    const due = nextAtomPoisonHit(atom);
    if (!due) continue;
    const candidate =
      due.kind === "application"
        ? { tick: due.pending!.tick, seq: due.pending!.seq }
        : { tick: due.atom.poison.nextHitTick, seq: due.atom.poison.pendingEventSeq };
    if (!next || compareOrder(candidate, next) < 0) next = candidate;
  }
  return next;
}

export function lastPlayerPoisonTick(rt: SimulationRuntime): number {
  let tick = -1;
  for (const atom of rt.state.target.weaponPoison.atoms) {
    if (atom.poison.active && atom.poison.remainingHits > 0) {
      tick = Math.max(tick, atom.poison.nextHitTick);
    }
    for (const pending of atom.poison.pendingApplicationHits) {
      tick = Math.max(tick, pending.tick);
    }
  }
  return tick;
}

function recordPlayerPoisonGroup(
  rt: SimulationRuntime,
  order: PlayerPoisonEventOrder,
  dueHits: readonly DuePlayerPoisonHit[],
): void {
  let distribution = rt.state.target.weaponPoison;
  const byId = new Map(dueHits.map((due) => [due.atom.id, due]));
  const supportBefore = poisonSupport(distribution);
  let min = 0;
  let expected = 0;
  let max = 0;
  const attachedBands = new Map<
    string,
    { term: LeagueAttachedTerm; damage: MutablePoisonDamageBand }
  >();
  let probability = 0;
  const availableContinuation = resolvePoisonApplication(rt.input.playerPoison, order.tick);
  const resolvedCache = new WeakMap<readonly number[], Map<string, ResolvedPlayerPoisonHit>>();
  const decayBandCache = new Map<string, ResolvedPlayerPoisonHit>();
  distribution = {
    ...distribution,
    supportByAtom: Object.fromEntries(
      distribution.atoms.map((atom) => {
        const due = byId.get(atom.id);
        const support = distribution.supportByAtom[atom.id] ?? { min: 0, max: 0 };
        if (!due) return [atom.id, support];
        const hitCount = multiplicityExpectedHits(due.multiplicity);
        const continuation =
          due.atom.poison.cinderbaneContinuation &&
          !isTargetPoisonImmune(
            rt.input.targetPoisonImmune,
            due.atom.immunityDisabledUntilTick,
            order.tick,
          )
            ? availableContinuation
            : null;
        const resolveKey = [
          due.atom.poison.effectiveTier,
          due.atom.poison.sourceDamageMultiplier,
          multiplicityKey(due.multiplicity),
          continuation?.continuationChance ?? 0,
        ].join("\x1f");
        let byMass = resolvedCache.get(due.atom.poison.decayMass);
        if (!byMass) {
          byMass = new Map();
          resolvedCache.set(due.atom.poison.decayMass, byMass);
        }
        let resolved = byMass.get(resolveKey);
        if (!resolved) {
          const resolveAtDecay = (decayIndex: number) => {
            const key = [
              due.atom.poison.effectiveTier,
              due.atom.poison.sourceDamageMultiplier,
              decayIndex,
            ].join("\x1f");
            let band = decayBandCache.get(key);
            if (!band) {
              band = resolvePlayerPoison(rt, due.atom.poison, order.tick, decayIndex);
              decayBandCache.set(key, band);
            }
            return band;
          };
          resolved = resolvePlayerPoisonBatch(
            due.atom.poison,
            due.multiplicity,
            continuation?.continuationChance ?? 0,
            resolveAtDecay,
          );
          byMass.set(resolveKey, resolved);
        }
        const band = resolved.host;
        const hitMass = due.atom.probability * hitCount;
        probability += hitMass;
        min += due.atom.probability * band.min;
        expected += due.atom.probability * band.expected;
        max += due.atom.probability * band.max;
        addResolvedPoisonAttached(attachedBands, resolved.attached, due.atom.probability);
        const attachedMin = resolved.attached.reduce(
          (total, component) => total + component.damage.min,
          0,
        );
        const attachedMax = resolved.attached.reduce(
          (total, component) => total + component.damage.max,
          0,
        );
        return [
          atom.id,
          {
            min: support.min + band.min + attachedMin,
            max: support.max + band.max + attachedMax,
          },
        ];
      }),
    ),
  };
  rt.state = patchTarget(rt.state, { weaponPoison: distribution });
  const event: ScheduledEvent<SimulationRuntime> = {
    tick: order.tick,
    seq: order.seq,
    family: "poison",
    abilityId: PLAYER_POISON_EFFECT_ID,
    sourceCast: -1,
    hitIndex: dueHits.every(
      (due) => due.atom.poison.decayIndex === dueHits[0]?.atom.poison.decayIndex,
    )
      ? (dueHits[0]?.atom.poison.decayIndex ?? 0)
      : -1,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    expectedOccurrences: probability,
    expectedTriggerRolls: 0,
    expectedActivations: 0,
    expectedSeparateHits: probability,
    originKind: "poison",
    provenance: { kind: "player_poison" },
    resolve: () => NO_DAMAGE,
  };
  const attachedComponents: AttachedDamageComponent[] = [...attachedBands.values()]
    .filter(({ damage }) => damage.expected > 0 || damage.max > 0)
    .map(({ term, damage }) => ({
      id: term.id,
      damage,
      attached: true,
      hitCapPolicy: "shared",
      analysis: {
        kind: "league-blessing",
        blessingId: term.blessingId,
        bonusTargetId: PLAYER_POISON_EFFECT_ID,
        expectedActivations: probability,
      },
    }));
  const attachedTotals = attachedComponents.reduce(
    (total, component) => ({
      min: total.min + component.damage.min,
      expected: total.expected + component.damage.expected,
      max: total.max + component.damage.max,
    }),
    zeroPoisonBand(),
  );
  recordResolved(rt, event, {
    damage: {
      min: min + attachedTotals.min,
      expected: expected + attachedTotals.expected,
      max: max + attachedTotals.max,
    },
    ...(attachedComponents.length > 0 ? { components: attachedComponents } : {}),
  });
  refreshPlayerPoisonImmunity(
    rt,
    order.tick,
    order.tick + envenomedPoisonImmunityDisableTicks(rt.input.league),
    1,
    dueHits.map((due) => due.atom.id),
  );
  const supportAfter = poisonSupport(rt.state.target.weaponPoison);
  rt.analysis.supportMinOffset += supportAfter.min - supportBefore.min - min - attachedTotals.min;
  rt.analysis.supportMaxOffset += supportAfter.max - supportBefore.max - max - attachedTotals.max;
}

export function processNextPlayerPoisonEvent(
  rt: SimulationRuntime,
  bound = Number.POSITIVE_INFINITY,
): boolean {
  const next = nextPlayerPoisonEvent(rt);
  if (!next || next.tick > bound) return false;
  const orderClassFor = pendingOrderClasses(rt);
  const orderClass = orderClassFor(next.tick, next.seq);
  const due = rt.state.target.weaponPoison.atoms.flatMap((atom) => {
    const hit = nextAtomPoisonHit(atom);
    if (!hit) return [];
    const hitOrder =
      hit.kind === "application"
        ? { tick: hit.pending!.tick, seq: hit.pending!.seq }
        : { tick: atom.poison.nextHitTick, seq: atom.poison.pendingEventSeq };
    return hitOrder.tick === next.tick && orderClassFor(hitOrder.tick, hitOrder.seq) === orderClass
      ? [hit]
      : [];
  });
  if (due.length === 0) return false;
  recordPlayerPoisonGroup(rt, next, due);

  const distribution = rt.state.target.weaponPoison;
  const atomsWithSupport = atomsWithHistory(distribution);
  const distributionById = new Map(atomsWithSupport.map((atom) => [atom.id, atom]));
  const dueIds = new Set(due.map((hit) => hit.atom.id));
  const other = atomsWithSupport.filter((atom) => !dueIds.has(atom.id));
  const ordinary: Array<{ atom: PoisonAtomWithHistory; cadenceAdvanced: boolean }> = [];
  const successes: PoisonAtomWithHistory[] = [];
  let nextAtomId = distribution.nextAtomId;
  let advancesCadence = false;
  let hasSuccess = false;
  const availableContinuation = resolvePoisonApplication(rt.input.playerPoison, next.tick);
  const outcomeCache = new WeakMap<readonly number[], Map<string, ContinuationOutcome[]>>();
  const transitionKey = [
    distribution.futureId,
    next.tick,
    orderClass,
    rt.horizon ?? -1,
    rt.nextSeq,
    due
      .map(
        (hit) =>
          `${hit.atom.id}:${hit.kind}:${multiplicityKey(hit.multiplicity)}:${hit.pending?.tick ?? -1}:${hit.pending?.seq ?? -1}`,
      )
      .join(","),
  ].join("\x1f");
  let transitionCache = poisonEventTransitionCaches.get(rt.poisonFutureInterner);
  if (!transitionCache) {
    transitionCache = new Map();
    poisonEventTransitionCaches.set(rt.poisonFutureInterner, transitionCache);
  }
  const cachedTransition = transitionCache.get(transitionKey);
  if (cachedTransition) {
    notePoisonTransitionCache(true);
    recordPlayerPoisonContinuation(
      rt,
      cachedTransition.continuationAttempts,
      cachedTransition.continuationActivations,
      cachedTransition.continuationHits,
    );
    rt.nextSeq = cachedTransition.nextSeq;
    rt.state = patchTarget(rt.state, {
      weaponPoison: distributionFromCache(cachedTransition.distribution, distribution),
    });
    return true;
  }
  notePoisonTransitionCache(false);
  let continuationAttempts = 0;
  let continuationActivations = 0;
  let continuationHits = 0;

  for (const dueHit of due) {
    const before = dueHit.atom;
    const landed = distributionById.get(before.id);
    if (!landed) continue;
    const poison = before.poison;
    const cadenceAdvanced = dueHit.kind === "cadence";
    const remainingHits = cadenceAdvanced
      ? Math.max(0, poison.remainingHits - 1)
      : poison.remainingHits;
    const nextHitTick = cadenceAdvanced ? next.tick + poison.cadenceTicks : poison.nextHitTick;
    const pendingApplicationHits =
      dueHit.kind === "application"
        ? poison.pendingApplicationHits.filter(
            (hit) => hit.tick !== dueHit.pending!.tick || hit.seq !== dueHit.pending!.seq,
          )
        : poison.pendingApplicationHits;
    const failureMass = failedDecayMass(poison.decayMass, dueHit.multiplicity);
    const progressed: PoisonAtomWithHistory = {
      ...landed,
      poison: {
        ...poison,
        active: next.tick < poison.expiresAtTick,
        decayMass: failureMass,
        decayIndex: decayMean(failureMass),
        remainingHits,
        nextHitTick,
        pendingEventSeq: cadenceAdvanced ? -1 : poison.pendingEventSeq,
        pendingApplicationHits,
      },
    };
    const continuation =
      poison.cinderbaneContinuation &&
      !isTargetPoisonImmune(
        rt.input.targetPoisonImmune,
        landed.immunityDisabledUntilTick,
        next.tick,
      )
        ? availableContinuation
        : null;
    if (!continuation) {
      ordinary.push({ atom: progressed, cadenceAdvanced });
      advancesCadence ||=
        cadenceAdvanced && remainingHits > 0 && nextHitTick < poison.expiresAtTick;
      continue;
    }
    const hitCount = multiplicityExpectedHits(dueHit.multiplicity);
    const expectedContinuationSuccesses = hitCount * continuation.continuationChance;
    const outcomeKey = multiplicityKey(dueHit.multiplicity);
    let byMass = outcomeCache.get(poison.decayMass);
    if (!byMass) {
      byMass = new Map();
      outcomeCache.set(poison.decayMass, byMass);
    }
    let outcomes = byMass.get(outcomeKey);
    if (!outcomes) {
      outcomes = continuationOutcomes(
        dueHit.multiplicity,
        continuation.continuationChance,
        poison.decayMass,
      );
      byMass.set(outcomeKey, outcomes);
    }
    continuationAttempts += landed.probability * hitCount;
    continuationActivations += landed.probability * expectedContinuationSuccesses;
    continuationHits +=
      rt.horizon === undefined || next.tick + PLAYER_POISON_FIRST_HIT_DELAY < rt.horizon
        ? landed.probability * expectedContinuationSuccesses
        : 0;
    for (const outcome of outcomes) {
      const outcomeProbability = landed.probability * outcome.probability;
      if (!(outcomeProbability > 0)) continue;
      if (outcome.successCount === 0) {
        ordinary.push({
          atom: {
            ...progressed,
            probability: outcomeProbability,
            poison: {
              ...progressed.poison,
              decayMass: outcome.decayMass,
              decayIndex: decayMean(outcome.decayMass),
            },
          },
          cadenceAdvanced,
        });
        advancesCadence ||=
          cadenceAdvanced && remainingHits > 0 && nextHitTick < poison.expiresAtTick;
        continue;
      }
      successes.push({
        ...progressed,
        id: nextAtomId++,
        probability: outcomeProbability,
        poison: {
          ...freshPoisonState(
            next.tick,
            continuation,
            -1,
            appendApplicationHit(
              progressed.poison,
              next.tick + PLAYER_POISON_FIRST_HIT_DELAY,
              -1,
              outcome.multiplicity!,
            ),
          ),
          decayMass: outcome.decayMass,
          decayIndex: decayMean(outcome.decayMass),
        },
      });
      hasSuccess = true;
    }
  }

  const ordinaryCadenceOrder = advancesCadence ? rt.nextSeq++ : -1;
  const successHitOrder = hasSuccess ? rt.nextSeq++ : -1;
  const successCadenceOrder = hasSuccess ? rt.nextSeq++ : -1;
  const atoms = [
    ...other,
    ...ordinary.map(({ atom, cadenceAdvanced }) =>
      cadenceAdvanced &&
      atom.poison.remainingHits > 0 &&
      atom.poison.nextHitTick < atom.poison.expiresAtTick
        ? { ...atom, poison: { ...atom.poison, pendingEventSeq: ordinaryCadenceOrder } }
        : atom,
    ),
    ...successes.map((atom) => ({
      ...atom,
      poison: {
        ...atom.poison,
        pendingEventSeq: successCadenceOrder,
        pendingApplicationHits: atom.poison.pendingApplicationHits.map((hit) =>
          hit.seq < 0 ? { ...hit, seq: successHitOrder } : hit,
        ),
      },
    })),
  ];
  recordPlayerPoisonContinuation(
    rt,
    continuationAttempts,
    continuationActivations,
    continuationHits,
  );
  const built = distributionFromAtoms(rt, atoms, nextAtomId, next.tick);
  rememberPoisonTransition(transitionCache, transitionKey, {
    distribution: built.cached,
    nextSeq: rt.nextSeq,
    continuationAttempts,
    continuationActivations,
    continuationHits,
  });
  rt.state = patchTarget(rt.state, { weaponPoison: built.distribution });
  return true;
}

export function playerPoisonPrecedes(
  poison: PlayerPoisonEventOrder | undefined,
  event: ScheduledEvent<SimulationRuntime> | undefined,
): boolean {
  return (
    poison !== undefined &&
    (event === undefined ||
      poison.tick < event.tick ||
      (poison.tick === event.tick && poison.seq < event.seq))
  );
}
