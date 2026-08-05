import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { CritLayers } from "../../core/critical";
import {
  isMeleeAbility,
  PUNISH_LOW_HP_MULTIPLIER,
  PUNISH_LOW_HP_THRESHOLD_PCT,
} from "../../styles/melee/abilities";
import {
  GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS,
  GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS,
  greaterBargeIdleBand,
} from "../../styles/melee/effects";
import { resolveIcyTempest } from "../../styles/melee/icyTempest";
import { searingWindsBonusPct } from "../../styles/ranged/onHit";
import { hauntedActive } from "../../styles/necromancy/haunted";
import { applyCaromingToRicochetHits, isRicochetAbility } from "../../styles/ranged/caroming";
import { darkfangBasicHits, hasDarkfangWeapon } from "../../styles/ranged/darkfang";
import { isMagicAbility, resplendentAsphyxiate } from "../../styles/magic/abilities";
import {
  GREATER_FLOW_REDUCTION,
  isConcentratedBlast,
  RUNIC_FLOW_BONUS,
  SONIC_FLOW_REDUCTION,
} from "../../styles/magic/effects";
import { animaCharged, RUNIC_EMPOWERMENTS } from "../../styles/magic/runicCharge";
import { resolveNecromancyAbility } from "../../styles/necromancy/effects";
import {
  DEATH_SPARK_DAMAGE_MULT,
  DEATH_SPARK_PASSIVE_ID,
  DEATH_SPARK_STACKS_TO_EMPOWER,
} from "../../styles/necromancy/deathSpark";
import { spectralScythe3 } from "../../styles/necromancy/abilities";
import { resolveAbilityWithEquipment } from "../../shared/bleedDurationExtension";
import { hasPassive } from "../../shared/equipment";
import { costOf, spendOf } from "./rules";
import { firstEligibleDirectHitIndex, hasDamagingHits, hasFuryConsumingHit } from "./hitKind";
import type { CastSnapshot } from "./snapshot";
import type { SimulationRuntime } from "../runtime/runtime";
import { secondsToTicks } from "../../core/ticks";
import { GLOBAL_COOLDOWN_TICKS } from "../runtime/timing";

/** Explicit Greater Barge opener idle policy when lastAttackTick is unset (default 0). */
export const GREATER_BARGE_OPENER_IDLE_TICKS = 0;

type PrecombatIdleInput = { precombatIdleTicks?: number };

function resolveOpenerIdleTicks(input: PrecombatIdleInput): number {
  const raw = input.precombatIdleTicks;
  if (raw === undefined) return GREATER_BARGE_OPENER_IDLE_TICKS;
  if (!Number.isInteger(raw) || raw < 0) {
    throw new RangeError(`precombatIdleTicks must be a non-negative integer, got ${raw}`);
  }
  return raw;
}

function meleeIdleTicksAt(
  rt: SimulationRuntime,
  candidate: number,
  abilityStyle: AbilitySpec["style"],
  hitCount: number,
): number {
  if (abilityStyle !== "melee" || hitCount === 0) return 0;
  if (rt.state.target.lastAttackTick < 0) {
    return resolveOpenerIdleTicks(rt.input as PrecombatIdleInput);
  }
  return candidate - rt.state.target.lastAttackTick;
}

/**
 * A state change decided during preparation and applied at commit, in list
 * order. Preparation stays read-only, so a mechanic records its transition here
 * instead of adding another boolean to PreparedCast.
 */
export type PreparedTransition =
  /** Bloodlust stacks the empowered variant consumes. */
  | { kind: "spendBloodlust"; stacks: number }
  /** Endless Assault window Greater Barge opens after enough idle ticks. */
  | { kind: "grantEndlessAssault"; untilTick: number }
  /** Endless Assault window a channelled melee cast inside one consumes. */
  | { kind: "consumeEndlessAssault" }
  /** Next-hit melee windows this cast consumes. */
  | { kind: "consumeChaosRoar" }
  | { kind: "consumeGreaterFury" }
  | { kind: "consumeFury" }
  | { kind: "consumeEnduringRuin" }
  /** Icy Tempest spends all Primordial Ice stacks on cast. */
  | { kind: "consumePrimordialIce" };

/**
 * Everything one atomic cast needs, computed once against the advanced state
 * at the candidate tick. Preparation is READ-ONLY: every state mutation the
 * cast implies is recorded here as data and applied by cast/effects at commit.
 */
export interface PreparedCast {
  /** The ability as queued. */
  ability: AbilitySpec;
  /** The resolved variant (Bloodlust form, necromancy resolution, Barge idle). */
  working: AbilitySpec;
  candidate: number;
  /** Listed adrenaline requirement at the candidate tick. */
  cost: number;
  /** Actual adrenaline spend at the candidate tick (Deathspore-zeroed). */
  spend: number;
  occupancyTicks: number;
  flowReduction?: number;
  channelAsDot: boolean;
  snap: CastSnapshot;
  transitions: readonly PreparedTransition[];
}

/**
 * Crit layers for the cast: the input layers, any spec-level bonuses (Wild
 * Magic), and - for non-Concentrated casts - the accumulated Concentrated
 * Blast stacks (the "next Magic attack" consuming them). CB/GCB casts read
 * their live accumulating stacks at land time instead (see resolveCastHit).
 */
function magicCritLayers(
  crit: Omit<CritLayers, "eligible">,
  ability: AbilitySpec,
  concStacksChance: number,
): Omit<CritLayers, "eligible"> {
  const layers = { ...crit, guaranteed: ability.guaranteedCrit || crit.guaranteed };
  if (!isMagicAbility(ability)) return layers;
  if (ability.critChanceBonusPct) layers.chance += ability.critChanceBonusPct / 100;
  if (ability.critDamageBonus)
    layers.damageBonus = (layers.damageBonus ?? 0) + ability.critDamageBonus;
  if (!isConcentratedBlast(ability.id)) layers.chance += concStacksChance;
  return layers;
}

export function prepareCast(
  rt: SimulationRuntime,
  ability: AbilitySpec,
  candidate: number,
): PreparedCast {
  const input = rt.input;

  // Equipment-adjusted hit list (e.g. Masterwork spear bleed duration) before
  // Bloodlust / other variants so extra hits keep the same bands and cadence.
  // Shared with Quick via resolveAbilityWithEquipment - never mutates catalogues.
  let working: AbilitySpec = resolveAbilityWithEquipment(ability, input.equipmentEffects);

  // Dark bow / Gloomfire: Ranged basic becomes two independent 45-55% hits.
  if (ability.id === "ranged_attack" && hasDarkfangWeapon(input.equipmentIds)) {
    working = { ...working, hits: darkfangBasicHits() };
  }

  // Caroming: scale Ricochet hit bands at construction (per-hit, not flat total).
  const caromingRank = input.caromingRank ?? 0;
  if (isRicochetAbility(ability.id) && caromingRank > 0) {
    working = {
      ...working,
      hits: applyCaromingToRicochetHits(working.hits, caromingRank),
    };
  }

  // Empowered variant resolution: the spend itself is recorded, not applied - 
  // it lands atomically with the rest of the commit.
  const melee = isMeleeAbility(ability) ? ability : null;
  let empowerMult = 1;
  let bloodlustSpend = 0;
  if (melee) {
    const stacks = rt.state.melee.bloodlust.stacks;
    if (melee.bloodlustScale && stacks >= melee.bloodlustScale.threshold) {
      working = {
        ...working,
        hits: working.hits.map((hit) => ({ ...hit, band: melee.bloodlustScale!.band })),
      };
      bloodlustSpend = melee.bloodlustScale.threshold;
    } else if (melee.bloodlustExtraHits && stacks >= melee.bloodlustExtraHits.threshold) {
      working = {
        ...working,
        hits: [...working.hits, ...melee.bloodlustExtraHits.hits.map((hit) => ({ ...hit }))],
      };
      bloodlustSpend = melee.bloodlustExtraHits.threshold;
    } else if (melee.bloodlustMissingHp && stacks >= melee.bloodlustMissingHp.threshold) {
      // When target HP is unavailable, do not invent HP and do not spend stacks.
      const hp = input.targetHpPercent;
      if (hp != null) {
        empowerMult = 1 + Math.min(melee.bloodlustMissingHp.capPct, 100 - hp) / 100;
        bloodlustSpend = melee.bloodlustMissingHp.threshold;
      }
    }
  }
  if (ability.style === "necromancy") {
    working = resolveNecromancyAbility(working, rt.state.necromancy.resources, candidate);
    // Omni Guard Death Spark: at 5 stacks ready; this basic doubles if pre-cast >= 5.
    // Stacks update at commit; prepare only reads pre-cast stacks for empower.
    const necroBasic =
      ability.id === "necromancy_basic" || (!!ability.autoAttack && ability.style === "necromancy");
    if (
      necroBasic &&
      hasPassive(input.equipmentEffects, DEATH_SPARK_PASSIVE_ID) &&
      rt.state.necromancy.resources.deathSparkStacks >= DEATH_SPARK_STACKS_TO_EMPOWER
    ) {
      working = {
        ...working,
        hits: working.hits.map((h) => ({
          ...h,
          band: {
            minPct: h.band.minPct * DEATH_SPARK_DAMAGE_MULT,
            maxPct: h.band.maxPct * DEATH_SPARK_DAMAGE_MULT,
          },
        })),
      };
    }
  }
  // Icy Tempest: distribution-resolved bands; spend path is spendOf (resolveIcyTempest).
  if (ability.id === "icy_tempest") {
    const resolved = resolveIcyTempest(
      rt.state.melee.primordialIce,
      candidate,
      rt.state.ringOfVigour,
    );
    working = {
      ...working,
      hits: resolved.expectedHits.map((h) => ({ band: { ...h.band } })),
    };
  }
  if (ability.id === "asphyxiate" && (input.tumekensPieces ?? 0) >= 4) {
    working = resplendentAsphyxiate(working);
  }
  // Runic-charged Dragon Breath: same ability (basic, +9 adrenaline, same
  // cooldown), empowered band while Anima Charged - the charge is consumed at
  // commit (castEffects). Not a separate ability.
  if (ability.id === "dragon_breath" && animaCharged(rt.state.magic.runicCharge, candidate)) {
    working = {
      ...working,
      hits: working.hits.map((h) => ({ ...h, band: { ...RUNIC_EMPOWERMENTS.dragon_breath.band } })),
    };
  }
  // Planted Feet: base Sunshine's duration extends (handled in castEffects) but
  // its periodic beam damage is removed - schedule no DoT events at all (wiki:
  // Planted Feet: strip Sunshine beam DoT. Greater Sunshine does not gain the
  // +25% duration, but wiki still strips its beam (reflect encounters).
  // Death's Swiftness has no periodic hits since 16 Mar 2026.
  if (
    (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") &&
    input.plantedFeet
  ) {
    working = { ...working, hits: [] };
  }

  // Target-HP variants (sourced thresholds; absent HP → no bonus, never invented).
  const hp = input.targetHpPercent;
  if (hp != null) {
    if (ability.id === "punish" && hp < PUNISH_LOW_HP_THRESHOLD_PCT) {
      working = {
        ...working,
        hits: working.hits.map((h) => ({
          ...h,
          band: {
            minPct: h.band.minPct * PUNISH_LOW_HP_MULTIPLIER,
            maxPct: h.band.maxPct * PUNISH_LOW_HP_MULTIPLIER,
          },
        })),
      };
    }
    if (ability.id === "spectral_scythe_3") {
      working = { ...working, hits: spectralScythe3(hp / 100).hits };
    }
  }

  const meleeIdleTicks = meleeIdleTicksAt(rt, candidate, ability.style, working.hits.length);
  let endlessAssaultGrantUntilTick: number | undefined;
  if (ability.id === "greater_barge" && working.hits.length > 0) {
    working = {
      ...working,
      hits: working.hits.map((h) => ({
        ...h,
        band: greaterBargeIdleBand(h.band.minPct, h.band.maxPct, meleeIdleTicks),
      })),
    };
    if (meleeIdleTicks >= GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS) {
      endlessAssaultGrantUntilTick =
        candidate + secondsToTicks(GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS);
    }
  }
  const endlessAssaultConsume =
    melee?.channelled === true &&
    working.hits.length > 0 &&
    rt.state.melee.endlessAssaultUntilTick > 0 &&
    candidate < rt.state.melee.endlessAssaultUntilTick;

  // Next-hit buffs are consumed by the next melee cast that can use them; the
  // benefit lands on that cast's FIRST eligible hit only (wiki: "only the
  // first hit of the channeled ability will receive the boost"). Chaos Roar is
  // the exception among them: channels get ×1.75 on the first hit, non-channel
  // multi-hit abilities on every hit, and bleeds benefit too.
  const damaging = hasDamagingHits(working.hits);
  const furyEligible = hasFuryConsumingHit(working.hits);
  const chaosRoarConsume =
    ability.style === "melee" &&
    damaging &&
    rt.state.melee.chaosRoarUntilTick > 0 &&
    candidate < rt.state.melee.chaosRoarUntilTick;
  const greaterFuryConsume =
    ability.style === "melee" &&
    furyEligible &&
    rt.state.melee.greaterFuryUntilTick > 0 &&
    candidate < rt.state.melee.greaterFuryUntilTick;
  const furyConsume = ability.style === "melee" && furyEligible && rt.state.melee.furyCritBonus;
  const enduringRuinConsume =
    ability.style === "melee" &&
    damaging &&
    rt.state.melee.enduringRuin.nextAttackBonus > 0 &&
    candidate < rt.state.melee.enduringRuin.untilTick;
  // Searing Winds eligibility is checked at cast (wiki: "calculated on cast") - 
  // a channel cast inside the window keeps the bonus on hits landing after it.
  const searingWindsAtCast =
    ability.style === "ranged" && searingWindsBonusPct(rt.state.ranged.searingWinds, candidate) > 0;
  // Haunted snap: scheduled-event identity / forensics. Damage uses land-time in resolveCastHit.
  const hauntedAtCast = damaging && hauntedActive(rt.state.target.haunted, candidate);
  const hauntedCapAd = hauntedAtCast ? rt.state.target.haunted.capAbilityDamage : 0;

  const snap: CastSnapshot = {
    castSeq: rt.nextCastSeq,
    critLayers: magicCritLayers(
      input.crit,
      ability,
      (rt.state.magic.concCritStacks * rt.state.magic.concCritPerStackPct) / 100,
    ),
    baseMods:
      typeof input.modifiers === "function" ? input.modifiers(ability) : (input.modifiers ?? []),
    chaosRoarActive: chaosRoarConsume,
    channelled: working.channelTicks != null,
    greaterFuryActive: greaterFuryConsume,
    furyActive: furyConsume,
    firstEligibleHitIndex: firstEligibleDirectHitIndex(working.hits),
    empowerMult,
    searingWindsAtCast,
    hauntedAtCast,
    hauntedCapAd,
    enduringRuinBonus: enduringRuinConsume ? rt.state.melee.enduringRuin.nextAttackBonus : 0,
  };

  const transitions: PreparedTransition[] = [];
  if (bloodlustSpend > 0) transitions.push({ kind: "spendBloodlust", stacks: bloodlustSpend });
  if (endlessAssaultGrantUntilTick !== undefined) {
    transitions.push({ kind: "grantEndlessAssault", untilTick: endlessAssaultGrantUntilTick });
  }
  if (endlessAssaultConsume) transitions.push({ kind: "consumeEndlessAssault" });
  if (chaosRoarConsume) transitions.push({ kind: "consumeChaosRoar" });
  if (greaterFuryConsume) transitions.push({ kind: "consumeGreaterFury" });
  if (furyConsume) transitions.push({ kind: "consumeFury" });
  if (enduringRuinConsume) transitions.push({ kind: "consumeEnduringRuin" });
  if (ability.id === "icy_tempest") transitions.push({ kind: "consumePrimordialIce" });

  const sonic = ability.id === "sonic_wave" || ability.id === "greater_sonic_wave";
  const flowReduction = sonic
    ? (ability.id === "sonic_wave" ? SONIC_FLOW_REDUCTION : GREATER_FLOW_REDUCTION) +
      (animaCharged(rt.state.magic.runicCharge, candidate) ? RUNIC_FLOW_BONUS : 0)
    : undefined;

  // costOf / spendOf share Vigour special discount; Icy Tempest stack reduction is spend-only.
  const cost = costOf(rt.state, ability, candidate);
  const spend = spendOf(rt.state, ability, candidate, input.ammo);

  return {
    ability,
    working,
    candidate,
    cost,
    spend,
    occupancyTicks: endlessAssaultConsume
      ? GLOBAL_COOLDOWN_TICKS
      : (working.channelTicks ?? GLOBAL_COOLDOWN_TICKS),
    ...(flowReduction !== undefined ? { flowReduction } : {}),
    channelAsDot: endlessAssaultConsume,
    snap,
    transitions,
  };
}
