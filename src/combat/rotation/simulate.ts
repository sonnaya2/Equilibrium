import type { CritLayers } from "../core/critical";
import type { HitCapRule } from "../core/hitCaps";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../data/sources";
import { calculateAbility, type AbilityResult, type AbilitySpec } from "../pipeline/calculateAbility";
import { calculateHit } from "../pipeline/calculateHit";
import {
  activateBerserk,
  BERSERK_DAMAGE_MULTIPLIER,
  BERSERK_DURATION_SECONDS,
  endBerserk,
} from "../styles/melee/bloodlust";
import type { MeleeAbilitySpec } from "../styles/melee/abilities";
import {
  FURY_CRIT_CHANCE_BONUS,
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
  METEOR_STRIKE_BASIC_ADREN_MULTIPLIER,
  METEOR_STRIKE_DURATION_SECONDS,
  METEOR_STRIKE_PASSIVE_ADREN_PER_TICK,
} from "../styles/melee/effects";
import {
  activateDeathsSwiftness,
  deathsSwiftnessMultiplier,
} from "../styles/ranged/effects";
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
import type { RangedAbilitySpec } from "../styles/ranged/abilities";
import type { MagicAbilitySpec } from "../styles/magic/abilities";
import {
  applyNecroOnCast,
  deathSkullsCooldownTicks,
  necroAdrenalineCost,
  necroCanCast,
  resolveNecromancyAbility,
} from "../styles/necromancy/effects";
import {
  processSpiritAutos,
  type SpiritAutoEvent,
} from "../styles/necromancy/conjures";
import type { CombatContext, CombatModifier, SourceReference } from "../types";
import type { RotationAction } from "./actions";
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

/** Invigorating / Impatient (and similar) — applied only to basic adren gains. */
export interface AdrenalineRules {
  /** Multiplier on basic-category adrenaline gains (Invigorating). Default 1. */
  basicGainMultiplier?: number;
  /** EV extra adrenaline on each basic gain cast (Impatient chance × 3). Default 0. */
  impatientExpectedExtra?: number;
}

export interface SimulateInput {
  /** Caller-supplied base ability damage, as with the single-hit pipeline. */
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  abilities: readonly AbilitySpec[];
  rotation: readonly RotationAction[];
  /** Static modifiers for every cast, or a per-ability builder (loadout perks). */
  modifiers?: CombatModifier[] | ((ability: AbilitySpec) => CombatModifier[]);
  context?: CombatContext;
  cap?: HitCapRule;
  /** Ammo family; "splintering" is accepted but unwired — the Puncture
   *  application rule is unverified (see styles/ranged/onHit.ts). */
  ammo?: "deathspore" | "splintering";
  /** When true, the style's autoAttack basic is woven into GCD gaps and
   *  adrenaline shortfalls before each queued cast (§5.6: basics auto-used
   *  when nothing else is queued). When false, a shortfall fails the run. */
  autoWeave?: boolean;
  /** Perk-driven basic adrenaline rules (Invigorating, Impatient EV). */
  adrenaline?: AdrenalineRules;
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
  /** Elapsed ticks: last cast's global cooldown, or the DoT tail if it outlasts it. */
  ticks: number;
  /**
   * Horizon the run was asked to fill (revolution duration). When set, `dps` is
   * totalExpected / (horizonTicks * tickSeconds) so a 60s revo reports 60s DPS.
   */
  horizonTicks?: number;
  totalMin: number;
  totalMax: number;
  totalExpected: number;
  /** Expected damage per second over the horizon (or elapsed ticks if no horizon). */
  dps: number;
  /** Expected damage summed per ability id — the contribution split. */
  perAbility: Record<string, number>;
  /** Expected damage landing on each tick — DoT tails land on their sourced ticks. */
  damageByTick: Record<number, number>;
}

const EMPTY_RESULT: AbilityResult = { hits: [], min: 0, max: 0, expected: 0, adrenalineDelta: 0 };

/** Flat damage windows (Berserk, Death's Swiftness) compose at onCast — an engine
 *  stage choice; multiplication order is immaterial while only one applies. */
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
  performCast(ability: AbilitySpec, readyTick: number, auto: boolean): void;
  /** Off-GCD utility casts (Runic Charge): state-machine update and a cast record
   *  without consuming or advancing the global cooldown. */
  performOffGcdCast(ability: AbilitySpec): void;
  finish(error?: string, horizonTicks?: number): RotationSummary;
  byId: Map<string, AbilitySpec>;
  basicByStyle: Map<AbilitySpec["style"], AbilitySpec>;
}

/**
 * The shared cast machinery behind simulate and simulateRevolution: state, cost
 * evaluation, the single cast path, and summary assembly. Behaviour is identical
 * for queued and priority-driven rotations — only the driver differs.
 */
export function createCastContext(input: Omit<SimulateInput, "rotation" | "autoWeave">): CastContext {
  const byId = new Map(input.abilities.map((a) => [a.id, a]));
  const basicByStyle = new Map(input.abilities.filter((a) => a.autoAttack).map((a) => [a.style, a]));
  const casts: CastRecord[] = [];
  const perAbility: Record<string, number> = {};
  const damageByTick: Record<number, number> = {};
  let state = newRotationState();
  let endTick = 0;
  /** Spirit auto EV outside ability casts (conjure passive damage). */
  let spiritMin = 0;
  let spiritMax = 0;
  let spiritExpected = 0;
  /** Inclusive upper bound of ticks already processed for spirit autos. */
  let spiritCursor = 0;

  function landSpiritEvents(events: SpiritAutoEvent[]): void {
    for (const ev of events) {
      const hit = calculateHit({
        base: input.base,
        band: {
          minPct: ev.band.minPct * ev.mult,
          maxPct: ev.band.maxPct * ev.mult,
        },
        level: input.level,
        accuracy: input.accuracy,
        crit: { chance: 0, eligible: false },
        modifiers:
          typeof input.modifiers === "function" ? [] : (input.modifiers ?? []),
        context: input.context,
        cap: input.cap,
      });
      spiritMin += hit.min;
      spiritMax += hit.max;
      spiritExpected += hit.expected;
      damageByTick[ev.tick] = (damageByTick[ev.tick] ?? 0) + hit.expected;
      perAbility[ev.abilityId] = (perAbility[ev.abilityId] ?? 0) + hit.expected;
      endTick = Math.max(endTick, ev.tick + 1);
    }
  }

  /** Advance spirit autos from spiritCursor through toTick inclusive. */
  function advanceSpirits(toTick: number): void {
    if (toTick <= spiritCursor) return;
    const { state: next, events } = processSpiritAutos(state.conjures, spiritCursor, toTick);
    state = { ...state, conjures: next };
    landSpiritEvents(events);
    spiritCursor = toTick;
  }

  function finish(error?: string, horizonTicks?: number): RotationSummary {
    // Drain remaining spirit autos (tails past horizon still count, like DoT tails).
    const spiritEnd = state.conjures.spirits.reduce(
      (m, s) => Math.max(m, s.untilTick + 3),
      spiritCursor,
    );
    if (spiritEnd > spiritCursor) advanceSpirits(spiritEnd);

    const totalExpected = casts.reduce((n, c) => n + c.result.expected, 0) + spiritExpected;
    const totalMin = casts.reduce((n, c) => n + c.result.min, 0) + spiritMin;
    const totalMax = casts.reduce((n, c) => n + c.result.max, 0) + spiritMax;
    const denomTicks = horizonTicks != null && horizonTicks > 0 ? horizonTicks : endTick;
    const seconds = denomTicks * TICK_SECONDS;
    return {
      ok: error === undefined,
      error,
      casts,
      ticks: endTick,
      horizonTicks,
      totalMin,
      totalMax,
      totalExpected,
      dps: seconds > 0 ? totalExpected / seconds : 0,
      perAbility,
      damageByTick,
    };
  }

  /** Adrenaline cost against current state (Deathspore free casts, FoD Necrosis discount). */
  function costOf(ability: AbilitySpec): number {
    if (ability.style === "necromancy") {
      return necroAdrenalineCost(ability, state.necro, state.tick);
    }
    const listed = ability.adrenaline?.cost ?? 0;
    return listed > 0 && ability.style === "ranged" && input.ammo === "deathspore" && deathsporeReady(state.ranged.deathspore)
      ? 0
      : listed;
  }

  /** Meteor Strike passive: +4.5% adren per tick while the buff window is open. */
  function grantMeteorPassive(fromTick: number, toTickExclusive: number): void {
    if (state.meteorStrikeUntilTick <= 0 || toTickExclusive <= fromTick) return;
    let gain = 0;
    const end = Math.min(toTickExclusive, state.meteorStrikeUntilTick);
    for (let t = fromTick; t < end; t++) gain += METEOR_STRIKE_PASSIVE_ADREN_PER_TICK;
    if (gain > 0) state = gainAdrenaline(state, gain);
  }

  /** Everything a real cast does at a fixed tick: damage, resources, buffs, style
   *  on-hit effects, and the GCD advance. Queued and woven casts share this path. */
  function performCast(ability: AbilitySpec, readyTick: number, auto: boolean): void {
    // Spirit autos due while waiting on GCD / ability CD, then passive adren.
    advanceSpirits(readyTick);
    grantMeteorPassive(state.tick, readyTick);
    state = { ...state, tick: readyTick };
    if (state.melee.berserk && readyTick >= state.berserkUntilTick) {
      state = { ...state, melee: endBerserk(state.melee), berserkUntilTick: 0 };
    }

    const melee = ability.style === "melee" ? (ability as MeleeAbilitySpec) : null;
    let working: AbilitySpec =
      melee?.bloodlustScale && state.melee.stacks >= melee.bloodlustScale.threshold
        ? { ...ability, hits: ability.hits.map((h) => ({ ...h, band: melee.bloodlustScale!.band })) }
        : ability;
    // FoD (Necrosis cost + Living Death 1.5×), Death Grasp stacks, Volley soul count.
    if (ability.style === "necromancy") {
      working = resolveNecromancyAbility(working, state.necro, readyTick);
    }

    const baseMods =
      typeof input.modifiers === "function" ? input.modifiers(ability) : (input.modifiers ?? []);
    const modifiers = [...baseMods];
    // Chaos Roar: ×1.75 on the next damaging melee cast inside the window.
    const chaosRoarActive =
      ability.style === "melee" &&
      working.hits.length > 0 &&
      state.chaosRoarUntilTick > 0 &&
      readyTick < state.chaosRoarUntilTick;
    if (chaosRoarActive) {
      modifiers.push(buffMultiplier("buff:chaos_roar", 1.75, MODERNISATION_WIKI));
      state = { ...state, chaosRoarUntilTick: 0 };
    }
    // Greater Fury: next non-bleed melee is a guaranteed crit.
    const furyCrit =
      ability.style === "melee" &&
      state.greaterFuryCrit &&
      working.hits.some((h) => h.critEligible !== false);
    if (furyCrit) {
      state = { ...state, greaterFuryCrit: false };
    }
    // Fury: next crit-eligible melee gains +25% crit chance (consumed on use).
    const furyBonus =
      ability.style === "melee" &&
      state.furyCritBonus &&
      working.hits.some((h) => h.critEligible !== false);
    if (furyBonus) {
      state = { ...state, furyCritBonus: false };
    }
    if (ability.style === "melee" && readyTick < state.berserkUntilTick) {
      modifiers.push(buffMultiplier("buff:berserk", BERSERK_DAMAGE_MULTIPLIER, MODERNISATION_PATCH_2));
    }
    if (ability.style === "ranged") {
      const mult = deathsSwiftnessMultiplier(state.ranged.swiftness, readyTick);
      if (mult !== 1) modifiers.push(buffMultiplier("buff:deaths_swiftness", mult, MODERNISATION_WIKI));
      const bonusPct = searingWindsBonusPct(state.ranged.searingWinds, readyTick);
      if (bonusPct > 0 && working.hits.length > 0) {
        // ponytail: the bonus hit's crit behaviour is unsourced — modelled ineligible.
        working = {
          ...working,
          hits: working.hits.flatMap((h) => [
            h,
            { band: { minPct: bonusPct, maxPct: bonusPct }, critEligible: false, tickOffset: h.tickOffset },
          ]),
        };
      }
    }
    if (ability.style === "magic" && sunshineActive(state.sunshine, readyTick)) {
      modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
    }

    const critLayers = {
      ...input.crit,
      chance: input.crit.chance + (furyBonus ? FURY_CRIT_CHANCE_BONUS : 0),
      guaranteed:
        furyCrit ||
        (ability as RangedAbilitySpec).guaranteedCrit ||
        input.crit.guaranteed,
    };

    let result: AbilityResult =
      working.hits.length === 0
        ? EMPTY_RESULT
        : calculateAbility(working, {
            base: input.base,
            level: input.level,
            accuracy: input.accuracy,
            crit: critLayers,
            modifiers,
            context: input.context,
            cap: input.cap,
          });

    working.hits.forEach((hit, i) => {
      const landTick = readyTick + (hit.tickOffset ?? 0);
      damageByTick[landTick] = (damageByTick[landTick] ?? 0) + result.hits[i].expected;
      endTick = Math.max(endTick, landTick + 1);
    });

    // Instability Lightning Surge (wiki): while buff active — or this cast applies
    // Instability — each Magic crit-eligible hit adds p * E[70–90%] one tick later.
    // Surge crits do not chain (only source ability hits feed surges).
    const procInstability =
      ability.style === "magic" &&
      working.hits.length > 0 &&
      (instabilityActive(state.instability, readyTick) || ability.appliesBuff === "instability");
    if (procInstability) {
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
      let surgeTotal = 0;
      working.hits.forEach((hit, i) => {
        if (hit.critEligible === false) return;
        const contrib = lightningSurgeExpected(result.hits[i]?.critChance ?? 0, surgeHit.expected);
        if (contrib <= 0) return;
        const landTick = readyTick + (hit.tickOffset ?? 0) + LIGHTNING_SURGE_TICK_DELAY;
        damageByTick[landTick] = (damageByTick[landTick] ?? 0) + contrib;
        endTick = Math.max(endTick, landTick + 1);
        surgeTotal += contrib;
      });
      if (surgeTotal > 0) {
        // EV-only: min/max stay source-hit bounds (surge is probabilistic).
        result = { ...result, expected: result.expected + surgeTotal };
      }
    }

    const cost = costOf(ability);
    // Meteor Strike: melee basics generate 1.5x listed adrenaline while buffed.
    // Invigorating multiplies basic gains; Impatient adds EV extra on basic gains.
    if (ability.adrenaline?.gain) {
      const isBasic = ability.category === "basic" || !!ability.autoAttack;
      const meteorBasic =
        ability.style === "melee" &&
        ability.category === "basic" &&
        state.meteorStrikeUntilTick > 0 &&
        readyTick < state.meteorStrikeUntilTick;
      let gain = meteorBasic
        ? ability.adrenaline.gain * METEOR_STRIKE_BASIC_ADREN_MULTIPLIER
        : ability.adrenaline.gain;
      if (isBasic) {
        gain *= input.adrenaline?.basicGainMultiplier ?? 1;
        gain += input.adrenaline?.impatientExpectedExtra ?? 0;
      }
      state = gainAdrenaline(state, gain);
    }
    if (cost) state = spendAdrenaline(state, cost);
    // Deathspore free-cast only — FoD Necrosis free casts must not consume stacks.
    if (
      cost === 0 &&
      (ability.adrenaline?.cost ?? 0) > 0 &&
      ability.style === "ranged" &&
      input.ammo === "deathspore"
    ) {
      state = patchRanged(state, { deathspore: spendDeathspore(state.ranged.deathspore) });
    }
    if (melee?.bloodlustGain) state = gainMeleeBloodlust(state, melee.bloodlustGain);
    if (ability.cooldownSeconds) {
      const cdTicks =
        ability.id === "death_skulls"
          ? deathSkullsCooldownTicks(state.necro, readyTick)
          : secondsToTicks(ability.cooldownSeconds);
      state = startCooldown(state, ability.id, cdTicks);
    }

    // Necromancy: souls / necrosis / Living Death / conjure summon + ToD LD adren + CD resets.
    // Uses the bar ability (not the resolved FoD/volley rewrite) so declared
    // soulGain/necrosisGain/soulCost fields apply; id-based spends cover FoD/DG/Volley.
    if (ability.style === "necromancy") {
      const patch = applyNecroOnCast(state.necro, ability, readyTick, state.conjures);
      state = {
        ...state,
        necro: patch.necro,
        ...(patch.conjures ? { conjures: patch.conjures } : {}),
      };
      if (patch.adrenalineBonus) state = gainAdrenaline(state, patch.adrenalineBonus);
      state = clearCooldowns(state, patch.clearCooldownIds);
    }

    if (ability.buff === "berserk") {
      state = {
        ...state,
        melee: activateBerserk(state.melee),
        berserkUntilTick: readyTick + secondsToTicks(BERSERK_DURATION_SECONDS),
      };
    } else if (ability.buff === "deaths_swiftness") {
      state = patchRanged(state, { swiftness: activateDeathsSwiftness(readyTick) });
    } else if (ability.buff === "greater_deaths_swiftness") {
      state = patchRanged(state, { swiftness: activateDeathsSwiftness(readyTick, true) });
    } else if (ability.buff === "shadow_imbued") {
      state = patchRanged(state, { shadowImbued: activateShadowImbued(readyTick) });
    }
    if (ability.appliesBuff === "searing_winds") {
      state = patchRanged(state, { searingWinds: activateSearingWinds(readyTick) });
    }
    if (ability.appliesBuff === "sunshine" || ability.appliesBuff === "greater_sunshine") {
      state = {
        ...state,
        sunshine: activateSunshine(readyTick, ability.appliesBuff === "greater_sunshine"),
      };
    }
    if (ability.appliesBuff === "instability") {
      state = { ...state, instability: activateInstability(readyTick) };
    }
    if (ability.appliesBuff === "chaos_roar") {
      // 7.2s empower window (12 ticks) for the next damaging melee.
      state = { ...state, chaosRoarUntilTick: readyTick + secondsToTicks(7.2) };
    }
    if (ability.appliesBuff === "greater_fury") {
      state = { ...state, greaterFuryCrit: true };
    }
    if (ability.appliesBuff === "fury") {
      state = { ...state, furyCritBonus: true };
    }
    if (ability.appliesBuff === "meteor_strike") {
      state = {
        ...state,
        meteorStrikeUntilTick: readyTick + secondsToTicks(METEOR_STRIKE_DURATION_SECONDS),
      };
    }
    // Greater Flurry: each hit extends active Berserk by 0.6s (1 tick).
    if (ability.appliesBuff === "greater_flurry" && state.melee.berserk && readyTick < state.berserkUntilTick) {
      const extendTicks = working.hits.length * secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS);
      state = { ...state, berserkUntilTick: state.berserkUntilTick + extendTicks };
    }
    // greater_barge: idle scale + Endless Assault need off-target idle (UNVERIFIED in sim).
    // pulverise: target -25% outgoing + on-kill adren — not modelled (defensive / kill-gated).

    if (ability.style === "ranged") {
      if (input.ammo === "deathspore") {
        state = patchRanged(state, { deathspore: onRangedHit(state.ranged.deathspore, working.hits.length) });
      }
      if (ability.id === "shadow_tendrils") {
        state = patchRanged(state, { shadowImbued: extendShadowImbued(state.ranged.shadowImbued, readyTick) });
      }
      const perHit = shadowImbuedAdrenalinePerHit(state.ranged.shadowImbued, readyTick);
      if (perHit > 0 && working.hits.length > 0) {
        state = gainAdrenaline(state, perHit * working.hits.length);
      }
    }
    if ((ability as MagicAbilitySpec).requiresAnima) {
      state = { ...state, magic: consumeAnima(state.magic) };
    }

    const gcdEnd = readyTick + GLOBAL_COOLDOWN_TICKS;
    // Passive adren across the GCD the cast occupies (buff may start this cast).
    grantMeteorPassive(readyTick, gcdEnd);
    casts.push({ tick: readyTick, abilityId: ability.id, result, adrenalineAfter: state.adrenaline, ...(auto ? { auto: true as const } : {}) });
    perAbility[ability.id] = (perAbility[ability.id] ?? 0) + result.expected;
    state = { ...state, tick: gcdEnd };
    // Spirit autos that land during this GCD (e.g. first skeleton hit at cast+7).
    advanceSpirits(gcdEnd);
    endTick = Math.max(endTick, state.tick);
  }

  function performOffGcdCast(ability: AbilitySpec): void {
    if (ability.buff === "runic_charge") {
      state = { ...state, magic: activateRunicCharge(state.magic, state.tick) };
    }
    casts.push({ tick: state.tick, abilityId: ability.id, result: EMPTY_RESULT, adrenalineAfter: state.adrenaline });
    endTick = Math.max(endTick, state.tick + 1);
  }

  return {
    getState: () => state,
    costOf,
    firstLegalTick: (abilityId) => firstLegalTick(state, abilityId),
    performCast,
    performOffGcdCast,
    finish,
    byId,
    basicByStyle,
  };
}

/**
 * Deterministic rotation run: expected values only, casts advance to their first
 * legal tick, and an unpayable adrenaline cost fails the run instead of silently
 * skipping — a rotation the game cannot perform is invalid input, not zero damage.
 * ponytail: channelled hits still land on the cast tick — the corpus carries no
 * per-hit tick schedule for channels; bleed tails use their sourced intervals.
 */
export function simulate(input: SimulateInput): RotationSummary {
  const ctx = createCastContext(input);

  for (const action of input.rotation) {
    const ability = ctx.byId.get(action.abilityId);
    if (!ability) return ctx.finish(`unknown ability: ${action.abilityId}`);

    if (ability.buff === "runic_charge") {
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
          !necroCanCast(ability, ctx.getState().necro, ctx.getState().conjures, ctx.getState().tick))
      ) {
        if (++guard > 200) return ctx.finish(`${ability.id} is unaffordable at tick ${ctx.getState().tick}, even weaving basics`);
        ctx.performCast(basic, ctx.getState().tick, true);
      }
    }

    const readyTick = ctx.firstLegalTick(ability.id);
    if ((ability as MagicAbilitySpec).requiresAnima && !animaCharged(ctx.getState().magic, readyTick)) {
      return ctx.finish(`${ability.id} requires an active Runic Charge at tick ${readyTick}`);
    }
    if (!necroCanCast(ability, ctx.getState().necro, ctx.getState().conjures, readyTick)) {
      const souls = ctx.getState().necro.residualSouls;
      return ctx.finish(
        `${ability.id} needs residual souls or an active conjure, ${souls} souls available at tick ${readyTick}`,
      );
    }

    const cost = ctx.costOf(ability);
    if (cost > ctx.getState().adrenaline) {
      return ctx.finish(
        `${ability.id} needs ${cost}% adrenaline, ${ctx.getState().adrenaline}% available at tick ${readyTick}`,
      );
    }

    ctx.performCast(ability, readyTick, false);
  }

  return ctx.finish();
}
