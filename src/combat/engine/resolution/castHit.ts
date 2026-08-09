import type { CritLayers } from "../../core/critical";
import type { AbilityHit, AbilitySpec } from "../../pipeline/calculateAbility";
import {
  calculateHit,
  calculateNonCriticalHitDistribution,
  type ExactDamageDistribution,
  type HitResult,
} from "../../pipeline/calculateHit";
import { TUSKAS_EMPOWERED_HIT_CAP } from "../../styles/shared/constitutionAbilities";
import { FURY_CRIT_CHANCE_BONUS } from "../../styles/melee/effects";
import {
  channelledMightCritBonus,
  isConcentratedBlast,
  sunshineActive,
} from "../../styles/magic/effects";
import { SEARING_WINDS_BONUS_HIT_PCT } from "../../styles/ranged/onHit";
import { resolveRangedAmmunitionHitEffects } from "../../styles/ranged/ammunitionPayloads";
import { dracolichInfusionCritChance } from "../../styles/ranged/dracolich";
import {
  COMMAND_REQUIRES_CONJURE,
  conjureEligibleModifiers,
  findConjure,
  skeletonRageMult,
} from "../../styles/necromancy/conjures";
import {
  hauntedActive,
  hauntedBonusDamage,
  hauntedParentDamage,
} from "../../styles/necromancy/haunted";
import {
  capabilitiesOf,
  outgoingSourceOf,
  provenanceForCastHit,
} from "../../shared/damageProvenance";
import { isBasicAttack } from "../../shared/adrenalineGain";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";
import { landTimeModifiers } from "./modifiers";
import {
  packageCritical,
  type AttachedDamageComponent,
  type EventResolution,
  type ResolvedDamage,
} from "./types";
import { SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION } from "../../styles/magic/effects";
import { dynamicEquipmentCritBonus } from "../../shared/equipment";
import { activeBleedCount } from "../../styles/melee/effects";
import { activeFrostbladesMass } from "../../styles/melee/primordialIce";
import { hitReuseGet, hitReuseSet, isHitReuseActive } from "./hitReuse";
import { landHitIdentity } from "./landHitIdentity";
import { resolveEffectiveCombatLevel } from "../../core/effectiveLevel";
import { NARAGI_LEVEL_OVERRIDE } from "../../league/naragiEdict";
import {
  attachedResolutionComponent,
  resolveLeagueAttachedHost,
  resolveLeagueAttachedRawHost,
} from "../../league/damage";
import { recordResolutionCache } from "../../profiling/hitPipeline";
import { resolveLeagueCritAtLand } from "../../league/ruleset";
import { liveTargetDamagePotential as resolveLiveTargetDamagePotential } from "../../target/genericTarget";

/** Style level at land tick: temporary override (e.g. Naragi 255) wins when active. */
function combatLevelAt(rt: SimulationRuntime, landTick: number): number {
  return resolveEffectiveCombatLevel(rt.input.level, rt.state.player?.levelOverride, landTick);
}

/** Base AD at land tick: use overrideBase when effective level is the override level. */
function combatBaseAt(rt: SimulationRuntime, landTick: number, level: number): number {
  const overrideLevel = rt.input.overrideLevel ?? NARAGI_LEVEL_OVERRIDE;
  if (
    rt.input.overrideBase != null &&
    level === overrideLevel &&
    rt.state.player?.levelOverride &&
    landTick < rt.state.player.levelOverride.untilTick
  ) {
    return rt.input.overrideBase;
  }
  return rt.input.base;
}

export function abilityDamageAt(rt: SimulationRuntime, landTick: number): number {
  const level = combatLevelAt(rt, landTick);
  return combatBaseAt(rt, landTick, level);
}

function mix(a: number, b: number, weight: number): number {
  return a + (b - a) * weight;
}

function mixHit(a: HitResult, b: HitResult, weight: number): HitResult {
  return {
    potential: a.potential,
    min: mix(a.min, b.min, weight),
    max: mix(a.max, b.max, weight),
    critMin: mix(a.critMin, b.critMin, weight),
    critMax: mix(a.critMax, b.critMax, weight),
    critChance: a.critChance,
    critDamageBonus: mix(a.critDamageBonus ?? 0, b.critDamageBonus ?? 0, weight),
    nonCritExpected: mix(a.nonCritExpected, b.nonCritExpected, weight),
    critExpected: mix(a.critExpected, b.critExpected, weight),
    expected: mix(a.expected, b.expected, weight),
    uncappedExpected: mix(a.uncappedExpected, b.uncappedExpected, weight),
    capLoss: mix(a.capLoss, b.capLoss, weight),
  };
}

function mixDamage(a: ResolvedDamage, b: ResolvedDamage, weight: number): ResolvedDamage {
  return {
    min: mix(a.min, b.min, weight),
    max: mix(a.max, b.max, weight),
    expected: mix(a.expected, b.expected, weight),
    ...(a.critExpected !== undefined || b.critExpected !== undefined
      ? { critExpected: mix(a.critExpected ?? a.expected, b.critExpected ?? b.expected, weight) }
      : {}),
    ...(a.capLoss !== undefined || b.capLoss !== undefined
      ? { capLoss: mix(a.capLoss ?? 0, b.capLoss ?? 0, weight) }
      : {}),
    ...(a.critical && b.critical
      ? {
          critical: {
            ...a.critical,
            contribution: mix(a.critical.contribution, b.critical.contribution, weight),
          },
        }
      : a.critical
        ? { critical: a.critical }
        : b.critical
          ? { critical: b.critical }
          : {}),
  };
}

function mixComponents(
  a: readonly AttachedDamageComponent[] | undefined,
  b: readonly AttachedDamageComponent[] | undefined,
  weight: number,
): readonly AttachedDamageComponent[] | undefined {
  if (!a && !b) return undefined;
  const left = a ?? [];
  const right = b ?? [];
  return left.map((component, index) => {
    const other = right[index] ?? component;
    return {
      ...component,
      damage: mixDamage(component.damage, other.damage, weight),
      ...(component.hitDetail && other.hitDetail
        ? { hitDetail: mixHit(component.hitDetail, other.hitDetail, weight) }
        : {}),
    };
  });
}

function mixResolution(a: EventResolution, b: EventResolution, weight: number): EventResolution {
  const components = mixComponents(a.components, b.components, weight);
  return {
    damage: mixDamage(a.damage, b.damage, weight),
    ...(a.hitDetail && b.hitDetail ? { hitDetail: mixHit(a.hitDetail, b.hitDetail, weight) } : {}),
    ...(components ? { components } : {}),
    ...(a.sourcePrecritDistribution
      ? { sourcePrecritDistribution: a.sourcePrecritDistribution }
      : b.sourcePrecritDistribution
        ? { sourcePrecritDistribution: b.sourcePrecritDistribution }
        : {}),
  };
}

function sourceDistributionForPerfectEquilibrium(args: {
  ability: AbilitySpec;
  snap: CastSnapshot;
  isDot: boolean;
  convertedChannel: boolean;
  provenance: ReturnType<typeof provenanceForCastHit>;
}): boolean {
  if (args.ability.style !== "ranged" || args.isDot || args.convertedChannel) return false;
  const capabilities = capabilitiesOf(args.provenance);
  return (
    (args.snap.perfectEquilibriumAtCast &&
      capabilities.canGeneratePerfectEquilibrium === true) ||
    (args.ability.id === "balance_by_force" && args.snap.perfectEquilibriumTrigger === true)
  );
}

function validatePerfectEquilibriumSourceDistribution(
  distribution: readonly ExactDamageDistribution[],
  source: HitResult,
): void {
  const weight = distribution.reduce((total, outcome) => total + outcome.weight, 0);
  const min = distribution[0]?.damage;
  const max = distribution[distribution.length - 1]?.damage;
  const tolerance = Math.max(1e-9, Math.abs(source.nonCritExpected) * 1e-9);
  if (
    !Number.isFinite(weight) ||
    Math.abs(weight - 1) > 1e-9 ||
    min !== source.min ||
    max !== source.max ||
    Math.abs(
      distribution.reduce((total, outcome) => total + outcome.damage * outcome.weight, 0) -
        source.nonCritExpected,
    ) > tolerance
  ) {
    throw new Error("Perfect Equilibrium source distribution diverged from source hit");
  }
}

/**
 * Resolve one ordinary cast hit at its land tick. Time-windowed globals read
 * state at that tick; the cast snapshot carries the next-hit crit layers (first
 * eligible hit only), Chaos Roar's channel rule, empowerment, and Searing Winds
 * cast-time eligibility. Haunted is land-time; SW remains cast-time.

 * Searing Winds and Haunted bonuses are ATTACHED components of this hit - never
 * separate events - so they cannot inflate proc rolls, stacks, or hit counters.
 * Haunted is % of full-accuracy parent post-resolve (cap 20% AD), never re-applied
 * on attached.
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
  if (isHitReuseActive()) {
    const key = landHitIdentity(rt, at, hitSpec, hitIndex, ability, snap, isDot, convertedChannel);
    const cached = hitReuseGet(key);
    if (cached) {
      recordResolutionCache(true);
      return cached;
    }
    recordResolutionCache(false);
    const resolved = resolveCastHitUncached(
      rt,
      at,
      hitSpec,
      hitIndex,
      ability,
      snap,
      isDot,
      convertedChannel,
    );
    hitReuseSet(key, resolved);
    return resolved;
  }
  return resolveCastHitUncached(rt, at, hitSpec, hitIndex, ability, snap, isDot, convertedChannel);
}

function resolveCastHitUncached(
  rt: SimulationRuntime,
  at: number,
  hitSpec: AbilityHit,
  hitIndex: number,
  ability: AbilitySpec,
  snap: CastSnapshot,
  isDot: boolean,
  convertedChannel: boolean,
  frostbladesActive?: boolean,
): EventResolution {
  const { input, state } = rt;
  const frostMass = activeFrostbladesMass(state.melee.primordialIce, at);
  if (
    frostbladesActive === undefined &&
    frostMass > 0 &&
    frostMass < 1 &&
    ability.style === "melee" &&
    !isDot
  ) {
    const inactive = resolveCastHitUncached(
      rt,
      at,
      hitSpec,
      hitIndex,
      ability,
      snap,
      isDot,
      convertedChannel,
      false,
    );
    const active = resolveCastHitUncached(
      rt,
      at,
      hitSpec,
      hitIndex,
      ability,
      snap,
      isDot,
      convertedChannel,
      true,
    );
    return mixResolution(inactive, active, frostMass);
  }
  const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
  const provenance = provenanceForCastHit({
    isCommand,
    isDot,
    convertedChannel,
    dotKind: hitSpec.dotKind,
    bleedId: hitSpec.bleedId,
  });
  const modifiers = landTimeModifiers(
    rt,
    at,
    ability,
    snap,
    hitIndex,
    isDot,
    convertedChannel,
    hitSpec.dotKind,
    frostbladesActive,
    provenance,
  );

  const firstEligible = hitIndex === snap.firstEligibleHitIndex;
  const equipmentCrit = dynamicEquipmentCritBonus(
    input.equipmentEffects,
    ability,
    hitIndex,
    activeBleedCount(state.target.melee, at),
  );
  const dracolichCrit =
    ability.style === "ranged"
      ? dracolichInfusionCritChance(state.ranged.dracolichInfusion, at)
      : 0;
  // Concentrated Blast's own hits read the live accumulating stacks; every
  // other magic cast consumed them at cast time (baked into snap.critLayers).
  const liveConcChance =
    ability.style === "magic" && isConcentratedBlast(ability.id)
      ? (state.magic.concCritStacks * state.magic.concCritPerStackPct) / 100
      : 0;
  const rawCrit: CritLayers = {
    ...snap.critLayers,
    eligible: hitSpec.critEligible ?? true,
    chance:
      snap.critLayers.chance +
      liveConcChance +
      (ability.style === "magic" &&
      state.magic.sunshine.grantedByCast !== snap.castSeq &&
      sunshineActive(state.magic.sunshine, at)
        ? (input.equipmentEffects?.setCritChance?.conditional.sunshine ?? 0)
        : 0) +
      (firstEligible && snap.furyActive ? FURY_CRIT_CHANCE_BONUS : 0) +
      equipmentCrit.chance +
      dracolichCrit,
    guaranteed: snap.critLayers.guaranteed || (firstEligible && snap.greaterFuryActive),
    damageBonus:
      (snap.critLayers.damageBonus ?? 0) +
      (ability.style === "magic" ? channelledMightCritBonus(state.magic.channelledMight, at) : 0) +
      equipmentCrit.damageBonus,
  };
  const crit = resolveLeagueCritAtLand(input.league, rawCrit);

  // Command abilities are part of the conjure: full Damage Potential, the
  // conjure-eligible modifier set (never prayers), and for the skeleton the
  // live rage multiplier at the land tick (wiki, verified 2026-07-31).
  let band = hitSpec.band;
  if (ability.id === "command_skeleton_warrior") {
    const spirit = findConjure(state.necromancy.conjures, "skeleton_warrior");
    const mult = skeletonRageMult(spirit?.rageStacks ?? 0);
    if (mult !== 1) band = { minPct: band.minPct * mult, maxPct: band.maxPct * mult };
  }
  const targetVitality = state.target.vitality;
  const targetHealthFraction =
    targetVitality && targetVitality.maximumLifePoints > 0
      ? targetVitality.currentLifePoints / targetVitality.maximumLifePoints
      : null;
  const ammunition = resolveRangedAmmunitionHitEffects({
    ammunition: input.ammunition,
    style: ability.style,
    provenance,
    attackOrigin: "player",
    attackKind: "ability",
    targetClassification: input.targetClassification,
    targetHealthFraction,
  });
  if (ammunition.maximumHitBandFraction > 0) {
    band = {
      minPct: band.minPct,
      maxPct: band.maxPct + ammunition.maximumHitBandFraction * 100,
    };
  }
  const targetDamagePotentialBeforeAmmunition = input.targetAccuracyProfile
    ? resolveLiveTargetDamagePotential(input.targetAccuracyProfile, {
        ...(state.target.blackStone
          ? {
              blackStone: {
                state: state.target.blackStone,
                currentTick: at,
              },
            }
          : {}),
        equipmentEffects: input.equipmentEffects,
      })
    : input.accuracy;
  const effectiveAccuracy =
    ammunition.damagePotentialDelta === 0
      ? targetDamagePotentialBeforeAmmunition
      : Math.max(
          0,
          Math.min(1, targetDamagePotentialBeforeAmmunition + ammunition.damagePotentialDelta),
        );
  // Wiki hit chance: conjures/commands and Sunshine / Greater Sunshine zone DoT
  // bypass hit chance (full Damage Potential). https://runescape.wiki/w/Hit_chance
  const hitAccuracy =
    isCommand || ability.id === "sunshine" || ability.id === "greater_sunshine"
      ? 1
      : effectiveAccuracy;
  const damageSource = outgoingSourceOf(provenance);
  const hitContext: import("../../types").CombatContext = {
    ...input.context,
    style: ability.style,
    dotKind: hitSpec.dotKind,
    abilityCategory: ability.category,
    basicAttack: isBasicAttack(ability),
    area: ability.area,
    damageSource,
    provenance,
  };
  const level = combatLevelAt(rt, at);
  const base = combatBaseAt(rt, at, level);
  // Tuska on-task: flat 100x Slayer (15k cap); keep only Havoc's global final multiplier.
  // https://runescape.wiki/w/Tuska%27s_Wrath
  const tuskaFinalModifiers = modifiers.filter(
    (modifier) => modifier.id === "blessing:havoc-born" && modifier.stage === "postHit",
  );
  const host =
    snap.tuskasEmpoweredDamage != null
      ? resolveLeagueAttachedRawHost({
          rules: input.league,
          source: provenance,
          landTick: at,
          abilityBase: base,
          min: snap.tuskasEmpoweredDamage,
          max: snap.tuskasEmpoweredDamage,
          level,
          accuracy: 1,
          crit: { chance: 0, eligible: false },
          modifiers: tuskaFinalModifiers,
          context: hitContext,
          cap: { cap: TUSKAS_EMPOWERED_HIT_CAP },
        })
      : resolveLeagueAttachedHost({
          rules: input.league,
          source: provenance,
          landTick: at,
          base,
          band,
          level,
          accuracy: hitAccuracy,
          crit,
          ...(snap.surgingStormAtCast
            ? { critDamageDistribution: SURGING_STORM_CRIT_DAMAGE_DISTRIBUTION }
            : {}),
          modifiers: isCommand ? conjureEligibleModifiers(modifiers) : modifiers,
          context: hitContext,
          cap: input.cap,
          preciseRank: input.preciseRank,
        });
  const hit = host.baseHit;

  const sourcePrecritDistribution = sourceDistributionForPerfectEquilibrium({
    ability,
    snap,
    isDot,
    convertedChannel,
    provenance,
  })
    ? calculateNonCriticalHitDistribution({
        base,
        band,
        level,
        accuracy: hitAccuracy,
        crit: { ...crit, chance: 0, guaranteed: false, eligible: false },
        modifiers: isCommand ? conjureEligibleModifiers(modifiers) : modifiers,
        context: hitContext,
        provenance,
        cap: input.cap,
        preciseRank: input.preciseRank,
      })
    : undefined;
  if (sourcePrecritDistribution) {
    validatePerfectEquilibriumSourceDistribution(sourcePrecritDistribution, hit);
  }

  const components: AttachedDamageComponent[] = host.components.map((component) =>
    attachedResolutionComponent(component),
  );
  if (snap.searingWindsAtCast) {
    // Attached kind: canTriggerProcs false. On-hit gear only when parent is direct-hit
    // family (Corruption Shot DoT ticks must not gain Slayer/Salve via SW).
    const attachedProv = { kind: "attached" as const, detail: "searing_winds" };
    const bonusProv = capabilitiesOf(provenance).onHitGear ? attachedProv : provenance;
    const bonus = calculateHit({
      base,
      band: { minPct: SEARING_WINDS_BONUS_HIT_PCT, maxPct: SEARING_WINDS_BONUS_HIT_PCT },
      level,
      accuracy: targetDamagePotentialBeforeAmmunition,
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
  // Haunted: land-time; 10% of full-accuracy parent, cap 20% of live cap AD.
  // Only the parent hit - never re-apply on attached components (SW / Haunted itself).
  const haunted = state.target.haunted;
  if (hauntedActive(haunted, at)) {
    const capAD = haunted.capAbilityDamage;
    const pot = hit.potential;
    const bonusMin = hauntedBonusDamage(hauntedParentDamage(hit.min, pot), capAD);
    const bonusMax = hauntedBonusDamage(hauntedParentDamage(hit.max, pot), capAD);
    const bonusExpected = hauntedBonusDamage(hauntedParentDamage(hit.expected, pot), capAD);
    if (bonusMax > 0 || bonusExpected > 0) {
      components.push({
        id: "haunted",
        damage: {
          min: bonusMin,
          max: bonusMax,
          expected: bonusExpected,
        },
        attached: true,
        hitCapPolicy: "separate",
      });
    }
  }

  let min = host.hit.min;
  let max = host.hit.max;
  let expected = host.hit.expected;
  let capLoss = host.hit.capLoss;
  let critExpected = host.hit.critExpected;
  for (const c of components) {
    if (c.hitCapPolicy === "shared") continue;
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
      critical: packageCritical(
        host.hit.critChance,
        host.hit.critExpected,
        host.hit.nonCritExpected,
      ),
    },
    hitDetail: hit,
    ...(components.length > 0 ? { components } : {}),
    ...(sourcePrecritDistribution ? { sourcePrecritDistribution } : {}),
  };
}
