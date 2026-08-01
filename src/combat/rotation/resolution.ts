import type { CritLayers } from "../core/critical";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../data/sources";
import type { AbilityHit, AbilitySpec } from "../pipeline/calculateAbility";
import { calculateHit } from "../pipeline/calculateHit";
import { BERSERK_DAMAGE_MULTIPLIER } from "../styles/melee/bloodlust";
import { CHAOS_ROAR_DAMAGE_MULTIPLIER } from "../styles/melee/abilities";
import { deathsSwiftnessMultiplier } from "../styles/ranged/effects";
import {
  LIGHTNING_SURGE_BAND,
  lightningSurgeExpected,
  sunshineActive,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_SOURCE,
} from "../styles/magic/effects";
import { searingWindsBonusPct } from "../styles/ranged/onHit";
import type { CombatModifier, SourceReference } from "../types";
import type { ResolvedDamage, ScheduledEvent } from "./events";
import type { SimulationRuntime } from "./runtime";

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
 * Record one landed event: damage ledgers, tick/ability attribution, the owning
 * cast record, and the event log (provenance kept, resolve closure dropped).
 */
export function recordResolved(
  rt: SimulationRuntime,
  event: ScheduledEvent,
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
 * Per-landed-hit consumption hook (proc-eligible hits only). Stage 3 moves
 * next-hit melee effects (Fury / Greater Fury first-hit scope) here; today
 * they resolve at cast scope inside performCast, so this is intentionally inert.
 */
export function consumeNextHitEffects(rt: SimulationRuntime, _event: ScheduledEvent): void {
  void rt;
  // Stage 3 hook — see combat-sim "Event provenance and per-hit scope".
}

/**
 * Resolve one cast hit at its land tick: time-windowed globals (Berserk,
 * Death's Swiftness, Sunshine) read state at that tick; Chaos Roar and the
 * crit layers were captured cast-scope. Searing Winds is folded in as an
 * attached component of the source hit — never a separate event, so it cannot
 * inflate proc rolls, stacks, or hit counters.
 */
export function resolveCastHit(
  rt: SimulationRuntime,
  at: number,
  eventSeq: number,
  hitSpec: AbilityHit,
  ability: AbilitySpec,
  castSeq: number,
  critLayers: CritLayers,
  baseMods: CombatModifier[],
  chaosRoarActive: boolean,
): ResolvedDamage {
  const { input, state } = rt;
  const modifiers = [...baseMods];
  if (chaosRoarActive) {
    modifiers.push(
      buffMultiplier("buff:chaos_roar", CHAOS_ROAR_DAMAGE_MULTIPLIER, MODERNISATION_WIKI),
    );
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
  // DoT is not buffed by its own window; Galeshot does not ride its own Winds).
  if (
    ability.style === "magic" &&
    state.sunshine.grantedByCast !== castSeq &&
    sunshineActive(state.sunshine, at)
  ) {
    modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
  }
  const hit = calculateHit({
    base: input.base,
    band: hitSpec.band,
    level: input.level,
    accuracy: input.accuracy,
    crit: { ...critLayers, eligible: hitSpec.critEligible ?? true },
    modifiers,
    context: input.context,
    cap: input.cap,
  });
  rt.hitDetails.set(eventSeq, hit);
  let min = hit.min;
  let max = hit.max;
  let expected = hit.expected;
  if (ability.style === "ranged" && state.ranged.searingWinds.grantedByCast !== castSeq) {
    const bonusPct = searingWindsBonusPct(state.ranged.searingWinds, at);
    if (bonusPct > 0) {
      const bonus = calculateHit({
        base: input.base,
        band: { minPct: bonusPct, maxPct: bonusPct },
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
