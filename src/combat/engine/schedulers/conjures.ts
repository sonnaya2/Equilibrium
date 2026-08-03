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
 * Spirit track schedulers: one pending auto and (zombie) poison event per summon.
 * Land advances track; never past untilTick (+ poison tail). Identity (id, untilTick);
 * dismissed/re-summoned events die silently. Horizon may hold one extra ordered tail event.
 */

const FIRST_NECROMANCER_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/First_Necromancer%27s_equipment",
  title: "First Necromancer's equipment",
  verifiedAt: "2026-07-31",
};

/**
 * Probe ability for resolveConjureModifiers: no ability-scoped perks match, so globals
 * only; prayer filter drops player prayers (wiki: Eruptive/Equilibrium/Vulnerability/sets).
 */
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
    originKind: "conjure",
    provenance: { kind: "conjure_auto", detail: spirit.id },
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
      const hitMods = scale === 1 ? modifiers : [...modifiers, conjureBasicDamageModifier(scale)];
      const provenance = {
        kind: "conjure_auto" as const,
        detail: spirit.id,
      };
      const hit = calculateHit({
        base: input.base,
        band: { minPct: profile.band.minPct * mult, maxPct: profile.band.maxPct * mult },
        level: input.level,
        accuracy: CONJURE_DAMAGE_POTENTIAL,
        crit: { chance: 0, eligible: false },
        modifiers: hitMods,
        provenance,
        context: {
          style: input.context?.style ?? "necromancy",
          ...input.context,
          damageSource: "conjure",
          provenance,
        },
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
    originKind: "conjure",
    provenance: { kind: "conjure_poison", detail: "putrid_zombie" },
    resolve: (eventRt) => {
      const provenance = { kind: "conjure_poison" as const, detail: "putrid_zombie" };
      const hit = calculateHit({
        base: input.base,
        band: { minPct: ZOMBIE_POISON_BAND.minPct, maxPct: ZOMBIE_POISON_BAND.maxPct },
        level: input.level,
        accuracy: CONJURE_DAMAGE_POTENTIAL,
        crit: { chance: 0, eligible: false },
        modifiers: conjureModifiers(eventRt),
        provenance,
        context: {
          style: input.context?.style ?? "necromancy",
          ...input.context,
          damageSource: "conjure",
          dotKind: "poison",
          provenance,
        },
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
 * Command Skeleton Warrior scheduler (wiki tick table, 2026-07-31):
 * RAAAR at activation+1 (auto due on/before that tick still fires); later autos
 * suppressed; resume at last-command-hit + 2 (activation+13), then every 5 ticks.
 * Command hits are cast events (castEvents).
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

/** Land one conjureAuto/poison: validate live summon, record, advance track, queue next. */
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
