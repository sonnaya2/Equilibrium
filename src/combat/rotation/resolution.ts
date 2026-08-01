import type { CritLayers } from "../core/critical";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../data/sources";
import type { AbilityHit, AbilitySpec } from "../pipeline/calculateAbility";
import { calculateHit } from "../pipeline/calculateHit";
import { BERSERK_DAMAGE_MULTIPLIER } from "../styles/melee/bloodlust";
import { CHAOS_ROAR_DAMAGE_MULTIPLIER } from "../styles/melee/abilities";
import { FURY_CRIT_CHANCE_BONUS } from "../styles/melee/effects";
import { deathsSwiftnessMultiplier } from "../styles/ranged/effects";
import {
  LIGHTNING_SURGE_BAND,
  lightningSurgeExpected,
  sunshineActive,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_SOURCE,
} from "../styles/magic/effects";
import {
  extendSearingWinds,
  onRangedHit,
  SEARING_WINDS_BONUS_HIT_PCT,
  shadowImbuedAdrenalinePerHit,
} from "../styles/ranged/onHit";
import {
  COMMAND_REQUIRES_CONJURE,
  CONJURE_DAMAGE_POTENTIAL,
  conjureEligibleModifiers,
  skeletonCommandHitLanded,
  skeletonRageMult,
} from "../styles/necromancy/conjures";
import type { CombatModifier, SourceReference } from "../types";
import type { ResolvedDamage, ScheduledEvent } from "./events";
import type { SimulationRuntime } from "./runtime";
import { gainAdrenaline, patchRanged } from "./state";

/** Applies flat buffs at onCast so intermediate rounding follows stage order. */
function buffMultiplier(id: string, multiplier: number, source: SourceReference): CombatModifier {
  return {
    id,
    stage: "onCast",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source,
  };
}

/**
 * What a cast captured at cast time for its scheduled hits. Time-windowed
 * globals (Berserk, Swiftness, Sunshine) are NOT here — they read state at the
 * land tick. Next-hit buffs, empowerment, and Searing Winds eligibility are
 * cast-scope per their sourced mechanics, so they live in the snapshot.
 */
export interface CastSnapshot {
  /** Owning cast sequence — buff-granting casts exclude their own hits. */
  castSeq: number;
  critLayers: CritLayers;
  baseMods: CombatModifier[];
  /** Chaos Roar ×1.75: channels on the first hit only; non-channels on all hits. */
  chaosRoarActive: boolean;
  channelled: boolean;
  /** Greater Fury: first crit-eligible non-bleed hit is a guaranteed crit. */
  greaterFuryActive: boolean;
  /** Fury: first crit-eligible non-bleed hit gains +25% crit chance. */
  furyActive: boolean;
  firstEligibleHitIndex: number;
  /** Bloodlust missing-LP multiplier for Flurry / Greater Flurry (1 = none). */
  empowerMult: number;
  /** Searing Winds was active at cast — every hit carries the attached bonus. */
  searingWindsAtCast: boolean;
}

/**
 * Record one landed event: damage ledgers, tick/ability attribution, the owning
 * cast record, and the event log (provenance kept, resolve closure dropped).
 */
export function recordResolved(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  rt.totalMin += damage.min;
  rt.totalMax += damage.max;
  rt.totalExpected += damage.expected;
  rt.damageByTick[event.tick] = (rt.damageByTick[event.tick] ?? 0) + damage.expected;
  rt.perAbility[event.abilityId] = (rt.perAbility[event.abilityId] ?? 0) + damage.expected;
  rt.endTick = Math.max(rt.endTick, event.tick + 1);
  if (event.sourceCast >= 0) {
    const record = rt.recordBySeq.get(event.sourceCast);
    if (record) {
      record.result.expected += damage.expected;
      if (event.family !== "proc" && !event.attached) {
        record.result.min += damage.min;
        record.result.max += damage.max;
        const detail = rt.hitDetails.get(event.seq);
        if (detail) record.result.hits.push(detail);
      }
    }
  }
  const { resolve: _resolve, ...provenance } = event;
  rt.events.push({ ...provenance, damage });
  if (event.procEligible && !event.attached) consumeNextHitEffects(rt, event);
}

/**
 * Per-landed-hit state effects for real (proc-eligible, non-attached) hits.
 * Attached damage, conjure autos, poison, and proc events never reach this —
 * one real hit is one stack roll / one adrenaline grant / one extension.
 */
export function consumeNextHitEffects(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  const ability = rt.byId.get(event.abilityId);
  // Skeleton command hits build one rage stack each (damage resolved first).
  if (event.family === "command" && event.abilityId === "command_skeleton_warrior") {
    const spirit = rt.state.conjures.spirits.find((s) => s.id === "skeleton_warrior");
    if (spirit) {
      rt.state = {
        ...rt.state,
        conjures: {
          spirits: rt.state.conjures.spirits.map((s) =>
            s === spirit ? skeletonCommandHitLanded(s) : s,
          ),
        },
      };
    }
    return;
  }
  if (ability?.style !== "ranged") return;
  // Deathspore: every landed ranged hit builds a stack (its own cooldown gate).
  if (rt.input.ammo === "deathspore") {
    rt.state = patchRanged(rt.state, {
      deathspore: onRangedHit(rt.state.ranged.deathspore, event.tick),
    });
  }
  const perHit = shadowImbuedAdrenalinePerHit(rt.state.ranged.shadowImbued, event.tick);
  if (perHit > 0) rt.state = gainAdrenaline(rt.state, perHit);
  // Rapid Fire: each landed hit extends an active Searing Winds by 1 tick (wiki).
  if (
    ability.id === "rapid_fire" &&
    event.tick < rt.state.ranged.searingWinds.expiresAtTick
  ) {
    rt.state = patchRanged(rt.state, {
      searingWinds: extendSearingWinds(rt.state.ranged.searingWinds, 1),
    });
  }
}

/**
 * Resolve one cast hit at its land tick: time-windowed globals (Berserk,
 * Death's Swiftness, Sunshine) read state at that tick; the cast snapshot
 * carries next-hit crit layers (first eligible hit only), Chaos Roar's
 * channel rule, empowerment, and Searing Winds' cast-time eligibility. The
 * Searing Winds bonus is an attached component of the source hit — never a
 * separate event, so it cannot inflate proc rolls, stacks, or hit counters.
 */
export function resolveCastHit(
  rt: SimulationRuntime,
  at: number,
  eventSeq: number,
  hitSpec: AbilityHit,
  hitIndex: number,
  ability: AbilitySpec,
  snap: CastSnapshot,
): ResolvedDamage {
  const { input, state } = rt;
  const modifiers = [...snap.baseMods];
  if (snap.chaosRoarActive && (!snap.channelled || hitIndex === 0)) {
    modifiers.push(
      buffMultiplier("buff:chaos_roar", CHAOS_ROAR_DAMAGE_MULTIPLIER, MODERNISATION_WIKI),
    );
  }
  if (snap.empowerMult !== 1) {
    modifiers.push(buffMultiplier("buff:bloodlust_flurry", snap.empowerMult, MODERNISATION_WIKI));
  }
  if (ability.style === "melee" && at < state.berserkUntilTick) {
    modifiers.push(
      buffMultiplier("buff:berserk", BERSERK_DAMAGE_MULTIPLIER, MODERNISATION_PATCH_2),
    );
  }
  if (ability.style === "ranged") {
    const mult = deathsSwiftnessMultiplier(state.ranged.swiftness, at);
    if (mult !== 1) {
      modifiers.push(buffMultiplier("buff:deaths_swiftness", mult, MODERNISATION_WIKI));
    }
  }
  // A buff-granting cast's own hits predate its buff (wiki: the Sunshine beam
  // DoT is not buffed by its own window).
  if (
    ability.style === "magic" &&
    state.sunshine.grantedByCast !== snap.castSeq &&
    sunshineActive(state.sunshine, at)
  ) {
    modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
  }
  const firstEligible = hitIndex === snap.firstEligibleHitIndex;
  const crit: CritLayers = {
    ...snap.critLayers,
    eligible: hitSpec.critEligible ?? true,
    chance:
      snap.critLayers.chance + (firstEligible && snap.furyActive ? FURY_CRIT_CHANCE_BONUS : 0),
    guaranteed:
      snap.critLayers.guaranteed || (firstEligible && snap.greaterFuryActive),
  };
  // Command abilities are part of the conjure: full Damage Potential, the
  // conjure-eligible modifier set (never prayers), and for the skeleton the
  // live rage multiplier at the land tick (wiki, verified 2026-07-31).
  const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
  let band = hitSpec.band;
  if (ability.id === "command_skeleton_warrior") {
    const spirit = state.conjures.spirits.find((s) => s.id === "skeleton_warrior");
    const mult = skeletonRageMult(spirit?.rageStacks ?? 0);
    if (mult !== 1) band = { minPct: band.minPct * mult, maxPct: band.maxPct * mult };
  }
  const hit = calculateHit({
    base: input.base,
    band,
    level: input.level,
    accuracy: isCommand ? CONJURE_DAMAGE_POTENTIAL : input.accuracy,
    crit,
    modifiers: isCommand ? conjureEligibleModifiers(modifiers) : modifiers,
    context: input.context,
    cap: input.cap,
  });
  rt.hitDetails.set(eventSeq, hit);
  let min = hit.min;
  let max = hit.max;
  let expected = hit.expected;
  if (snap.searingWindsAtCast) {
    const bonus = calculateHit({
      base: input.base,
      band: { minPct: SEARING_WINDS_BONUS_HIT_PCT, maxPct: SEARING_WINDS_BONUS_HIT_PCT },
      level: input.level,
      accuracy: input.accuracy,
      crit: { chance: 0, eligible: false },
      modifiers,
      context: input.context,
      cap: input.cap,
    });
    min += bonus.min;
    max += bonus.max;
    expected += bonus.expected;
  }
  return { min, max, expected, critExpected: (hit.critMin + hit.critMax) / 2 };
}

/**
 * Resolve an Instability Lightning Surge proc at its own land tick: EV = the
 * source hit's crit chance (from its landed detail) × the surge hit's expected,
 * recomputed against land-time state. min/max stay 0 — the surge is EV-only.
 */
export function resolveLightningSurge(
  rt: SimulationRuntime,
  at: number,
  sourceSeq: number,
  castSeq: number,
  critLayers: CritLayers,
  baseMods: CombatModifier[],
): ResolvedDamage {
  const { input, state } = rt;
  const sourceCritChance = rt.hitDetails.get(sourceSeq)?.critChance ?? 0;
  if (sourceCritChance <= 0) return { min: 0, max: 0, expected: 0 };
  const modifiers = [...baseMods];
  if (state.sunshine.grantedByCast !== castSeq && sunshineActive(state.sunshine, at)) {
    modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
  }
  const surgeHit = calculateHit({
    base: input.base,
    band: LIGHTNING_SURGE_BAND,
    level: input.level,
    accuracy: input.accuracy,
    crit: { ...critLayers, eligible: true },
    modifiers,
    context: input.context,
    cap: input.cap,
  });
  return {
    min: 0,
    max: 0,
    expected: lightningSurgeExpected(sourceCritChance, surgeHit.expected),
  };
}
