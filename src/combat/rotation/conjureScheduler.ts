import { calculateHit } from "../pipeline/calculateHit";
import {
  skeletonRageMult,
  SPIRIT_AUTO_ABILITY_ID,
  SPIRIT_POISON_ABILITY_ID,
  spiritAutoFired,
  spiritAutoPending,
  spiritAutoProfile,
  spiritPoisonFired,
  spiritPoisonPending,
  ZOMBIE_POISON_BAND,
  type ActiveConjure,
} from "../styles/necromancy/conjures";
import type { ScheduledEvent } from "./events";
import { recordResolved } from "./resolution";
import { scheduleEvent, withinHorizon, type SimulationRuntime } from "./runtime";

/**
 * Conjure spirit schedulers: each summon instance owns two tracks (autos, and
 * zombie poison), each with exactly one pending event. Landing an event advances
 * its track and queues the next — never past untilTick (plus the sourced poison
 * tail) and never past the run's horizon. Events of a dismissed or re-summoned
 * spirit are identified by (id, untilTick) and die silently.
 */

function spiritEventLive(
  rt: SimulationRuntime,
  event: ScheduledEvent,
): { spirit: ActiveConjure; kind: "auto" | "poison" } | null {
  const meta = rt.spiritEventMeta.get(event.seq);
  if (!meta) return null;
  const spirit = rt.state.conjures.spirits.find(
    (s) => s.id === meta.id && s.untilTick === meta.untilTick,
  );
  if (!spirit) return null; // dismissed, or replaced by a re-summon
  if (meta.kind === "auto" && event.tick >= spirit.untilTick) return null;
  return { spirit, kind: meta.kind };
}

function patchSpirit(rt: SimulationRuntime, target: ActiveConjure, next: ActiveConjure): void {
  rt.state = {
    ...rt.state,
    conjures: {
      spirits: rt.state.conjures.spirits.map((s) => (s === target ? next : s)),
    },
  };
}

function scheduleSpiritAuto(rt: SimulationRuntime, spirit: ActiveConjure): void {
  const input = rt.input;
  const key = `${spirit.id}:${spirit.untilTick}:auto`;
  const seq = scheduleEvent(rt, {
    tick: spirit.nextAutoTick,
    family: "conjureAuto",
    abilityId: SPIRIT_AUTO_ABILITY_ID[spirit.id],
    sourceCast: -1,
    hitIndex: rt.spiritHitCounts.get(key) ?? 0,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    resolve: (at) => {
      // Spirit-internal mult (skeleton rage) stays on the band; the First Necro
      // set mult is post-hit damage so intermediate AD rounding does not distort
      // the exact +7%/piece ratio (wiki: conjure basics only).
      const profile = spiritAutoProfile(spirit.id);
      const live = rt.state.conjures.spirits.find(
        (s) => s.id === spirit.id && s.untilTick === spirit.untilTick,
      );
      if (!profile || !live) return { min: 0, max: 0, expected: 0 };
      const mult = spirit.id === "skeleton_warrior" ? skeletonRageMult(live.rageStacks) : 1;
      const hit = calculateHit({
        base: input.base,
        band: { minPct: profile.band.minPct * mult, maxPct: profile.band.maxPct * mult },
        level: input.level,
        accuracy: input.accuracy,
        crit: { chance: 0, eligible: false },
        modifiers: typeof input.modifiers === "function" ? [] : (input.modifiers ?? []),
        context: input.context,
        cap: input.cap,
      });
      const scale = input.conjureBasicDamageMult ?? 1;
      return { min: hit.min * scale, max: hit.max * scale, expected: hit.expected * scale };
    },
  });
  rt.spiritHitCounts.set(key, (rt.spiritHitCounts.get(key) ?? 0) + 1);
  rt.spiritEventMeta.set(seq, { id: spirit.id, untilTick: spirit.untilTick, kind: "auto" });
}

function scheduleSpiritPoison(rt: SimulationRuntime, spirit: ActiveConjure): void {
  const input = rt.input;
  const key = `${spirit.id}:${spirit.untilTick}:poison`;
  const seq = scheduleEvent(rt, {
    tick: spirit.nextPoisonTick,
    family: "poison",
    abilityId: SPIRIT_POISON_ABILITY_ID,
    sourceCast: -1,
    hitIndex: rt.spiritHitCounts.get(key) ?? 0,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    resolve: () => {
      const hit = calculateHit({
        base: input.base,
        band: { minPct: ZOMBIE_POISON_BAND.minPct, maxPct: ZOMBIE_POISON_BAND.maxPct },
        level: input.level,
        accuracy: input.accuracy,
        crit: { chance: 0, eligible: false },
        modifiers: typeof input.modifiers === "function" ? [] : (input.modifiers ?? []),
        context: input.context,
        cap: input.cap,
      });
      return { min: hit.min, max: hit.max, expected: hit.expected };
    },
  });
  rt.spiritHitCounts.set(key, (rt.spiritHitCounts.get(key) ?? 0) + 1);
  rt.spiritEventMeta.set(seq, { id: spirit.id, untilTick: spirit.untilTick, kind: "poison" });
}

/** Schedule this summon instance's pending tracks exactly once. */
export function scheduleSpiritTracks(rt: SimulationRuntime, spirit: ActiveConjure): void {
  const key = `${spirit.id}:${spirit.untilTick}`;
  if (rt.scheduledSpiritTracks.has(key)) return;
  rt.scheduledSpiritTracks.add(key);
  if (spiritAutoPending(spirit) && withinHorizon(rt, spirit.nextAutoTick)) {
    scheduleSpiritAuto(rt, spirit);
  }
  if (spiritPoisonPending(spirit) && withinHorizon(rt, spirit.nextPoisonTick)) {
    scheduleSpiritPoison(rt, spirit);
  }
}

/**
 * Land one conjureAuto/poison event: validate it against the live summon
 * instance, record its damage, advance the track, and queue the next event.
 * Events of dismissed or replaced spirits die silently.
 */
export function processSpiritEvent(rt: SimulationRuntime, event: ScheduledEvent): void {
  const live = spiritEventLive(rt, event);
  if (!live) return;
  recordResolved(rt, event, event.resolve(event.tick));
  const next =
    live.kind === "auto" ? spiritAutoFired(live.spirit) : spiritPoisonFired(live.spirit);
  patchSpirit(rt, live.spirit, next);
  if (live.kind === "auto" && spiritAutoPending(next) && withinHorizon(rt, next.nextAutoTick)) {
    scheduleSpiritAuto(rt, next);
  }
  if (live.kind === "poison" && spiritPoisonPending(next) && withinHorizon(rt, next.nextPoisonTick)) {
    scheduleSpiritPoison(rt, next);
  }
}
