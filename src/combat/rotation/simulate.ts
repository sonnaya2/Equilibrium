import type { CritLayers } from "../core/critical";
import type { HitCapRule } from "../core/hitCaps";
import { mulFloor } from "../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../data/sources";
import { calculateAbility, type AbilityResult, type AbilitySpec } from "../pipeline/calculateAbility";
import {
  activateBerserk,
  BERSERK_DAMAGE_MULTIPLIER,
  BERSERK_DURATION_SECONDS,
  endBerserk,
} from "../styles/melee/bloodlust";
import type { MeleeAbilitySpec } from "../styles/melee/abilities";
import {
  activateDeathsSwiftness,
  deathsSwiftnessMultiplier,
} from "../styles/ranged/effects";
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
import type { CombatContext, CombatModifier, SourceReference } from "../types";
import type { RotationAction } from "./actions";
import {
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

export interface SimulateInput {
  /** Caller-supplied base ability damage, as with the single-hit pipeline. */
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  abilities: readonly AbilitySpec[];
  rotation: readonly RotationAction[];
  modifiers?: CombatModifier[];
  context?: CombatContext;
  cap?: HitCapRule;
  /** Ammo family; "splintering" is accepted but unwired — the Puncture
   *  application rule is unverified (see styles/ranged/onHit.ts). */
  ammo?: "deathspore" | "splintering";
  /** When true, the style's autoAttack basic is woven into GCD gaps and
   *  adrenaline shortfalls before each queued cast (§5.6: basics auto-used
   *  when nothing else is queued). When false, a shortfall fails the run. */
  autoWeave?: boolean;
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
  totalMin: number;
  totalMax: number;
  totalExpected: number;
  /** Expected damage per second over the elapsed rotation. */
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

/**
 * Deterministic rotation run: expected values only, casts advance to their first
 * legal tick, and an unpayable adrenaline cost fails the run instead of silently
 * skipping — a rotation the game cannot perform is invalid input, not zero damage.
 * ponytail: channelled hits still land on the cast tick — the corpus carries no
 * per-hit tick schedule for channels; bleed tails use their sourced intervals.
 */
export function simulate(input: SimulateInput): RotationSummary {
  const byId = new Map(input.abilities.map((a) => [a.id, a]));
  const basicByStyle = new Map(input.abilities.filter((a) => a.autoAttack).map((a) => [a.style, a]));
  const casts: CastRecord[] = [];
  const perAbility: Record<string, number> = {};
  const damageByTick: Record<number, number> = {};
  let state = newRotationState();
  let endTick = 0;

  function finish(error?: string): RotationSummary {
    const totalExpected = casts.reduce((n, c) => n + c.result.expected, 0);
    const totalMin = casts.reduce((n, c) => n + c.result.min, 0);
    const totalMax = casts.reduce((n, c) => n + c.result.max, 0);
    const seconds = endTick * TICK_SECONDS;
    return {
      ok: error === undefined,
      error,
      casts,
      ticks: endTick,
      totalMin,
      totalMax,
      totalExpected,
      dps: seconds > 0 ? totalExpected / seconds : 0,
      perAbility,
      damageByTick,
    };
  }

  /** Adrenaline cost evaluated against current state (Deathspore free casts). */
  function costOf(ability: AbilitySpec): number {
    const listed = ability.adrenaline?.cost ?? 0;
    return listed > 0 && ability.style === "ranged" && input.ammo === "deathspore" && deathsporeReady(state.ranged.deathspore)
      ? 0
      : listed;
  }

  /** Everything a real cast does at a fixed tick: damage, resources, buffs, style
   *  on-hit effects, and the GCD advance. Queued and woven casts share this path. */
  function performCast(ability: AbilitySpec, readyTick: number, auto: boolean): void {
    state = { ...state, tick: readyTick };
    if (state.melee.berserk && readyTick >= state.berserkUntilTick) {
      state = { ...state, melee: endBerserk(state.melee), berserkUntilTick: 0 };
    }

    const melee = ability.style === "melee" ? (ability as MeleeAbilitySpec) : null;
    let working: AbilitySpec =
      melee?.bloodlustScale && state.melee.stacks >= melee.bloodlustScale.threshold
        ? { ...ability, hits: ability.hits.map((h) => ({ ...h, band: melee.bloodlustScale!.band })) }
        : ability;

    const modifiers = [...(input.modifiers ?? [])];
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

    const result =
      working.hits.length === 0
        ? EMPTY_RESULT
        : calculateAbility(working, {
            base: input.base,
            level: input.level,
            accuracy: input.accuracy,
            crit: { ...input.crit, guaranteed: (ability as RangedAbilitySpec).guaranteedCrit ?? input.crit.guaranteed },
            modifiers,
            context: input.context,
            cap: input.cap,
          });

    working.hits.forEach((hit, i) => {
      const landTick = readyTick + (hit.tickOffset ?? 0);
      damageByTick[landTick] = (damageByTick[landTick] ?? 0) + result.hits[i].expected;
      endTick = Math.max(endTick, landTick + 1);
    });

    const cost = costOf(ability);
    if (ability.adrenaline?.gain) state = gainAdrenaline(state, ability.adrenaline.gain);
    if (cost) state = spendAdrenaline(state, cost);
    if (cost === 0 && (ability.adrenaline?.cost ?? 0) > 0) {
      state = patchRanged(state, { deathspore: spendDeathspore(state.ranged.deathspore) });
    }
    if (melee?.bloodlustGain) state = gainMeleeBloodlust(state, melee.bloodlustGain);
    if (ability.cooldownSeconds) {
      state = startCooldown(state, ability.id, secondsToTicks(ability.cooldownSeconds));
    }

    if (ability.buff === "berserk") {
      state = {
        ...state,
        melee: activateBerserk(state.melee),
        berserkUntilTick: readyTick + secondsToTicks(BERSERK_DURATION_SECONDS),
      };
    } else if (ability.buff === "deaths_swiftness") {
      state = patchRanged(state, { swiftness: activateDeathsSwiftness(readyTick) });
    } else if (ability.buff === "shadow_imbued") {
      state = patchRanged(state, { shadowImbued: activateShadowImbued(readyTick) });
    }
    if (ability.appliesBuff === "searing_winds") {
      state = patchRanged(state, { searingWinds: activateSearingWinds(readyTick) });
    }

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

    casts.push({ tick: readyTick, abilityId: ability.id, result, adrenalineAfter: state.adrenaline, ...(auto ? { auto: true as const } : {}) });
    perAbility[ability.id] = (perAbility[ability.id] ?? 0) + result.expected;
    state = { ...state, tick: readyTick + GLOBAL_COOLDOWN_TICKS };
    endTick = Math.max(endTick, state.tick);
  }

  for (const action of input.rotation) {
    const ability = byId.get(action.abilityId);
    if (!ability) return finish(`unknown ability: ${action.abilityId}`);

    if (ability.buff === "runic_charge") {
      if (!runicChargeReady(state.magic, state.tick)) {
        return finish(`runic_charge is on cooldown at tick ${state.tick}`);
      }
      state = { ...state, magic: activateRunicCharge(state.magic, state.tick) };
      casts.push({ tick: state.tick, abilityId: ability.id, result: EMPTY_RESULT, adrenalineAfter: state.adrenaline });
      endTick = Math.max(endTick, state.tick + 1);
      continue;
    }

    if (input.autoWeave) {
      const basic = basicByStyle.get(ability.style);
      let guard = 0;
      while (basic && (firstLegalTick(state, ability.id) > state.tick || costOf(ability) > state.adrenaline)) {
        if (++guard > 200) return finish(`${ability.id} is unaffordable at tick ${state.tick}, even weaving basics`);
        performCast(basic, state.tick, true);
      }
    }

    const readyTick = firstLegalTick(state, ability.id);
    if ((ability as MagicAbilitySpec).requiresAnima && !animaCharged(state.magic, readyTick)) {
      return finish(`${ability.id} requires an active Runic Charge at tick ${readyTick}`);
    }

    const cost = costOf(ability);
    if (cost > state.adrenaline) {
      return finish(
        `${ability.id} needs ${cost}% adrenaline, ${state.adrenaline}% available at tick ${readyTick}`,
      );
    }

    performCast(ability, readyTick, false);
  }

  return finish();
}
