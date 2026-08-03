import type { CritLayers } from "../../core/critical";
import type { AbilityHit, AbilitySpec } from "../../pipeline/calculateAbility";
import { calculateHit } from "../../pipeline/calculateHit";
import { FURY_CRIT_CHANCE_BONUS } from "../../styles/melee/effects";
import {
  channelledMightCritBonus,
  isConcentratedBlast,
  tumekensSunshineCritChance,
} from "../../styles/magic/effects";
import { SEARING_WINDS_BONUS_HIT_PCT } from "../../styles/ranged/onHit";
import {
  COMMAND_REQUIRES_CONJURE,
  CONJURE_DAMAGE_POTENTIAL,
  conjureEligibleModifiers,
  findConjure,
  skeletonRageMult,
} from "../../styles/necromancy/conjures";
import { capabilitiesOf } from "../../shared/damageProvenance";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";
import { landTimeModifiers } from "./modifiers";
import { packageCritical, type AttachedDamageComponent, type EventResolution } from "./types";
import { dynamicEquipmentCritBonus } from "../../shared/equipment";
import { activeBleedCount } from "../../styles/melee/effects";

/**
 * Resolve one ordinary cast hit at its land tick. Time-windowed globals read
 * state at that tick; the cast snapshot carries the next-hit crit layers (first
 * eligible hit only), Chaos Roar's channel rule, empowerment, and Searing Winds'
 * cast-time eligibility.

 * The Searing Winds bonus is an ATTACHED component of this hit - never a
 * separate event - so it cannot inflate proc rolls, stacks, or hit counters.
 */
export function resolveCastHit(
  rt: SimulationRuntime,
  at: number,
  hitSpec: AbilityHit,
  hitIndex: number,
  ability: AbilitySpec,
  snap: CastSnapshot,
  isDot: boolean,
  convertedChannel = false,
): EventResolution {
  const { input, state } = rt;
  const modifiers = landTimeModifiers(
    rt,
    at,
    ability,
    snap,
    hitIndex,
    isDot,
    convertedChannel,
    hitSpec.dotKind,
  );

  const firstEligible = hitIndex === snap.firstEligibleHitIndex;
  const equipmentCrit = dynamicEquipmentCritBonus(
    input.equipmentEffects,
    ability,
    hitIndex,
    activeBleedCount(state.target.melee, at),
  );
  // Concentrated Blast's own hits read the live accumulating stacks; every
  // other magic cast consumed them at cast time (baked into snap.critLayers).
  const liveConcChance =
    ability.style === "magic" && isConcentratedBlast(ability.id)
      ? (state.magic.concCritStacks * state.magic.concCritPerStackPct) / 100
      : 0;
  const crit: CritLayers = {
    ...snap.critLayers,
    eligible: hitSpec.critEligible ?? true,
    chance:
      snap.critLayers.chance +
      liveConcChance +
      (ability.style === "magic" && input.tumekensCritEnabled !== false
        ? tumekensSunshineCritChance(
            input.tumekensPieces ?? 0,
            state.magic.sunshine,
            at,
            snap.castSeq,
          )
        : 0) +
      (firstEligible && snap.furyActive ? FURY_CRIT_CHANCE_BONUS : 0) +
      equipmentCrit.chance,
    guaranteed: snap.critLayers.guaranteed || (firstEligible && snap.greaterFuryActive),
    damageBonus:
      (snap.critLayers.damageBonus ?? 0) +
      (ability.style === "magic" ? channelledMightCritBonus(state.magic.channelledMight, at) : 0) +
      equipmentCrit.damageBonus,
  };

  // Command abilities are part of the conjure: full Damage Potential, the
  // conjure-eligible modifier set (never prayers), and for the skeleton the
  // live rage multiplier at the land tick (wiki, verified 2026-07-31).
  const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
  let band = hitSpec.band;
  if (ability.id === "command_skeleton_warrior") {
    const spirit = findConjure(state.necromancy.conjures, "skeleton_warrior");
    const mult = skeletonRageMult(spirit?.rageStacks ?? 0);
    if (mult !== 1) band = { minPct: band.minPct * mult, maxPct: band.maxPct * mult };
  }
  const damageSource: "command" | "dot" | "direct" = isCommand
    ? "command"
    : isDot
      ? "dot"
      : "direct";
  const provenance = isCommand
    ? { kind: "conjure_command" as const }
    : isDot
      ? { kind: "player_dot" as const, detail: hitSpec.dotKind ?? hitSpec.bleedId }
      : ability.autoAttack
        ? { kind: "player_auto" as const }
        : { kind: "player_direct" as const };
  const hitContext: import("../../types").CombatContext = {
    ...input.context,
    style: ability.style,
    dotKind: hitSpec.dotKind,
    abilityCategory: ability.category,
    autoAttack: ability.autoAttack,
    area: ability.area,
    damageSource,
    provenance,
  };
  const hit = calculateHit({
    base: input.base,
    band,
    level: input.level,
    accuracy: isCommand ? CONJURE_DAMAGE_POTENTIAL : input.accuracy,
    crit,
    modifiers: isCommand ? conjureEligibleModifiers(modifiers) : modifiers,
    provenance,
    context: hitContext,
    cap: input.cap,
    preciseRank: input.preciseRank,
  });

  const components: AttachedDamageComponent[] = [];
  if (snap.searingWindsAtCast) {
    // Attached kind: canTriggerProcs false. On-hit gear only when parent is direct-hit
    // family (Corruption Shot DoT ticks must not gain Slayer/Salve via SW).
    const attachedProv = { kind: "attached" as const, detail: "searing_winds" };
    const bonusProv = capabilitiesOf(provenance).onHitGear ? attachedProv : provenance;
    const bonus = calculateHit({
      base: input.base,
      band: { minPct: SEARING_WINDS_BONUS_HIT_PCT, maxPct: SEARING_WINDS_BONUS_HIT_PCT },
      level: input.level,
      accuracy: input.accuracy,
      crit: { chance: 0, eligible: false },
      modifiers,
      provenance: bonusProv,
      context: {
        ...hitContext,
        damageSource,
        provenance: bonusProv,
      },
      cap: input.cap,
    });
    components.push({
      id: "searing_winds",
      damage: {
        min: bonus.min,
        max: bonus.max,
        expected: bonus.expected,
        critExpected: bonus.critExpected,
        capLoss: bonus.capLoss,
        critical: packageCritical(bonus.critChance, bonus.critExpected, bonus.nonCritExpected),
      },
      hitDetail: bonus,
      attached: true,
      hitCapPolicy: "separate",
    });
  }

  let min = hit.min;
  let max = hit.max;
  let expected = hit.expected;
  let capLoss = hit.capLoss;
  let critExpected = hit.critExpected;
  for (const c of components) {
    min += c.damage.min;
    max += c.damage.max;
    expected += c.damage.expected;
    capLoss += c.damage.capLoss ?? 0;
    critExpected += c.damage.expected;
  }

  return {
    damage: {
      min,
      max,
      expected,
      critExpected,
      capLoss,
      critical: packageCritical(hit.critChance, hit.critExpected, hit.nonCritExpected),
    },
    hitDetail: hit,
    ...(components.length > 0 ? { components } : {}),
  };
}
