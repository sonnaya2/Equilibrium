import {
  PLAYER_POISON_EFFECT_ID,
  PLAYER_POISON_FIRST_HIT_DELAY,
  PLAYER_POISON_STATUS_TICKS,
  activeEvolvingToxinStacks,
  evolvingToxinMultiplier,
  playerPoisonDamage,
  resolvePoisonApplication,
  type PoisonApplicationSnapshot,
} from "../../poison/mechanics";
import { VULNERABILITY_MULTIPLIER } from "../../shared/vulnerability";
import { keepsAnalysisLedgers } from "../simulation/contracts";
import { recordResolved } from "../resolution";
import { abilityDamageAt } from "../resolution/castHit";
import { NO_DAMAGE, type EventResolution } from "../resolution/types";
import type { ScheduledEvent } from "../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../runtime/runtime";
import { patchTarget } from "../runtime/state";

function resolvePlayerPoison(rt: SimulationRuntime, atTick: number): EventResolution {
  const poison = rt.state.target.weaponPoison;
  if (!poison.active || atTick >= poison.expiresAtTick || poison.remainingHits <= 0) {
    return NO_DAMAGE;
  }
  const toxin = rt.state.target.evolvingToxin;
  const stacks = activeEvolvingToxinStacks(toxin.stacks, toxin.expiresAtTick, atTick);
  const targetMultiplier =
    (rt.input.playerPoison?.vulnerability ? VULNERABILITY_MULTIPLIER : 1) *
    evolvingToxinMultiplier(stacks);
  return {
    damage: playerPoisonDamage(
      abilityDamageAt(rt, atTick),
      poison.effectiveTier,
      poison.decayIndex,
      poison.sourceDamageMultiplier,
      targetMultiplier,
    ),
  };
}

function queuePoisonHit(rt: SimulationRuntime, tick: number): number {
  return scheduleEvent(rt, {
    tick,
    family: "poison",
    abilityId: PLAYER_POISON_EFFECT_ID,
    sourceCast: -1,
    hitIndex: rt.state.target.weaponPoison.decayIndex,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    expectedTriggerRolls: 0,
    expectedActivations: 0,
    expectedSeparateHits: 1,
    originKind: "poison",
    provenance: { kind: "player_poison" },
    resolve: resolvePlayerPoison,
  });
}

export function applyPlayerPoison(
  rt: SimulationRuntime,
  atTick: number,
  source: PoisonApplicationSnapshot,
): void {
  if (rt.input.playerPoison?.targetPoisonImmune) return;
  const current = rt.state.target.weaponPoison;
  if (current.pendingEventSeq >= 0) rt.queue.cancelBySeq(current.pendingEventSeq);
  const nextHitTick = atTick + PLAYER_POISON_FIRST_HIT_DELAY;
  rt.state = patchTarget(rt.state, {
    weaponPoison: {
      active: true,
      appliedAtTick: atTick,
      expiresAtTick: atTick + PLAYER_POISON_STATUS_TICKS,
      effectiveTier: source.effectiveTier,
      decayIndex: 0,
      remainingHits: source.hitBudget,
      cadenceTicks: source.cadenceTicks,
      nextHitTick,
      pendingEventSeq: -1,
      sourceDamageMultiplier: source.sourceDamageMultiplier,
      cinderbaneContinuation: source.cinderbaneContinuation,
      continuationChance: source.continuationChance,
      sourceLabel: source.sourceLabel,
    },
  });
  const pendingEventSeq = queuePoisonHit(rt, nextHitTick);
  rt.state = patchTarget(rt.state, {
    weaponPoison: { ...rt.state.target.weaponPoison, pendingEventSeq },
  });
}

export function recordPlayerPoisonApplication(
  rt: SimulationRuntime,
  kind: "attempt" | "success",
): void {
  if (!keepsAnalysisLedgers(rt.detailLevel)) return;
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
    bonusDamage: 0,
  };
  if (kind === "success") ledger.expectedActivations += 1;
  else ledger.expectedTriggerRolls += 1;
  rt.analysis.effects.set(PLAYER_POISON_EFFECT_ID, ledger);
}

export function processPlayerPoisonEvent(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): PoisonApplicationSnapshot | null {
  const state = rt.state.target.weaponPoison;
  if (
    !state.active ||
    state.pendingEventSeq !== event.seq ||
    event.tick >= state.expiresAtTick ||
    state.remainingHits <= 0
  ) {
    return null;
  }
  const continuation = state.cinderbaneContinuation
    ? resolvePoisonApplication(rt.input.playerPoison, event.tick)
    : null;
  recordResolved(rt, event, event.resolve(rt, event.tick));
  const remainingHits = state.remainingHits - 1;
  const nextHitTick = event.tick + state.cadenceTicks;
  rt.state = patchTarget(rt.state, {
    weaponPoison: {
      ...state,
      active: remainingHits > 0 && nextHitTick < state.expiresAtTick,
      decayIndex: state.decayIndex + 1,
      remainingHits,
      nextHitTick,
      pendingEventSeq: -1,
    },
  });
  if (rt.state.target.weaponPoison.active) {
    const pendingEventSeq = queuePoisonHit(rt, nextHitTick);
    rt.state = patchTarget(rt.state, {
      weaponPoison: { ...rt.state.target.weaponPoison, pendingEventSeq },
    });
  }
  return continuation;
}

export function isPlayerPoisonEvent(event: ScheduledEvent<SimulationRuntime>): boolean {
  return event.provenance.kind === "player_poison";
}
