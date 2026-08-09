import type { AbilityHit } from "../../pipeline/calculateAbility";
import {
  COMMAND_REQUIRES_CONJURE,
  COMMAND_SKELETON_EXPIRY_TAIL_TICKS,
} from "../../styles/necromancy/conjures";
import type { PreparedCast } from "./prepare";
import type { CastRecord } from "../simulation/contracts";
import { resolveCastHit, resolveDerivedHit } from "../resolution";
import { enqueueEvent, scheduleEvent, type SimulationRuntime } from "../runtime/runtime";
import { outgoingSourceOf, provenanceForCastHit } from "../../shared/damageProvenance";
import type { BleedId } from "../../types";

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
      listedAdrenalineDelta: (working.adrenaline?.gain ?? 0) - (working.adrenaline?.cost ?? 0),
    },
    adrenalineAfter: 0,
    adrenalineBefore: rt.state.adrenaline,
    listedCost: ability.adrenaline?.cost ?? 0,
    effectiveCost: prepared.cost,
    actualSpend: prepared.spend,
    refund: 0,
    adrenalineGained: 0,
    ...(auto ? { auto: true as const } : {}),
  };
  rt.recordBySeq.set(castSeq, record);

  const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
  // Wiki: commanded when the skeleton has less than its duration remaining, it
  // "will deal an attack on the tick it dies, and up to 2 ticks later" - later
  // command hits are never scheduled.
  const skeletonUntilTick =
    ability.id === "command_skeleton_warrior"
      ? rt.state.necromancy.conjures.spirits.find((s) => s.id === "skeleton_warrior")?.untilTick
      : undefined;
  const hitSeqs: number[] = [];
  const bleedExpires = new Map<BleedId, number>();
  for (const hit of working.hits) {
    if (!hit.bleedId) continue;
    bleedExpires.set(
      hit.bleedId,
      Math.max(bleedExpires.get(hit.bleedId) ?? 0, candidate + (hit.tickOffset ?? 0) + 1),
    );
  }
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
    // Classified once, here, from what the ability declares. Never inferred
    // from timing or crit eligibility: a delayed direct hit stays direct, and a
    // bleed tick landing on the cast tick is still a bleed tick.
    // channelAsDot (Endless Assault): family still DoT; provenance is player_converted_channel.
    const isDot = hitSpec.dot === true || prepared.channelAsDot;
    const provenance = provenanceForCastHit({
      isCommand,
      isDot,
      convertedChannel: prepared.channelAsDot,
      dotKind: hitSpec.dotKind,
      bleedId: hitSpec.bleedId,
    });
    const originKind = outgoingSourceOf(provenance);
    enqueueEvent(rt, {
      tick: landTick,
      seq,
      family: isCommand ? "command" : isDot ? "dot" : "hit",
      abilityId: ability.id,
      sourceCast: castSeq,
      hitIndex,
      attached: false,
      procEligible: !isDot,
      recursionAllowed: false,
      originKind,
      provenance,
      cancelOwner: castSeq,
      castSnap: snap,
      ...(prepared.flowReduction !== undefined ? { flowReduction: prepared.flowReduction } : {}),
      ...(prepared.channelAsDot ? { convertedChannel: true } : {}),
      ...(hitSpec.dotKind ? { dotKind: hitSpec.dotKind } : {}),
      ...(hitSpec.bleedId
        ? {
            bleedId: hitSpec.bleedId,
            bleedExpiresAtTick: bleedExpires.get(hitSpec.bleedId),
          }
        : {}),
      ...(ability.style === "magic" &&
      snap.magicWeaponAtCast &&
      !isDot &&
      hitSpec.critEligible !== false
        ? { lightningSurge: true as const }
        : {}),
      resolve: (eventRt, at) =>
        resolveCastHit(eventRt, at, hitSpec, hitIndex, ability, snap, isDot, prepared.channelAsDot),
    });
  });

  // Derived hits (Bloat tails, Death Skulls bounces, Corruption): each is a
  // fraction of the resolved first hit, scheduled with provenance back to it.
  const derived = working.derivedHits;
  if (derived && hitSeqs.length > 0) {
    if (derived.fractionPcts != null) {
      if (derived.fractionPcts.length !== derived.count) {
        throw new Error(
          `derivedHits.fractionPcts length ${derived.fractionPcts.length} != count ${derived.count} for ${ability.id}`,
        );
      }
      for (let i = 0; i < derived.fractionPcts.length; i++) {
        const v = derived.fractionPcts[i];
        if (typeof v !== "number" || !Number.isFinite(v)) {
          throw new Error(
            `derivedHits.fractionPcts[${i}] is not a finite number for ${ability.id}`,
          );
        }
      }
    }
    const sourceSeq = hitSeqs[0]!;
    for (let i = 0; i < derived.count; i++) {
      const pct = derived.fractionPcts != null ? derived.fractionPcts[i]! : derived.fractionPct;
      const provenance = derived.dot
        ? { kind: "derived_tail" as const, detail: ability.id }
        : { kind: "derived_bounce" as const, detail: ability.id };
      scheduleEvent(rt, {
        tick: candidate + derived.firstOffset + i * derived.intervalTicks,
        family: derived.dot ? "dot" : "hit",
        abilityId: ability.id,
        sourceCast: castSeq,
        hitIndex: i + 1,
        attached: false,
        procEligible: !derived.dot,
        recursionAllowed: false,
        originKind: derived.dot ? "dot" : "direct",
        provenance,
        cancelOwner: castSeq,
        castSnap: snap,
        derivedFrom: sourceSeq,
        resolve: (eventRt, landTick) =>
          resolveDerivedHit(eventRt, sourceSeq, pct, landTick, provenance),
      });
    }
  }

  return record;
}
