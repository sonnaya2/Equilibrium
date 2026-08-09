import {
  PLAYER_POISON_EFFECT_ID,
  PLAYER_POISON_FIRST_HIT_DELAY,
  PLAYER_POISON_STATUS_TICKS,
  isTargetPoisonImmune,
  resolvePoisonApplication,
  type PoisonApplicationSnapshot,
} from "../../poison/mechanics";
import { envenomedPoisonImmunityDisableTicks } from "../../league/ruleset";
import { recordResolved } from "../resolution";
import { NO_DAMAGE, type AttachedDamageComponent } from "../resolution/types";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import {
  patchTarget,
  type TargetWeaponPoisonHitMultiplicity,
  type TargetWeaponPoisonPendingHit,
  type TargetWeaponPoisonSample,
  type TargetWeaponPoisonState,
} from "../runtime/state";
import {
  recordPlayerPoisonApplication,
  recordPlayerPoisonContinuation,
  resolvePlayerPoison,
  type PlayerPoisonEventOrder,
  type PlayerPoisonLandOccurrence,
  type PlayerPoisonLandResult,
} from "./playerPoison";

type DuePoisonHit =
  | { readonly kind: "cadence"; readonly order: PlayerPoisonEventOrder }
  | {
      readonly kind: "application";
      readonly order: PlayerPoisonEventOrder;
      readonly pending: TargetWeaponPoisonPendingHit;
    };

function sampleState(rt: SimulationRuntime): TargetWeaponPoisonSample {
  return rt.state.target.weaponPoison;
}

function updateSample(rt: SimulationRuntime, sample: TargetWeaponPoisonSample): void {
  rt.state = patchTarget(rt.state, { weaponPoison: sample });
}

function boundedProbability(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} outside 0-1: ${value}`);
  }
  return value;
}

function compareOrder(left: PlayerPoisonEventOrder, right: PlayerPoisonEventOrder): number {
  return left.tick - right.tick || left.seq - right.seq;
}

function positiveBinomial(
  rt: SimulationRuntime,
  stream: string,
  trials: number,
  probability: number,
): number {
  if (!Number.isInteger(trials) || trials < 1) {
    throw new RangeError(`positive binomial trials must be positive: ${trials}`);
  }
  const p = boundedProbability(probability, "probability");
  if (p >= 1) return trials;
  if (p <= 0) throw new RangeError("positive binomial probability must be greater than zero");
  const failure = 1 - p;
  const zeroMass = failure ** trials;
  const target = zeroMass + rt.stochastic.uniform(stream) * (1 - zeroMass);
  let mass = zeroMass;
  let cumulative = mass;
  for (let successes = 1; successes <= trials; successes++) {
    mass *= ((trials - successes + 1) / successes) * (p / failure);
    cumulative += mass;
    if (target < cumulative || successes === trials) return successes;
  }
  return trials;
}

function samplePositiveMultiplicity(
  rt: SimulationRuntime,
  stream: string,
  multiplicity: TargetWeaponPoisonHitMultiplicity,
): number {
  switch (multiplicity.kind) {
    case "single":
      return 1;
    case "positive-binomial":
      return positiveBinomial(rt, stream, multiplicity.trials, multiplicity.probability);
    case "positive-geometric":
      return 1 + rt.stochastic.geometricSuccesses(stream, multiplicity.continuationProbability);
  }
}

function appendApplicationHits(
  rt: SimulationRuntime,
  poison: TargetWeaponPoisonState,
  tick: number,
  count: number,
): readonly TargetWeaponPoisonPendingHit[] {
  const pending = [...poison.pendingApplicationHits];
  for (let index = 0; index < count; index++) {
    pending.push({ tick, seq: rt.nextSeq++, multiplicity: { kind: "single" } });
  }
  return pending.sort((left, right) => left.tick - right.tick || left.seq - right.seq);
}

function freshPoisonState(
  rt: SimulationRuntime,
  atTick: number,
  source: PoisonApplicationSnapshot,
  pendingApplicationHits: readonly TargetWeaponPoisonPendingHit[],
): TargetWeaponPoisonState {
  return {
    active: true,
    expiresAtTick: atTick + PLAYER_POISON_STATUS_TICKS,
    effectiveTier: source.effectiveTier,
    decayIndex: 0,
    remainingHits: source.hitBudget - 1,
    cadenceTicks: source.cadenceTicks,
    nextHitTick: atTick + PLAYER_POISON_FIRST_HIT_DELAY + source.cadenceTicks,
    pendingEventSeq: rt.nextSeq++,
    sourceDamageMultiplier: source.sourceDamageMultiplier,
    cinderbaneContinuation: source.cinderbaneContinuation,
    sourceLabel: source.sourceLabel,
    pendingApplicationHits,
  };
}

function refreshPoisonState(
  atTick: number,
  source: PoisonApplicationSnapshot,
  poison: TargetWeaponPoisonState,
): TargetWeaponPoisonState {
  return {
    ...poison,
    active: true,
    expiresAtTick: atTick + PLAYER_POISON_STATUS_TICKS,
    effectiveTier: source.effectiveTier,
    decayIndex: 0,
    remainingHits: Math.max(0, source.hitBudget - poison.pendingApplicationHits.length),
    cadenceTicks: source.cadenceTicks,
    sourceDamageMultiplier: source.sourceDamageMultiplier,
    cinderbaneContinuation: source.cinderbaneContinuation,
    sourceLabel: source.sourceLabel,
  };
}

export function applyPlayerPoisonLandOccurrence(
  rt: SimulationRuntime,
  atTick: number,
  source: PoisonApplicationSnapshot | null,
  occurrence: PlayerPoisonLandOccurrence,
): PlayerPoisonLandResult {
  const occurrenceProbability = boundedProbability(
    occurrence.occurrenceProbability,
    "occurrenceProbability",
  );
  const successProbability = source
    ? boundedProbability(occurrence.applicationSuccessProbability, "applicationSuccessProbability")
    : 0;
  if (successProbability > occurrenceProbability + Number.EPSILON) {
    throw new RangeError("application success exceeds event occurrence probability");
  }
  if (!rt.stochastic.bernoulli(`player-poison:occurrence:${atTick}`, occurrenceProbability)) {
    return { expectedAttempts: 0, expectedSuccesses: 0, expectedApplicationHits: 0 };
  }

  let sample = sampleState(rt);
  const immunityDisabledUntilTick =
    rt.input.targetPoisonImmune === true
      ? Math.max(sample.immunityDisabledUntilTick, occurrence.immunityDisabledUntilTick)
      : 0;
  sample = { ...sample, immunityDisabledUntilTick };
  const eligible = !isTargetPoisonImmune(
    rt.input.targetPoisonImmune,
    immunityDisabledUntilTick,
    atTick,
  );
  const conditionalAttempts =
    occurrenceProbability > 0 ? occurrence.expectedOccurrences / occurrenceProbability : 0;
  const attempts = source && eligible ? conditionalAttempts : 0;
  const succeeds =
    source !== null &&
    eligible &&
    rt.stochastic.bernoulli(
      `player-poison:application:${atTick}`,
      occurrenceProbability > 0 ? successProbability / occurrenceProbability : 0,
    );
  if (!succeeds || !source) {
    recordPlayerPoisonApplication(rt, "attempt", attempts);
    updateSample(rt, sample);
    return { expectedAttempts: attempts, expectedSuccesses: 0, expectedApplicationHits: 0 };
  }

  const successes = samplePositiveMultiplicity(
    rt,
    `player-poison:application-count:${atTick}`,
    occurrence.applicationSuccessMultiplicity,
  );
  const live = sample.poison.active && atTick < sample.poison.expiresAtTick;
  const earnsHit = !live || source.cinderbaneContinuation;
  const hitCount = earnsHit ? (source.cinderbaneContinuation ? successes : 1) : 0;
  const landsWithinHorizon =
    rt.horizon === undefined || atTick + PLAYER_POISON_FIRST_HIT_DELAY < rt.horizon;
  const pending =
    landsWithinHorizon && hitCount > 0
      ? appendApplicationHits(rt, sample.poison, atTick + PLAYER_POISON_FIRST_HIT_DELAY, hitCount)
      : sample.poison.pendingApplicationHits;
  const poison = earnsHit
    ? freshPoisonState(rt, atTick, source, pending)
    : refreshPoisonState(atTick, source, sample.poison);
  recordPlayerPoisonApplication(rt, "attempt", attempts);
  recordPlayerPoisonApplication(rt, "success", successes);
  updateSample(rt, { poison, immunityDisabledUntilTick });
  return {
    expectedAttempts: attempts,
    expectedSuccesses: successes,
    expectedApplicationHits: landsWithinHorizon ? hitCount : 0,
  };
}

export function refreshPlayerPoisonImmunity(
  rt: SimulationRuntime,
  atTick: number,
  untilTick: number,
): void {
  if (rt.input.targetPoisonImmune !== true || untilTick <= atTick) return;
  const sample = sampleState(rt);
  updateSample(rt, {
    ...sample,
    immunityDisabledUntilTick: Math.max(sample.immunityDisabledUntilTick, untilTick),
  });
}

function nextDue(sample: TargetWeaponPoisonSample): DuePoisonHit | undefined {
  const poison = sample.poison;
  let due: DuePoisonHit | undefined;
  if (
    poison.active &&
    poison.remainingHits > 0 &&
    poison.nextHitTick < poison.expiresAtTick &&
    poison.pendingEventSeq >= 0
  ) {
    due = {
      kind: "cadence",
      order: { tick: poison.nextHitTick, seq: poison.pendingEventSeq },
    };
  }
  const pending = poison.pendingApplicationHits[0];
  if (pending) {
    const order = { tick: pending.tick, seq: pending.seq };
    if (!due || compareOrder(order, due.order) < 0) {
      due = { kind: "application", order, pending };
    }
  }
  return due;
}

export function nextPlayerPoisonEvent(rt: SimulationRuntime): PlayerPoisonEventOrder | undefined {
  return nextDue(sampleState(rt))?.order;
}

export function lastPlayerPoisonTick(rt: SimulationRuntime): number {
  const poison = sampleState(rt).poison;
  let tick = poison.active && poison.remainingHits > 0 ? poison.nextHitTick : -1;
  for (const pending of poison.pendingApplicationHits) tick = Math.max(tick, pending.tick);
  return tick;
}

function attachedComponents(
  resolved: ReturnType<typeof resolvePlayerPoison>,
): AttachedDamageComponent[] {
  return resolved.attached
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
        expectedActivations: 1,
      },
    }));
}

function removePending(
  poison: TargetWeaponPoisonState,
  pending: TargetWeaponPoisonPendingHit,
): readonly TargetWeaponPoisonPendingHit[] {
  return poison.pendingApplicationHits.filter(
    (hit) => hit.tick !== pending.tick || hit.seq !== pending.seq,
  );
}

export function processNextPlayerPoisonEvent(
  rt: SimulationRuntime,
  bound = Number.POSITIVE_INFINITY,
): boolean {
  let sample = sampleState(rt);
  const due = nextDue(sample);
  if (!due || due.order.tick > bound) return false;
  const poison = sample.poison;
  const resolved = resolvePlayerPoison(rt, poison, due.order.tick, poison.decayIndex);
  const components = attachedComponents(resolved);
  const attached = components.reduce(
    (total, component) => ({
      min: total.min + component.damage.min,
      expected: total.expected + component.damage.expected,
      max: total.max + component.damage.max,
    }),
    { min: 0, expected: 0, max: 0 },
  );
  const event: ScheduledEvent<SimulationRuntime> = {
    tick: due.order.tick,
    seq: due.order.seq,
    family: "poison",
    abilityId: PLAYER_POISON_EFFECT_ID,
    sourceCast: -1,
    hitIndex: poison.decayIndex,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    expectedOccurrences: 1,
    expectedTriggerRolls: 0,
    expectedActivations: 0,
    expectedSeparateHits: 1,
    originKind: "poison",
    provenance: { kind: "player_poison" },
    resolve: () => NO_DAMAGE,
  };
  recordResolved(rt, event, {
    damage: {
      min: resolved.host.min + attached.min,
      expected: resolved.host.expected + attached.expected,
      max: resolved.host.max + attached.max,
    },
    ...(components.length > 0 ? { components } : {}),
  });
  refreshPlayerPoisonImmunity(
    rt,
    due.order.tick,
    due.order.tick + envenomedPoisonImmunityDisableTicks(rt.input.league),
  );
  sample = sampleState(rt);

  const pendingApplicationHits =
    due.kind === "application"
      ? removePending(sample.poison, due.pending)
      : sample.poison.pendingApplicationHits;
  const remainingHits =
    due.kind === "cadence"
      ? Math.max(0, sample.poison.remainingHits - 1)
      : sample.poison.remainingHits;
  const available = resolvePoisonApplication(rt.input.playerPoison, due.order.tick);
  const continuationEligible =
    sample.poison.cinderbaneContinuation &&
    available !== null &&
    !isTargetPoisonImmune(
      rt.input.targetPoisonImmune,
      sample.immunityDisabledUntilTick,
      due.order.tick,
    );
  const continued =
    continuationEligible &&
    rt.stochastic.bernoulli(
      `player-poison:continuation:${due.order.tick}`,
      available.continuationChance,
    );
  recordPlayerPoisonContinuation(
    rt,
    continuationEligible ? 1 : 0,
    continued ? 1 : 0,
    continued &&
      (rt.horizon === undefined || due.order.tick + PLAYER_POISON_FIRST_HIT_DELAY < rt.horizon)
      ? 1
      : 0,
  );

  if (continued) {
    const withContinuation =
      rt.horizon === undefined || due.order.tick + PLAYER_POISON_FIRST_HIT_DELAY < rt.horizon
        ? appendApplicationHits(
            rt,
            { ...sample.poison, pendingApplicationHits },
            due.order.tick + PLAYER_POISON_FIRST_HIT_DELAY,
            1,
          )
        : pendingApplicationHits;
    updateSample(rt, {
      ...sample,
      poison: freshPoisonState(rt, due.order.tick, available, withContinuation),
    });
    return true;
  }

  const nextHitTick =
    due.kind === "cadence"
      ? due.order.tick + sample.poison.cadenceTicks
      : sample.poison.nextHitTick;
  const active = due.order.tick < sample.poison.expiresAtTick;
  const hasNextCadence =
    due.kind === "cadence" &&
    active &&
    remainingHits > 0 &&
    nextHitTick < sample.poison.expiresAtTick;
  updateSample(rt, {
    ...sample,
    poison: {
      ...sample.poison,
      active,
      decayIndex: sample.poison.decayIndex + 1,
      remainingHits,
      nextHitTick,
      pendingEventSeq:
        due.kind === "cadence"
          ? hasNextCadence
            ? rt.nextSeq++
            : -1
          : sample.poison.pendingEventSeq,
      pendingApplicationHits,
    },
  });
  return true;
}

export function playerPoisonDamageAllowed(rt: SimulationRuntime, atTick: number): boolean {
  const sample = sampleState(rt);
  return !isTargetPoisonImmune(
    rt.input.targetPoisonImmune,
    sample.immunityDisabledUntilTick,
    atTick,
  );
}
