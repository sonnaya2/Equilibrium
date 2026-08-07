import type { AbilitySpec } from "../../pipeline/calculateAbility";
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
import {
  applyHaunted,
  hauntedActive,
  hauntedBonusDamage,
  hauntedParentDamage,
} from "../../styles/necromancy/haunted";
import type { CombatModifier, SourceReference } from "../../types";
import {
  activeEvolvingToxinStacks,
  evolvingToxinPoisonModifier,
  isTargetPoisonImmune,
  poisonProfileDamageModifier,
} from "../../poison/mechanics";
import { isRangedAmmoActive } from "../../styles/ranged/ammoModel";
import type { ScheduledEvent } from "../runtime/events";
import { NO_DAMAGE, recordResolved } from "../resolution";
import type { AttachedDamageComponent, EventResolution } from "../resolution/types";
import { scheduleEvent, type SimulationRuntime } from "../runtime/runtime";
import { patchConjures, patchTarget } from "../runtime/state";
import { recordConditionalPoisonDamage, refreshPlayerPoisonImmunity } from "./playerPoison";
import { envenomedPoisonImmunityDisableTicks } from "../../league/ruleset";
import { attachedResolutionComponent, resolveLeagueAttachedHost } from "../../league/damage";

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
      const host = resolveLeagueAttachedHost({
        rules: input.league,
        source: provenance,
        landTick: spirit.auto.nextTick,
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
          min: host.hit.min,
          max: host.hit.max,
          expected: host.hit.expected,
          capLoss: host.hit.capLoss,
        },
        hitDetail: host.hit,
        ...(host.components.length > 0
          ? {
              components: host.components.map((component) =>
                attachedResolutionComponent(component),
              ),
            }
          : {}),
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
      const toxin = eventRt.state.target.evolvingToxin;
      const stacks = activeEvolvingToxinStacks(
        toxin.stacks,
        toxin.expiresAtTick,
        spirit.poison.nextTick,
      );
      const poisonModifiers = [
        poisonProfileDamageModifier(input.playerPoison, spirit.poison.nextTick),
        isRangedAmmoActive(input.ammo, input.context?.style, input.equipmentIds)
          ? evolvingToxinPoisonModifier(stacks)
          : null,
      ].filter((modifier): modifier is CombatModifier => modifier !== null);
      const host = resolveLeagueAttachedHost({
        rules: input.league,
        source: provenance,
        landTick: spirit.poison.nextTick,
        base: input.base,
        band: { minPct: ZOMBIE_POISON_BAND.minPct, maxPct: ZOMBIE_POISON_BAND.maxPct },
        level: input.level,
        accuracy: CONJURE_DAMAGE_POTENTIAL,
        crit: { chance: 0, eligible: false },
        modifiers: [...conjureModifiers(eventRt), ...poisonModifiers],
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
        damage: {
          min: host.hit.min,
          max: host.hit.max,
          expected: host.hit.expected,
          capLoss: host.hit.capLoss,
        },
        hitDetail: host.hit,
        ...(host.components.length > 0
          ? {
              components: host.components.map((component) =>
                attachedResolutionComponent(component),
              ),
            }
          : {}),
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

/**
 * Attach land-time Haunted % of full-accuracy parent to spirit auto or poison.
 * Spirit tracks use DP=1 so reverse is a no-op; helper kept for consistency.
 * Apply/refresh of Haunted remains commanding ghost auto only.
 */
function attachHauntedToSpiritHit(
  rt: SimulationRuntime,
  resolution: EventResolution,
  tick: number,
): EventResolution {
  const haunted = rt.state.target.haunted;
  if (!hauntedActive(haunted, tick)) return resolution;
  const d = resolution.damage;
  if (d.max <= 0 && d.expected <= 0) return resolution;
  const capAD = haunted.capAbilityDamage;
  const pot = resolution.hitDetail?.potential ?? 1;
  const bonusMin = hauntedBonusDamage(hauntedParentDamage(d.min, pot), capAD);
  const bonusMax = hauntedBonusDamage(hauntedParentDamage(d.max, pot), capAD);
  const bonusExpected = hauntedBonusDamage(hauntedParentDamage(d.expected, pot), capAD);
  if (bonusMax <= 0 && bonusExpected <= 0) return resolution;
  const component: AttachedDamageComponent = {
    id: "haunted",
    damage: { min: bonusMin, max: bonusMax, expected: bonusExpected },
    attached: true,
    hitCapPolicy: "separate",
  };
  return {
    damage: {
      min: d.min + bonusMin,
      max: d.max + bonusMax,
      expected: d.expected + bonusExpected,
      capLoss: d.capLoss,
      critExpected: (d.critExpected ?? d.expected) + bonusExpected,
      critical: d.critical,
    },
    hitDetail: resolution.hitDetail,
    components: [...(resolution.components ?? []), component],
  };
}

/** Land one conjureAuto/poison: validate live summon, record, advance track, queue next. */
export function processSpiritEvent(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  const live = spiritEventLive(rt, event);
  if (!live) return;
  let resolution = event.resolve(rt, event.tick);
  // Bonus from already-active Haunted on auto and poison.
  resolution = attachHauntedToSpiritHit(rt, resolution, event.tick);
  if (
    live.kind === "auto" &&
    live.spirit.id === "vengeful_ghost" &&
    live.spirit.commanding &&
    (resolution.damage.max > 0 || resolution.damage.expected > 0)
  ) {
    // Cap uses commanding player ability damage (rt.input.base). Never from poison.
    rt.state = patchTarget(rt.state, {
      haunted: applyHaunted(event.tick, rt.input.base),
    });
  }
  let eligiblePoisonAtomIds: readonly number[] | undefined;
  if (live.kind === "poison" && rt.input.targetPoisonImmune === true) {
    const eligibleAtoms = rt.state.target.weaponPoison.atoms.filter(
      (atom) =>
        !isTargetPoisonImmune(
          rt.input.targetPoisonImmune,
          atom.immunityDisabledUntilTick,
          event.tick,
        ),
    );
    const atomIds = eligibleAtoms.map((atom) => atom.id);
    eligiblePoisonAtomIds = atomIds;
    const probability = eligibleAtoms.reduce((sum, atom) => sum + atom.probability, 0);
    recordConditionalPoisonDamage(
      rt,
      {
        ...event,
        expectedActivations: probability,
        expectedSeparateHits: probability,
      },
      resolution,
      atomIds,
    );
  } else {
    recordResolved(rt, event, resolution);
  }
  refreshPlayerPoisonImmunity(
    rt,
    event.tick,
    event.tick + envenomedPoisonImmunityDisableTicks(rt.input.league),
    1,
    eligiblePoisonAtomIds,
  );
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
