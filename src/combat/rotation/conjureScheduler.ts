import type { AbilitySpec } from "../pipeline/calculateAbility";
import { calculateHit } from "../pipeline/calculateHit";
import {
  COMMAND_SKELETON_LAST_HIT_OFFSET,
  COMMAND_SKELETON_RAAAR_DELAY_TICKS,
  COMMAND_SKELETON_RESUME_DELAY_TICKS,
  CONJURE_DAMAGE_POTENTIAL,
  conjureEligibleModifiers,
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
import type { CombatModifier } from "../types";
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

/**
 * Spirit autos have no ability-specific perks (Ultimatums/Lunging never match
 * this probe), so probing the modifier function with it yields exactly the
 * global set — which the prayer filter then reduces to the conjure-eligible
 * globals (wiki: conjures take Eruptive/Equilibrium/Vulnerability/set effects,
 * never the player's prayers).
 */
const SPIRIT_PROBE: AbilitySpec = {
  id: "spirit_auto",
  name: "Spirit auto",
  style: "necromancy",
  category: "basic",
  hits: [],
};

function conjureModifiers(rt: SimulationRuntime): CombatModifier[] {
  const modifiers = rt.input.modifiers;
  const resolved = typeof modifiers === "function" ? modifiers(SPIRIT_PROBE) : (modifiers ?? []);
  return conjureEligibleModifiers(resolved);
}

function spiritEventLive(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
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
    resolve: (eventRt) => {
      // Spirit-internal mult (skeleton rage) stays on the band; the First Necro
      // set mult is post-hit damage so intermediate AD rounding does not distort
      // the exact +7%/piece ratio (wiki: conjure basics only).
      const profile = spiritAutoProfile(spirit.id);
      const live = eventRt.state.conjures.spirits.find(
        (s) => s.id === spirit.id && s.untilTick === spirit.untilTick,
      );
      if (!profile || !live) return { min: 0, max: 0, expected: 0 };
      const mult = spirit.id === "skeleton_warrior" ? skeletonRageMult(live.rageStacks) : 1;
      const hit = calculateHit({
        base: input.base,
        band: { minPct: profile.band.minPct * mult, maxPct: profile.band.maxPct * mult },
        level: input.level,
        accuracy: CONJURE_DAMAGE_POTENTIAL,
        crit: { chance: 0, eligible: false },
        modifiers: conjureModifiers(eventRt),
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
    resolve: (eventRt) => {
      const hit = calculateHit({
        base: input.base,
        band: { minPct: ZOMBIE_POISON_BAND.minPct, maxPct: ZOMBIE_POISON_BAND.maxPct },
        level: input.level,
        accuracy: CONJURE_DAMAGE_POTENTIAL,
        crit: { chance: 0, eligible: false },
        modifiers: conjureModifiers(eventRt),
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
 * Command Skeleton Warrior mutates the skeleton's own scheduler (wiki tick
 * table, verified 2026-07-31): RAAAR lands at activation+1 — a normal auto due
 * on/before that tick still fires; later autos are suppressed through the
 * command, and the track resumes at last-command-hit + 2 (activation+13),
 * then every 5 ticks. Command hits themselves are cast events (see castEvents).
 */
export function applySkeletonCommand(rt: SimulationRuntime, candidate: number): void {
  const spirit = rt.state.conjures.spirits.find((s) => s.id === "skeleton_warrior");
  if (!spirit) return;
  const raaarTick = candidate + COMMAND_SKELETON_RAAAR_DELAY_TICKS;
  const resumeTick = candidate + COMMAND_SKELETON_LAST_HIT_OFFSET + COMMAND_SKELETON_RESUME_DELAY_TICKS;
  const pending = rt.queue
    .pending()
    .find(
      (e) =>
        e.family === "conjureAuto" &&
        e.abilityId === SPIRIT_AUTO_ABILITY_ID.skeleton_warrior &&
        rt.spiritEventMeta.get(e.seq)?.untilTick === spirit.untilTick,
    );
  if (pending && pending.tick <= raaarTick) {
    // The pending auto still fires; its successor resumes after the command.
    patchSpirit(rt, spirit, { ...spirit, commandResumeTick: resumeTick });
    return;
  }
  if (pending) rt.spiritEventMeta.delete(pending.seq); // suppressed: the event dies
  const next = { ...spirit, nextAutoTick: resumeTick };
  patchSpirit(rt, spirit, next);
  if (spiritAutoPending(next) && withinHorizon(rt, next.nextAutoTick)) {
    scheduleSpiritAuto(rt, next);
  }
}

/**
 * Land one conjureAuto/poison event: validate it against the live summon
 * instance, record its damage, advance the track, and queue the next event.
 * Events of dismissed or replaced spirits die silently.
 */
export function processSpiritEvent(rt: SimulationRuntime, event: ScheduledEvent<SimulationRuntime>): void {
  const live = spiritEventLive(rt, event);
  if (!live) return;
  recordResolved(rt, event, event.resolve(rt, event.tick));
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
