import { critProbability } from "../core/critical";
import type { AbilityHit } from "../pipeline/calculateAbility";
import { instabilityActive, LIGHTNING_SURGE_TICK_DELAY } from "../styles/magic/effects";
import {
  COMMAND_REQUIRES_CONJURE,
  COMMAND_SKELETON_EXPIRY_TAIL_TICKS,
} from "../styles/necromancy/conjures";
import { isNecromancyAbility } from "../styles/necromancy/abilities";
import type { PreparedCast } from "./castPreparation";
import type { CastRecord } from "./contracts";
import { resolveCastHit, resolveDerivedHit, resolveLightningSurge } from "./resolution";
import { scheduleEvent, type SimulationRuntime } from "./runtime";

/**
 * Damage-event construction for one prepared cast: sequence allocation, the
 * cast record, hit scheduling with provenance (real hits vs DoT vs command),
 * and Lightning Surge procs. No adrenaline or style-state transitions here.
 */
export function scheduleCastEvents(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  auto: boolean,
): CastRecord {
  const { ability, working, candidate, snap } = prepared;
  const castSeq = rt.nextCastSeq++;
  const record: CastRecord = {
    tick: candidate,
    abilityId: ability.id,
    result: {
      hits: [],
      min: 0,
      max: 0,
      expected: 0,
      adrenalineDelta: (working.adrenaline?.gain ?? 0) - (working.adrenaline?.cost ?? 0),
    },
    adrenalineAfter: 0,
    ...(auto ? { auto: true as const } : {}),
  };
  rt.recordBySeq.set(castSeq, record);

  const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
  // Wiki: commanded when the skeleton has less than its duration remaining, it
  // "will deal an attack on the tick it dies, and up to 2 ticks later" — later
  // command hits are never scheduled.
  const skeletonUntilTick =
    ability.id === "command_skeleton_warrior"
      ? rt.state.conjures.spirits.find((s) => s.id === "skeleton_warrior")?.untilTick
      : undefined;
  const hitSeqs: number[] = [];
  working.hits.forEach((hitSpec: AbilityHit, hitIndex: number) => {
    const landTick = candidate + (hitSpec.tickOffset ?? 0);
    if (
      skeletonUntilTick !== undefined &&
      landTick > skeletonUntilTick + COMMAND_SKELETON_EXPIRY_TAIL_TICKS
    ) {
      return;
    }
    const seq = rt.nextSeq++;
    hitSeqs.push(seq);
    rt.queue.push({
      tick: landTick,
      seq,
      family: isCommand
        ? "command"
        : hitSpec.critEligible === false && (hitSpec.tickOffset ?? 0) > 0
          ? "dot"
          : "hit",
      abilityId: ability.id,
      sourceCast: castSeq,
      hitIndex,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      cancelOwner: castSeq,
      resolve: (eventRt, at) => resolveCastHit(eventRt, at, seq, hitSpec, hitIndex, ability, snap),
    });
  });

  // Derived hits (Bloat tails, Death Skulls bounces): each is a fraction of the
  // resolved first hit, scheduled with provenance back to it.
  const derived = isNecromancyAbility(ability) ? ability.derivedHits : undefined;
  if (derived && hitSeqs.length > 0) {
    const sourceSeq = hitSeqs[0]!;
    for (let i = 0; i < derived.count; i++) {
      scheduleEvent(rt, {
        tick: candidate + derived.firstOffset + i * derived.intervalTicks,
        family: derived.dot ? "dot" : "hit",
        abilityId: ability.id,
        sourceCast: castSeq,
        hitIndex: i + 1,
        attached: false,
        procEligible: !derived.dot,
        recursionAllowed: false,
        cancelOwner: castSeq,
        derivedFrom: sourceSeq,
        resolve: (eventRt) => resolveDerivedHit(eventRt, sourceSeq, derived.fractionPct),
      });
    }
  }

  // Instability: Lightning Surge on Magic crits while the buff is active. The
  // granting cast's own hits predate the buff and never fire a surge (checked
  // here at cast time, before the grant in castEffects). Surge damage resolves
  // at its own land tick from the source hit's crit chance.
  if (
    ability.style === "magic" &&
    working.hits.length > 0 &&
    instabilityActive(rt.state.instability, candidate)
  ) {
    working.hits.forEach((hitSpec, hitIndex) => {
      if (hitSpec.critEligible === false) return;
      if (critProbability({ ...snap.critLayers, eligible: true }) <= 0) return;
      const sourceSeq = hitSeqs[hitIndex]!;
      scheduleEvent(rt, {
        tick: candidate + (hitSpec.tickOffset ?? 0) + LIGHTNING_SURGE_TICK_DELAY,
        family: "proc",
        abilityId: ability.id,
        sourceCast: castSeq,
        hitIndex,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
        cancelOwner: castSeq,
        resolve: (eventRt, at) =>
          resolveLightningSurge(eventRt, at, sourceSeq, castSeq, snap.critLayers, snap.baseMods),
      });
    });
  }

  return record;
}
