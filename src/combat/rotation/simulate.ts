import type { CritLayers } from "../core/critical";
import { critProbability } from "../core/critical";
import type { HitCapRule } from "../core/hitCaps";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../data/sources";
import type { AbilityHit, AbilityResult, AbilitySpec } from "../pipeline/calculateAbility";
import { calculateHit, type HitResult } from "../pipeline/calculateHit";
import {
  activateBerserk,
  BERSERK_DAMAGE_MULTIPLIER,
  BERSERK_DURATION_SECONDS,
  endBerserk,
} from "../styles/melee/bloodlust";
import {
  CHAOS_ROAR_DAMAGE_MULTIPLIER,
  CHAOS_ROAR_DURATION_SECONDS,
  isMeleeAbility,
} from "../styles/melee/abilities";
import {
  FURY_CRIT_CHANCE_BONUS,
  GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS,
  GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS,
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
  greaterBargeIdleBand,
  METEOR_STRIKE_BASIC_ADREN_MULTIPLIER,
  METEOR_STRIKE_DURATION_SECONDS,
  METEOR_STRIKE_PASSIVE_ADREN_PER_TICK,
} from "../styles/melee/effects";
import { activateDeathsSwiftness, deathsSwiftnessMultiplier } from "../styles/ranged/effects";
import {
  activateInstability,
  activateSunshine,
  instabilityActive,
  LIGHTNING_SURGE_BAND,
  LIGHTNING_SURGE_TICK_DELAY,
  lightningSurgeExpected,
  sunshineActive,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_SOURCE,
} from "../styles/magic/effects";
import {
  activateSearingWinds,
  activateShadowImbued,
  deathsporeReady,
  extendShadowImbued,
  onRangedHit,
  searingWindsBonusPct,
  shadowImbuedAdrenalinePerHit,
  spendDeathspore,
} from "../styles/ranged/onHit";
import {
  activateRunicCharge,
  animaCharged,
  consumeAnima,
  runicChargeReady,
} from "../styles/magic/runicCharge";
import { isMagicAbility } from "../styles/magic/abilities";
import {
  applyNecroOnCast,
  deathSkullsCooldownTicks,
  necroAdrenalineCost,
  necroCanCast,
  resolveNecromancyAbility,
} from "../styles/necromancy/effects";
import {
  COMMAND_REQUIRES_CONJURE,
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
  type ConjureId,
} from "../styles/necromancy/conjures";
import { expectedAftershockDamage, expectedCracklingDamage } from "../shared/perks";
import type { CombatContext, CombatModifier, SourceReference } from "../types";
import type { RotationAction } from "./actions";
import { EventQueue, type ResolvedDamage, type ResolvedEvent, type ScheduledEvent } from "./events";
import {
  clearCooldowns,
  firstLegalTick,
  gainAdrenaline,
  gainMeleeBloodlust,
  newRotationState,
  patchRanged,
  spendAdrenaline,
  startCooldown,
  type RotationState,
} from "./state";
import { GLOBAL_COOLDOWN_TICKS, secondsToTicks, TICK_SECONDS } from "./timeline";

export interface AdrenalineRules {
  basicGainMultiplier?: number;
  impatientExpectedExtra?: number;
  relentlessRefundChance?: number;
}

export interface ProcRules {
  cracklingRank?: number;
  aftershockRank?: number;
}

export interface SimulateInput {
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  abilities: readonly AbilitySpec[];
  rotation: readonly RotationAction[];
  modifiers?: CombatModifier[] | ((ability: AbilitySpec) => CombatModifier[]);
  context?: CombatContext;
  cap?: HitCapRule;
  /** Puncture damage is outside the current model. */
  ammo?: "deathspore" | "splintering";
  /** Weave the style auto-attack through idle GCDs and adrenaline shortfalls. */
  autoWeave?: boolean;
  adrenaline?: AdrenalineRules;
  /**
   * Planted Feet: base Sunshine / Death's Swiftness duration ×1.25 (→ 63 ticks).
   * Does not apply to greater variants.
   */
  plantedFeet?: boolean;
  procs?: ProcRules;
  /**
   * Mult on conjure spirit *basic autos* only (not putrid poison, not commands).
   * First Necromancer set: firstNecromancerConjureDamageMult(pieces). Default 1.
   */
  conjureBasicDamageMult?: number;
}

export interface SimulateOptions {
  /**
   * Also compute `totalExpectedIncludingTails`: in-horizon damage plus the
   * still-scheduled (unlanded) tails of casts begun inside the horizon.
   */
  includeTails?: boolean;
}

export interface CastRecord {
  tick: number;
  abilityId: string;
  result: AbilityResult;
  adrenalineAfter: number;
  /** Woven basic-attack cast, not part of the queued rotation. */
  auto?: boolean;
}

export interface RotationSummary {
  ok: boolean;
  error?: string;
  casts: CastRecord[];
  /** Elapsed ticks: last cast's occupancy end, or the damage tail if it outlasts it. */
  ticks: number;
  /**
   * Horizon the run was asked to fill (revolution duration). When set, totals
   * count only events landing before it (half-open [0, horizonTicks)) and
   * `dps` is totalExpected / (horizonTicks * tickSeconds).
   */
  horizonTicks?: number;
  totalMin: number;
  totalMax: number;
  totalExpected: number;
  dps: number;
  perAbility: Record<string, number>;
  /** Expected damage landing on each tick — DoT tails land on their sourced ticks. */
  damageByTick: Record<number, number>;
  /** Every landed event in (tick, seq) order, with provenance and land-time damage. */
  events: ResolvedEvent[];
  /**
   * Opt-in second metric (SimulateOptions.includeTails): in-horizon damage plus
   * the unlanded scheduled tails of casts begun inside the horizon.
   * Never presented as fixed-window DPS.
   */
  totalExpectedIncludingTails?: number;
}

export type CastAttempt = { ok: true } | { ok: false; error: string };

const EMPTY_RESULT: AbilityResult = { hits: [], min: 0, max: 0, expected: 0, adrenalineDelta: 0 };

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

export interface CastContext {
  getState(): RotationState;
  costOf(ability: AbilitySpec): number;
  firstLegalTick(abilityId: string): number;
  /**
   * The one canonical time path: lands every queued event due by targetTick in
   * (tick, seq) order (damage resolved against state at each land tick), applies
   * passive generation over the crossed interval, expires crossed clocks, and
   * stops with state representing exactly targetTick.
   */
  advanceTo(targetTick: number): void;
  /**
   * One atomic cast transition: advance to the candidate tick, re-check
   * requirements/affordability against the advanced state (rejection leaves the
   * state otherwise untouched), resolve the empowered variant, start the
   * cooldown and occupancy, schedule hit events with provenance, then apply
   * immediate on-cast grants/windows.
   */
  performCast(ability: AbilitySpec, readyTick: number, auto: boolean): CastAttempt;
  /** Off-GCD utility casts (Runic Charge): state-machine update and a cast record
   *  without consuming or advancing the global cooldown. */
  performOffGcdCast(ability: AbilitySpec): void;
  /** Remove a cast's pending events (channel cancellation); returns the count. */
  cancelCastEvents(castSeq: number): number;
  finish(error?: string, horizonTicks?: number, options?: SimulateOptions): RotationSummary;
  byId: Map<string, AbilitySpec>;
  basicByStyle: Map<AbilitySpec["style"], AbilitySpec>;
}

export function createCastContext(
  input: Omit<SimulateInput, "rotation" | "autoWeave"> & { horizonTicks?: number },
): CastContext {
  const byId = new Map(input.abilities.map((a) => [a.id, a]));
  const basicByStyle = new Map(
    input.abilities.filter((a) => a.autoAttack).map((a) => [a.style, a]),
  );
  /** Runs with a horizon land events only before it (half-open). */
  const horizon = input.horizonTicks;
  const casts: CastRecord[] = [];
  const perAbility: Record<string, number> = {};
  const damageByTick: Record<number, number> = {};
  const events: ResolvedEvent[] = [];
  const queue = new EventQueue();
  const recordBySeq = new Map<number, CastRecord>();
  /** Full hit detail per landed hit event, keyed by event seq (cast records, surge EV). */
  const hitDetails = new Map<number, HitResult>();
  /** Spirit event identity: a pending auto/poison event is live only for its summon instance. */
  const spiritEventMeta = new Map<number, { id: ConjureId; untilTick: number; kind: "auto" | "poison" }>();
  const scheduledSpiritTracks = new Set<string>();
  const spiritHitCounts = new Map<string, number>();
  let state = newRotationState();
  let endTick = 0;
  let totalMin = 0;
  let totalMax = 0;
  let totalExpected = 0;
  let nextSeq = 0;
  let nextCastSeq = 0;

  const withinHorizon = (tick: number): boolean => horizon == null || tick < horizon;

  function schedule(event: Omit<ScheduledEvent, "seq">): number {
    const seq = nextSeq++;
    queue.push({ ...event, seq });
    return seq;
  }

  function recordResolved(event: ScheduledEvent, damage: ResolvedDamage): void {
    totalMin += damage.min;
    totalMax += damage.max;
    totalExpected += damage.expected;
    damageByTick[event.tick] = (damageByTick[event.tick] ?? 0) + damage.expected;
    perAbility[event.abilityId] = (perAbility[event.abilityId] ?? 0) + damage.expected;
    endTick = Math.max(endTick, event.tick + 1);
    if (event.sourceCast >= 0) {
      const record = recordBySeq.get(event.sourceCast);
      if (record) {
        record.result.expected += damage.expected;
        if (event.family !== "proc" && !event.attached) {
          record.result.min += damage.min;
          record.result.max += damage.max;
          const detail = hitDetails.get(event.seq);
          if (detail) record.result.hits.push(detail);
        }
      }
    }
    const { resolve: _resolve, ...provenance } = event;
    events.push({ ...provenance, damage });
    if (event.procEligible && !event.attached) consumeNextHitEffects(event);
  }

  /**
   * Per-landed-hit consumption hook (proc-eligible hits only). Stage 3 moves
   * next-hit melee effects (Fury / Greater Fury first-hit scope) here; today
   * they resolve at cast scope inside performCast, so this is intentionally inert.
   */
  function consumeNextHitEffects(_event: ScheduledEvent): void {
    // Stage 3 hook — see combat-sim "Event provenance and per-hit scope".
  }

  function spiritEventLive(
    event: ScheduledEvent,
  ): { spirit: ActiveConjure; kind: "auto" | "poison" } | null {
    const meta = spiritEventMeta.get(event.seq);
    if (!meta) return null;
    const spirit = state.conjures.spirits.find(
      (s) => s.id === meta.id && s.untilTick === meta.untilTick,
    );
    if (!spirit) return null; // dismissed, or replaced by a re-summon
    if (meta.kind === "auto" && event.tick >= spirit.untilTick) return null;
    return { spirit, kind: meta.kind };
  }

  function patchSpirit(target: ActiveConjure, next: ActiveConjure): void {
    state = {
      ...state,
      conjures: {
        spirits: state.conjures.spirits.map((s) => (s === target ? next : s)),
      },
    };
  }

  function scheduleSpiritAuto(spirit: ActiveConjure): void {
    const key = `${spirit.id}:${spirit.untilTick}:auto`;
    const seq = schedule({
      tick: spirit.nextAutoTick,
      family: "conjureAuto",
      abilityId: SPIRIT_AUTO_ABILITY_ID[spirit.id],
      sourceCast: -1,
      hitIndex: spiritHitCounts.get(key) ?? 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      resolve: (at) => {
        // Spirit-internal mult (skeleton rage) stays on the band; the First Necro
        // set mult is post-hit damage so intermediate AD rounding does not distort
        // the exact +7%/piece ratio (wiki: conjure basics only).
        const profile = spiritAutoProfile(spirit.id);
        const live = state.conjures.spirits.find(
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
    spiritHitCounts.set(key, (spiritHitCounts.get(key) ?? 0) + 1);
    spiritEventMeta.set(seq, { id: spirit.id, untilTick: spirit.untilTick, kind: "auto" });
  }

  function scheduleSpiritPoison(spirit: ActiveConjure): void {
    const key = `${spirit.id}:${spirit.untilTick}:poison`;
    const seq = schedule({
      tick: spirit.nextPoisonTick,
      family: "poison",
      abilityId: SPIRIT_POISON_ABILITY_ID,
      sourceCast: -1,
      hitIndex: spiritHitCounts.get(key) ?? 0,
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
    spiritHitCounts.set(key, (spiritHitCounts.get(key) ?? 0) + 1);
    spiritEventMeta.set(seq, { id: spirit.id, untilTick: spirit.untilTick, kind: "poison" });
  }

  /** Schedule this summon instance's pending tracks exactly once. */
  function scheduleSpiritTracks(spirit: ActiveConjure): void {
    const key = `${spirit.id}:${spirit.untilTick}`;
    if (scheduledSpiritTracks.has(key)) return;
    scheduledSpiritTracks.add(key);
    if (spiritAutoPending(spirit) && withinHorizon(spirit.nextAutoTick)) {
      scheduleSpiritAuto(spirit);
    }
    if (spiritPoisonPending(spirit) && withinHorizon(spirit.nextPoisonTick)) {
      scheduleSpiritPoison(spirit);
    }
  }

  function processDueEvents(bound: number): void {
    for (;;) {
      const event = queue.peek();
      if (!event || event.tick > bound) return;
      queue.shift();
      if (event.family === "conjureAuto" || event.family === "poison") {
        const live = spiritEventLive(event);
        if (!live) continue; // spirit dismissed or re-summoned: the event dies
        recordResolved(event, event.resolve(event.tick));
        const next =
          live.kind === "auto" ? spiritAutoFired(live.spirit) : spiritPoisonFired(live.spirit);
        patchSpirit(live.spirit, next);
        if (live.kind === "auto" && spiritAutoPending(next) && withinHorizon(next.nextAutoTick)) {
          scheduleSpiritAuto(next);
        }
        if (
          live.kind === "poison" &&
          spiritPoisonPending(next) &&
          withinHorizon(next.nextPoisonTick)
        ) {
          scheduleSpiritPoison(next);
        }
        continue;
      }
      recordResolved(event, event.resolve(event.tick));
    }
  }

  function grantMeteorPassive(fromTick: number, toTickExclusive: number): void {
    if (state.meteorStrikeUntilTick <= 0 || toTickExclusive <= fromTick) return;
    let gain = 0;
    const end = Math.min(toTickExclusive, state.meteorStrikeUntilTick);
    for (let t = fromTick; t < end; t++) gain += METEOR_STRIKE_PASSIVE_ADREN_PER_TICK;
    if (gain > 0) state = gainAdrenaline(state, gain);
  }

  function advanceTo(targetTick: number): void {
    if (targetTick < state.tick) return;
    // A horizon run never lands events at or after the horizon (half-open).
    processDueEvents(horizon != null ? Math.min(targetTick, horizon - 1) : targetTick);
    grantMeteorPassive(state.tick, targetTick);
    if (state.melee.berserk && targetTick >= state.berserkUntilTick) {
      state = { ...state, melee: endBerserk(state.melee), berserkUntilTick: 0 };
    }
    if (targetTick > state.tick) state = { ...state, tick: targetTick };
  }

  function finish(
    error?: string,
    horizonTicks?: number,
    options?: SimulateOptions,
  ): RotationSummary {
    const effectiveHorizon = horizonTicks ?? horizon;
    if (effectiveHorizon != null && effectiveHorizon > 0) {
      advanceTo(effectiveHorizon - 1);
      if (state.tick < effectiveHorizon) state = { ...state, tick: effectiveHorizon };
    } else {
      // No horizon: land every scheduled event through the natural end.
      while (queue.length > 0) advanceTo(queue.maxTick());
    }

    // Ability + spirit damage only — Aftershock thresholds on this, not on procs.
    const abilityExpected = totalExpected;
    const denomTicks = effectiveHorizon != null && effectiveHorizon > 0 ? effectiveHorizon : endTick;
    const seconds = denomTicks * TICK_SECONDS;

    // Crackling: continuous EV ≈ fraction * base * (H / 60). Mid-horizon tick for chart.
    const crackling = expectedCracklingDamage(input.procs?.cracklingRank ?? 0, input.base, seconds);
    if (crackling > 0) {
      totalExpected += crackling;
      perAbility.crackling = (perAbility.crackling ?? 0) + crackling;
      const landTick = Math.max(0, Math.floor(denomTicks / 2));
      damageByTick[landTick] = (damageByTick[landTick] ?? 0) + crackling;
    }
    // Aftershock: floor(abilityDmg/50k) capped by H/6s; hit = 0.318 * rank * base (PvM avg).
    const aftershock = expectedAftershockDamage(
      input.procs?.aftershockRank ?? 0,
      input.base,
      abilityExpected,
      seconds,
    );
    if (aftershock > 0) {
      totalExpected += aftershock;
      perAbility.aftershock = (perAbility.aftershock ?? 0) + aftershock;
      const landTick = Math.max(0, Math.floor(denomTicks / 2));
      damageByTick[landTick] = (damageByTick[landTick] ?? 0) + aftershock;
    }

    let totalExpectedIncludingTails: number | undefined;
    if (options?.includeTails) {
      let tails = totalExpected;
      for (const event of queue.pending()) tails += event.resolve(event.tick).expected;
      totalExpectedIncludingTails = tails;
    }

    return {
      ok: error === undefined,
      error,
      casts,
      ticks: endTick,
      ...(effectiveHorizon != null && effectiveHorizon > 0
        ? { horizonTicks: effectiveHorizon }
        : {}),
      totalMin,
      totalMax,
      totalExpected,
      dps: seconds > 0 ? totalExpected / seconds : 0,
      perAbility,
      damageByTick,
      events,
      ...(totalExpectedIncludingTails !== undefined ? { totalExpectedIncludingTails } : {}),
    };
  }

  function costOf(ability: AbilitySpec): number {
    if (ability.style === "necromancy") {
      return necroAdrenalineCost(ability, state.necro, state.tick);
    }
    const listed = ability.adrenaline?.cost ?? 0;
    return listed > 0 &&
      ability.style === "ranged" &&
      input.ammo === "deathspore" &&
      deathsporeReady(state.ranged.deathspore)
      ? 0
      : listed;
  }

  function performCast(ability: AbilitySpec, readyTick: number, auto: boolean): CastAttempt {
    const candidate = Math.max(readyTick, state.tick);
    advanceTo(candidate);

    // Requirements and affordability against the ADVANCED state — waiting may
    // have generated adrenaline or expired a lockout. A rejection mutates nothing
    // beyond the canonical time advance.
    if (isMagicAbility(ability) && ability.requiresAnima && !animaCharged(state.magic, candidate)) {
      return {
        ok: false,
        error: `${ability.id} requires an active Runic Charge at tick ${candidate}`,
      };
    }
    if (!necroCanCast(ability, state.necro, state.conjures, candidate)) {
      return {
        ok: false,
        error: `${ability.id} needs residual souls or an active conjure, ${state.necro.residualSouls} souls available at tick ${candidate}`,
      };
    }
    const cost = costOf(ability);
    if (cost > state.adrenaline) {
      return {
        ok: false,
        error: `${ability.id} needs ${cost}% adrenaline, ${state.adrenaline}% available at tick ${candidate}`,
      };
    }

    // Empowered variant resolution (and its resource reads) in this transition.
    const melee = isMeleeAbility(ability) ? ability : null;
    const bloodlustBand =
      melee?.bloodlustScale && state.melee.stacks >= melee.bloodlustScale.threshold
        ? melee.bloodlustScale.band
        : null;
    let working: AbilitySpec = bloodlustBand
      ? { ...ability, hits: ability.hits.map((hit) => ({ ...hit, band: bloodlustBand })) }
      : ability;
    if (ability.style === "necromancy") {
      working = resolveNecromancyAbility(working, state.necro, candidate);
    }
    const meleeIdleTicks =
      ability.style === "melee" && working.hits.length > 0 && state.lastMeleeCastTick >= 0
        ? candidate - state.lastMeleeCastTick
        : 0;
    if (ability.id === "greater_barge" && working.hits.length > 0) {
      working = {
        ...working,
        hits: working.hits.map((h) => ({
          ...h,
          band: greaterBargeIdleBand(h.band.minPct, h.band.maxPct, meleeIdleTicks),
        })),
      };
      if (meleeIdleTicks >= GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS) {
        state = {
          ...state,
          endlessAssaultUntilTick:
            candidate + secondsToTicks(GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS),
        };
      }
    }
    if (
      melee?.channelled &&
      working.hits.length > 0 &&
      state.endlessAssaultUntilTick > 0 &&
      candidate < state.endlessAssaultUntilTick
    ) {
      state = { ...state, endlessAssaultUntilTick: 0 };
    }

    // Cast-scope buffs this cast consumes (Chaos Roar empowerment, Fury crit
    // layers) — captured for the cast's events; windows below resolve at land tick.
    const chaosRoarActive =
      ability.style === "melee" &&
      working.hits.length > 0 &&
      state.chaosRoarUntilTick > 0 &&
      candidate < state.chaosRoarUntilTick;
    if (chaosRoarActive) state = { ...state, chaosRoarUntilTick: 0 };
    const furyCrit =
      ability.style === "melee" &&
      state.greaterFuryCrit &&
      working.hits.some((h) => h.critEligible !== false);
    if (furyCrit) state = { ...state, greaterFuryCrit: false };
    const furyBonus =
      ability.style === "melee" &&
      state.furyCritBonus &&
      working.hits.some((h) => h.critEligible !== false);
    if (furyBonus) state = { ...state, furyCritBonus: false };
    const critLayers = {
      ...input.crit,
      chance: input.crit.chance + (furyBonus ? FURY_CRIT_CHANCE_BONUS : 0),
      guaranteed: furyCrit || ability.guaranteedCrit || input.crit.guaranteed,
    };
    const baseMods =
      typeof input.modifiers === "function" ? input.modifiers(ability) : (input.modifiers ?? []);

    if (ability.cooldownSeconds) {
      const cdTicks =
        ability.id === "death_skulls"
          ? deathSkullsCooldownTicks(state.necro, candidate)
          : secondsToTicks(ability.cooldownSeconds);
      state = startCooldown(state, ability.id, cdTicks);
    }

    const castSeq = nextCastSeq++;
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
    recordBySeq.set(castSeq, record);

    const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
    const hitSeqs: number[] = [];
    working.hits.forEach((hitSpec: AbilityHit, hitIndex: number) => {
      const seq = nextSeq++;
      hitSeqs.push(seq);
      queue.push({
        tick: candidate + (hitSpec.tickOffset ?? 0),
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
        resolve: (at) =>
          resolveCastHit(at, seq, hitSpec, ability, castSeq, critLayers, baseMods, chaosRoarActive),
      });
    });

    // Instability: Lightning Surge on Magic crits while the buff is active. The
    // granting cast's own hits predate the buff and never fire a surge (checked
    // here at cast time, before the grant below). Surge damage resolves at its
    // own land tick from the source hit's crit chance.
    if (ability.style === "magic" && working.hits.length > 0 && instabilityActive(state.instability, candidate)) {
      working.hits.forEach((hitSpec, hitIndex) => {
        if (hitSpec.critEligible === false) return;
        if (critProbability({ ...critLayers, eligible: true }) <= 0) return;
        const sourceSeq = hitSeqs[hitIndex]!;
        schedule({
          tick: candidate + (hitSpec.tickOffset ?? 0) + LIGHTNING_SURGE_TICK_DELAY,
          family: "proc",
          abilityId: ability.id,
          sourceCast: castSeq,
          hitIndex,
          attached: false,
          procEligible: false,
          recursionAllowed: false,
          cancelOwner: castSeq,
          resolve: (at) => {
            const sourceCritChance = hitDetails.get(sourceSeq)?.critChance ?? 0;
            if (sourceCritChance <= 0) return { min: 0, max: 0, expected: 0 };
            const modifiers = [...baseMods];
            if (state.sunshine.grantedByCast !== castSeq && sunshineActive(state.sunshine, at)) {
              modifiers.push(
                buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE),
              );
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
          },
        });
      });
    }

    // Immediate on-cast grants/windows in their sourced order.
    if (ability.adrenaline?.gain) {
      const isBasic = ability.category === "basic" || !!ability.autoAttack;
      const meteorBasic =
        ability.style === "melee" &&
        ability.category === "basic" &&
        state.meteorStrikeUntilTick > 0 &&
        candidate < state.meteorStrikeUntilTick;
      let gain = meteorBasic
        ? ability.adrenaline.gain * METEOR_STRIKE_BASIC_ADREN_MULTIPLIER
        : ability.adrenaline.gain;
      if (isBasic) {
        gain *= input.adrenaline?.basicGainMultiplier ?? 1;
        gain += input.adrenaline?.impatientExpectedExtra ?? 0;
      }
      state = gainAdrenaline(state, gain);
    }
    if (cost) {
      state = spendAdrenaline(state, cost);
      const relentlessChance = input.adrenaline?.relentlessRefundChance ?? 0;
      if (relentlessChance > 0) {
        state = gainAdrenaline(state, cost * relentlessChance);
      }
    }
    if (
      cost === 0 &&
      (ability.adrenaline?.cost ?? 0) > 0 &&
      ability.style === "ranged" &&
      input.ammo === "deathspore"
    ) {
      state = patchRanged(state, { deathspore: spendDeathspore(state.ranged.deathspore) });
    }
    if (melee?.bloodlustGain) {
      state = gainMeleeBloodlust(state, melee.bloodlustGain);
    }

    if (ability.style === "necromancy") {
      const patch = applyNecroOnCast(state.necro, ability, candidate, state.conjures);
      state = {
        ...state,
        necro: patch.necro,
        ...(patch.conjures ? { conjures: patch.conjures } : {}),
      };
      if (patch.adrenalineBonus) state = gainAdrenaline(state, patch.adrenalineBonus);
      state = clearCooldowns(state, patch.clearCooldownIds);
      for (const spirit of state.conjures.spirits) scheduleSpiritTracks(spirit);
    }

    if (ability.stateEffect === "berserk") {
      state = {
        ...state,
        melee: activateBerserk(state.melee),
        berserkUntilTick: candidate + secondsToTicks(BERSERK_DURATION_SECONDS),
      };
    } else if (ability.stateEffect === "deaths_swiftness") {
      state = patchRanged(state, {
        swiftness: activateDeathsSwiftness(candidate, false, input.plantedFeet === true),
      });
    } else if (ability.stateEffect === "greater_deaths_swiftness") {
      state = patchRanged(state, { swiftness: activateDeathsSwiftness(candidate, true) });
    } else if (ability.stateEffect === "shadow_imbued") {
      state = patchRanged(state, { shadowImbued: activateShadowImbued(candidate) });
    }
    if (ability.appliesEffect === "searing_winds") {
      state = patchRanged(state, { searingWinds: activateSearingWinds(candidate, castSeq) });
    }
    if (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") {
      const greater = ability.appliesEffect === "greater_sunshine";
      state = {
        ...state,
        sunshine: activateSunshine(candidate, greater, !greater && input.plantedFeet === true, castSeq),
      };
    }
    if (ability.appliesEffect === "instability") {
      state = { ...state, instability: activateInstability(candidate) };
    }
    if (ability.appliesEffect === "chaos_roar") {
      state = {
        ...state,
        chaosRoarUntilTick: candidate + secondsToTicks(CHAOS_ROAR_DURATION_SECONDS),
      };
    }
    if (ability.appliesEffect === "greater_fury") {
      state = { ...state, greaterFuryCrit: true };
    }
    if (ability.appliesEffect === "fury") {
      state = { ...state, furyCritBonus: true };
    }
    if (ability.appliesEffect === "meteor_strike") {
      state = {
        ...state,
        meteorStrikeUntilTick: candidate + secondsToTicks(METEOR_STRIKE_DURATION_SECONDS),
      };
    }
    if (
      ability.appliesEffect === "greater_flurry" &&
      state.melee.berserk &&
      candidate < state.berserkUntilTick
    ) {
      const extendTicks =
        working.hits.length * secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS);
      state = { ...state, berserkUntilTick: state.berserkUntilTick + extendTicks };
    }

    if (ability.style === "melee" && working.hits.length > 0) {
      state = { ...state, lastMeleeCastTick: candidate };
    }

    if (ability.style === "ranged") {
      if (input.ammo === "deathspore") {
        state = patchRanged(state, {
          deathspore: onRangedHit(state.ranged.deathspore, working.hits.length),
        });
      }
      if (ability.id === "shadow_tendrils") {
        state = patchRanged(state, {
          shadowImbued: extendShadowImbued(state.ranged.shadowImbued, candidate),
        });
      }
      const perHit = shadowImbuedAdrenalinePerHit(state.ranged.shadowImbued, candidate);
      if (perHit > 0 && working.hits.length > 0) {
        state = gainAdrenaline(state, perHit * working.hits.length);
      }
    }
    if (isMagicAbility(ability) && ability.requiresAnima) {
      state = { ...state, magic: consumeAnima(state.magic) };
    }

    // Occupancy: the actor is busy through the channel (or one GCD). Advancing
    // through it lands this cast's due hits and the interval's passive generation.
    const occupancyTicks = ability.channelTicks ?? GLOBAL_COOLDOWN_TICKS;
    endTick = Math.max(endTick, candidate + occupancyTicks);
    advanceTo(candidate + occupancyTicks);
    record.adrenalineAfter = state.adrenaline;
    casts.push(record);
    return { ok: true };
  }

  function resolveCastHit(
    at: number,
    eventSeq: number,
    hitSpec: AbilityHit,
    ability: AbilitySpec,
    castSeq: number,
    critLayers: CritLayers,
    baseMods: CombatModifier[],
    chaosRoarActive: boolean,
  ): ResolvedDamage {
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
    hitDetails.set(eventSeq, hit);
    let min = hit.min;
    let max = hit.max;
    let expected = hit.expected;
    // Searing Winds: attached +20% component folded into this hit — never a
    // separate event, so it cannot inflate proc rolls, stacks, or hit counters.
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

  function performOffGcdCast(ability: AbilitySpec): void {
    nextCastSeq++;
    if (ability.stateEffect === "runic_charge") {
      state = { ...state, magic: activateRunicCharge(state.magic, state.tick) };
    }
    casts.push({
      tick: state.tick,
      abilityId: ability.id,
      result: EMPTY_RESULT,
      adrenalineAfter: state.adrenaline,
    });
    endTick = Math.max(endTick, state.tick + 1);
  }

  return {
    getState: () => state,
    costOf,
    firstLegalTick: (abilityId) => firstLegalTick(state, abilityId),
    advanceTo,
    performCast,
    performOffGcdCast,
    cancelCastEvents: (castSeq) => queue.cancelByOwner(castSeq),
    finish,
    byId,
    basicByStyle,
  };
}

/** Deterministic expected-value run; unpayable casts return an error summary. */
export function simulate(input: SimulateInput, options?: SimulateOptions): RotationSummary {
  const ctx = createCastContext(input);

  for (const action of input.rotation) {
    const ability = ctx.byId.get(action.abilityId);
    if (!ability) return ctx.finish(`unknown ability: ${action.abilityId}`);

    if (ability.stateEffect === "runic_charge") {
      if (!runicChargeReady(ctx.getState().magic, ctx.getState().tick)) {
        return ctx.finish(`runic_charge is on cooldown at tick ${ctx.getState().tick}`);
      }
      ctx.performOffGcdCast(ability);
      continue;
    }

    if (input.autoWeave) {
      const basic = ctx.basicByStyle.get(ability.style);
      let guard = 0;
      while (
        basic &&
        (ctx.firstLegalTick(ability.id) > ctx.getState().tick ||
          ctx.costOf(ability) > ctx.getState().adrenaline ||
          !necroCanCast(
            ability,
            ctx.getState().necro,
            ctx.getState().conjures,
            ctx.getState().tick,
          ))
      ) {
        if (++guard > 200)
          return ctx.finish(
            `${ability.id} is unaffordable at tick ${ctx.getState().tick}, even weaving basics`,
          );
        const attempt = ctx.performCast(basic, ctx.getState().tick, true);
        if (!attempt.ok) return ctx.finish(attempt.error);
      }
    }

    const attempt = ctx.performCast(ability, ctx.firstLegalTick(ability.id), false);
    if (!attempt.ok) return ctx.finish(attempt.error);
  }

  return ctx.finish(undefined, undefined, options);
}
