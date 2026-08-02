import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { calculateHit } from "../../pipeline/calculateHit";
import { mulFloor } from "../../core/rounding";
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
  findConjure,
  hasAutoTrack,
  type ActiveConjure,
  type ActivePutridZombie,
  type ActiveSkeletonWarrior,
  type AutoAttackingConjure,
} from "../../styles/necromancy/conjures";
import type { CombatModifier, SourceReference } from "../../types";
import type { ScheduledEvent } from "../runtime/events";
import { NO_DAMAGE, recordResolved } from "../resolution";
import { scheduleEvent, type SimulationRuntime } from "../runtime/runtime";
import { patchConjures } from "../runtime/state";

/**
 * Conjure spirit schedulers: each summon instance owns two tracks (autos, and
 * zombie poison), each with exactly one pending event. Landing an event advances
 * its track and queues the next — never past untilTick (plus the sourced poison
 * tail). One next event stays queued past a fixed horizon so an ordered tail
 * replay can continue the track; the fixed-window clock never lands it.
 * Events of a dismissed or re-summoned spirit are identified by (id, untilTick)
 * and die silently.
 */

/**
 * Spirit autos have no ability-specific perks (Ultimatums/Lunging never match
 * this probe), so probing the modifier function with it yields exactly the
 * global set — which the prayer filter then reduces to the conjure-eligible
 * globals (wiki: conjures take Eruptive/Equilibrium/Vulnerability/set effects,
 * never the player's prayers).
 */
const FIRST_NECROMANCER_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/First_Necromancer%27s_equipment",
  title: "First Necromancer's equipment",
  verifiedAt: "2026-07-31",
};

export const SPIRIT_MODIFIER_SCOPE = {
  id: "spirit_auto",
  name: "Spirit auto",
  style: "necromancy",
  category: "basic",
  hits: [],
} as const satisfies AbilitySpec;

export function conjureBasicDamageModifier(mult: number): CombatModifier {
  return {
    id: "equipment:first-necromancer-conjure-basic",
    stage: "postHit",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: FIRST_NECROMANCER_SOURCE,
  };
}

export function resolveConjureModifiers(
  modifiers: CombatModifier[] | ((ability: AbilitySpec) => CombatModifier[]) | undefined,
): CombatModifier[] {
  const resolved =
    typeof modifiers === "function" ? modifiers(SPIRIT_MODIFIER_SCOPE) : (modifiers ?? []);
  return conjureEligibleModifiers(resolved);
}

function conjureModifiers(rt: SimulationRuntime): CombatModifier[] {
  return resolveConjureModifiers(rt.input.modifiers);
}

function spiritEventLive(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): { spirit: ActiveConjure; kind: "auto" | "poison" } | null {
  const meta = rt.spiritEventMeta.get(event.seq);
  if (!meta) return null;
  const spirit = rt.state.necromancy.conjures.spirits.find(
    (s) => s.id === meta.id && s.untilTick === meta.untilTick,
  );
  if (!spirit) return null; // dismissed, or replaced by a re-summon
  if (meta.kind === "auto" && event.tick >= spirit.untilTick) return null;
  return { spirit, kind: meta.kind };
}

function patchSpirit(rt: SimulationRuntime, target: ActiveConjure, next: ActiveConjure): void {
  rt.state = patchConjures(rt.state, {
    spirits: rt.state.necromancy.conjures.spirits.map((s) => (s === target ? next : s)),
  });
}

function scheduleSpiritAuto(rt: SimulationRuntime, spirit: AutoAttackingConjure): void {
  const input = rt.input;
  const key = `${spirit.id}:${spirit.untilTick}:auto`;
  const seq = scheduleEvent(rt, {
    tick: spirit.auto.nextTick,
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
      const live = findConjure(eventRt.state.necromancy.conjures, spirit.id);
      if (!profile || !live || live.untilTick !== spirit.untilTick) return NO_DAMAGE;
      const mult = live.id === "skeleton_warrior" ? skeletonRageMult(live.rageStacks) : 1;
      const scale = input.conjureBasicDamageMult ?? 1;
      const modifiers = conjureModifiers(eventRt);
      const hitMods =
        scale === 1 ? modifiers : [...modifiers, conjureBasicDamageModifier(scale)];
      const hit = calculateHit({
        base: input.base,
        band: { minPct: profile.band.minPct * mult, maxPct: profile.band.maxPct * mult },
        level: input.level,
        accuracy: CONJURE_DAMAGE_POTENTIAL,
        crit: { chance: 0, eligible: false },
        modifiers: hitMods,
        context: input.context,
        cap: input.cap,
      });
      return {
        damage: {
          min: hit.min,
          max: hit.max,
          expected: hit.expected,
          capLoss: hit.capLoss,
        },
        hitDetail: hit,
      };
    },
  });
  rt.spiritHitCounts.set(key, (rt.spiritHitCounts.get(key) ?? 0) + 1);
  rt.spiritEventMeta.set(seq, { id: spirit.id, untilTick: spirit.untilTick, kind: "auto" });
}

function scheduleSpiritPoison(rt: SimulationRuntime, spirit: ActivePutridZombie): void {
  const input = rt.input;
  const key = `${spirit.id}:${spirit.untilTick}:poison`;
  const seq = scheduleEvent(rt, {
    tick: spirit.poison.nextTick,
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
      return {
        damage: { min: hit.min, max: hit.max, expected: hit.expected, capLoss: hit.capLoss },
      };
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
  if (hasAutoTrack(spirit) && spiritAutoPending(spirit)) {
    scheduleSpiritAuto(rt, spirit);
  }
  if (spiritPoisonPending(spirit)) {
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
  const spirit = findConjure(rt.state.necromancy.conjures, "skeleton_warrior");
  if (!spirit) return;
  const raaarTick = candidate + COMMAND_SKELETON_RAAAR_DELAY_TICKS;
  const resumeTick =
    candidate + COMMAND_SKELETON_LAST_HIT_OFFSET + COMMAND_SKELETON_RESUME_DELAY_TICKS;
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
  if (pending) {
    rt.queue.cancelBySeq(pending.seq);
    rt.spiritEventMeta.delete(pending.seq);
    rt.spiritHitCounts.delete(`${spirit.id}:${spirit.untilTick}:auto`);
  }
  const next: ActiveSkeletonWarrior = { ...spirit, auto: { nextTick: resumeTick } };
  patchSpirit(rt, spirit, next);
  if (spiritAutoPending(next)) {
    scheduleSpiritAuto(rt, next);
  }
}

/**
 * Land one conjureAuto/poison event: validate it against the live summon
 * instance, record its damage, advance the track, and queue the next event.
 * Events of dismissed or replaced spirits die silently.
 */
export function processSpiritEvent(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  const live = spiritEventLive(rt, event);
  if (!live) return;
  recordResolved(rt, event, event.resolve(rt, event.tick));
  rt.spiritEventMeta.delete(event.seq);
  if (live.kind === "poison") {
    // Only the zombie has a poison track, and the type says so.
    if (live.spirit.id !== "putrid_zombie") return;
    const next = spiritPoisonFired(live.spirit);
    patchSpirit(rt, live.spirit, next);
    if (spiritPoisonPending(next)) {
      scheduleSpiritPoison(rt, next);
    }
    return;
  }
  const next = spiritAutoFired(live.spirit);
  patchSpirit(rt, live.spirit, next);
  if (hasAutoTrack(next) && spiritAutoPending(next)) {
    scheduleSpiritAuto(rt, next);
  }
}
