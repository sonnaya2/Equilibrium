import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { damagePotential } from "../../core/damagePotential";
import { mulFloor } from "../../core/rounding";
import type { CritLayers } from "../../core/critical";
import { MODERNISATION_WIKI } from "../../data/sources";
import type { CombatModifier } from "../../types";
import { dynamicEquipmentCritBonus } from "../../shared/equipment";
import { outgoingSourceOf } from "../../shared/damageProvenance";
import { liveTargetDamagePotential } from "../../target/genericTarget";
import {
  resolveRangedAmmunitionHitEffects,
  type ResolvedRangedAmmunitionHitEffects,
} from "../../styles/ranged/ammunitionPayloads";
import {
  perfectEquilibriumHitEligible,
  recordPerfectEquilibriumHit,
  resolvePerfectEquilibriumDamage,
  type PerfectEquilibriumSourceOutcome,
} from "../../styles/ranged/botlg";
import { dracolichInfusionCritChance } from "../../styles/ranged/dracolich";
import { shadowImbuedAdrenalinePerHit } from "../../styles/ranged/onHit";
import { balanceByForceActive } from "../../styles/ranged/effects";
import { activeBleedCount } from "../../styles/melee/effects";
import { resolveLeagueCritAtLand } from "../../league/ruleset";
import { landTimeModifiers } from "./modifiers";
import { applyRangedAmmunitionLandedState } from "./landed/ranged";
import { packageCritical, type EventResolution, type ResolvedDamage } from "./types";
import type { ScheduledEvent } from "../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../runtime/runtime";
import { gainAdrenaline, patchRanged } from "../runtime/state";
import type { CastSnapshot } from "../cast/snapshot";
import { recordAppliedEventEffect } from "./accounting";

const PERFECT_EQUILIBRIUM_ABILITY: AbilitySpec = {
  id: "perfect_equilibrium",
  name: "Perfect Equilibrium",
  style: "ranged",
  category: "basic",
  hits: [],
};

const BOTLG_PROVENANCE = { kind: "botlg_perfect_equilibrium" as const };

function emptyPerfectEquilibriumSnapshot(baseMods: CombatModifier[]): CastSnapshot {
  return {
    castSeq: -1,
    critLayers: { chance: 0, guaranteed: false, eligible: false },
    baseMods,
    chaosRoarActive: false,
    channelled: false,
    greaterFuryActive: false,
    furyActive: false,
    firstEligibleHitIndex: 0,
    empowerMult: 1,
    searingWindsAtCast: false,
    hauntedAtCast: false,
    hauntedCapAd: 0,
    enduringRuinBonus: 0,
    magicWeaponAtCast: false,
    surgingStormAtCast: false,
    ashenVowAtCast: false,
    igneousShowdownRepeat: false,
    perfectEquilibriumAtCast: false,
    perfectEquilibriumTrigger: false,
    wenIcyPrecisionDamageAtCast: false,
    wenIcyPrecisionDamagePotentialAtCast: false,
    songEmpowered: false,
    songConflagrateActive: false,
    songTwoPieceActive: false,
    songPreCastStacks: 0,
  };
}

function targetHealthFraction(rt: SimulationRuntime): number | null {
  const vitality = rt.state.target.vitality;
  if (!vitality || vitality.maximumLifePoints <= 0) return null;
  return vitality.currentLifePoints / vitality.maximumLifePoints;
}

function ammunitionForPerfectEquilibrium(
  rt: SimulationRuntime,
): ResolvedRangedAmmunitionHitEffects {
  return resolveRangedAmmunitionHitEffects({
    ammunition: rt.input.ammunition,
    style: "ranged",
    provenance: BOTLG_PROVENANCE,
    attackOrigin: "botlg",
    attackKind: "ability",
    targetClassification: rt.input.targetClassification,
    targetHealthFraction: targetHealthFraction(rt),
  });
}

function perfectEquilibriumCrit(rt: SimulationRuntime, at: number): CritLayers {
  const equipmentCrit = dynamicEquipmentCritBonus(
    rt.input.equipmentEffects,
    PERFECT_EQUILIBRIUM_ABILITY,
    0,
    activeBleedCount(rt.state.target.melee, at),
  );
  return resolveLeagueCritAtLand(rt.input.league, {
    ...rt.input.crit,
    chance:
      rt.input.crit.chance +
      equipmentCrit.chance +
      dracolichInfusionCritChance(rt.state.ranged.dracolichInfusion, at),
    damageBonus: (rt.input.crit.damageBonus ?? 0) + equipmentCrit.damageBonus,
    eligible: true,
  });
}

function resolvePerfectEquilibrium(
  rt: SimulationRuntime,
  event: Pick<ScheduledEvent<SimulationRuntime>, "tick">,
  sourcePrecritDistribution: readonly PerfectEquilibriumSourceOutcome[],
): EventResolution {
  const ammunition = ammunitionForPerfectEquilibrium(rt);
  const band = {
    minPct: 12,
    maxPct: 16 + ammunition.maximumHitBandFraction * 100,
  };
  const targetDamagePotentialBeforeAmmunition = rt.input.targetAccuracyProfile
    ? liveTargetDamagePotential(rt.input.targetAccuracyProfile, {
        ...(rt.state.target.blackStone
          ? {
              blackStone: {
                state: rt.state.target.blackStone,
                currentTick: event.tick,
              },
            }
          : {}),
        equipmentEffects: rt.input.equipmentEffects,
      })
    : rt.input.accuracy;
  const effectiveAccuracy = Math.max(
    0,
    Math.min(1, targetDamagePotentialBeforeAmmunition + ammunition.damagePotentialDelta),
  );
  const context = {
    ...(rt.input.context ?? { style: "ranged" as const }),
    style: "ranged" as const,
    damageSource: outgoingSourceOf(BOTLG_PROVENANCE),
    provenance: BOTLG_PROVENANCE,
  };
  const modifiers = landTimeModifiers(
    rt,
    event.tick,
    PERFECT_EQUILIBRIUM_ABILITY,
    emptyPerfectEquilibriumSnapshot(
      typeof rt.input.modifiers === "function"
        ? rt.input.modifiers(PERFECT_EQUILIBRIUM_ABILITY)
        : [...(rt.input.modifiers ?? [])],
    ),
    0,
    false,
    false,
    undefined,
    undefined,
    BOTLG_PROVENANCE,
  );
  const postAmmunitionModifier: CombatModifier | undefined =
    ammunition.sourceHitMultiplier !== 1
      ? {
          id: `ammunition:${ammunition.mechanicId}:perfect-equilibrium`,
          stage: "onHit",
          priority: 30,
          applies: (context) =>
            context.style === "ranged" && context.provenance?.kind === BOTLG_PROVENANCE.kind,
          apply: (state) => ({
            ...state,
            damage: mulFloor(state.damage, ammunition.sourceHitMultiplier),
          }),
          source: MODERNISATION_WIKI,
        }
      : undefined;
  const resolved = resolvePerfectEquilibriumDamage({
    abilityDamage: rt.input.base,
    abilityDamageBand: band,
    sourcePrecritDistribution,
    level: rt.input.level,
    accuracy: effectiveAccuracy,
    crit: perfectEquilibriumCrit(rt, event.tick),
    context,
    postModifiers: [...modifiers, ...(postAmmunitionModifier ? [postAmmunitionModifier] : [])],
    cap: rt.input.cap,
  });
  const damage: ResolvedDamage = {
    min: resolved.combined.min,
    max: resolved.combined.max,
    expected: resolved.expected,
    critExpected: resolved.critExpected,
    capLoss: resolved.capLoss,
    critical: packageCritical(resolved.critChance, resolved.critExpected, resolved.nonCritExpected),
  };
  return {
    damage,
    hitDetail: {
      potential: damagePotential(effectiveAccuracy),
      min: resolved.combined.min,
      max: resolved.combined.max,
      critMin: resolved.critMin,
      critMax: resolved.critMax,
      critChance: resolved.critChance,
      critDamageBonus: resolved.critDamageBonus,
      nonCritExpected: resolved.nonCritExpected,
      critExpected: resolved.critExpected,
      expected: resolved.expected,
      uncappedExpected: resolved.uncappedExpected,
      capLoss: resolved.capLoss,
    },
  };
}

function schedulePerfectEquilibrium(
  rt: SimulationRuntime,
  parent: ScheduledEvent<SimulationRuntime>,
  sourcePrecritDistribution: readonly PerfectEquilibriumSourceOutcome[],
): void {
  const child = {
    tick: parent.tick,
    family: "hit" as const,
    abilityId: "perfect_equilibrium",
    sourceCast: -1,
    hitIndex: 0,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    derivedFrom: parent.seq,
    originKind: "direct" as const,
    provenance: BOTLG_PROVENANCE,
    expectedOccurrences: 1,
    expectedTriggerRolls: 0,
    expectedActivations: 1,
    expectedSeparateHits: 1,
    combatStyle: "ranged" as const,
    resourceEligible: false,
  };
  scheduleEvent(rt, {
    ...child,
    resolve: (eventRt) => resolvePerfectEquilibrium(eventRt, child, sourcePrecritDistribution),
  });
}

function parentStyle(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): "melee" | "ranged" | "magic" | "necromancy" {
  return (
    event.combatStyle ?? rt.byId.get(event.abilityId)?.style ?? rt.input.context?.style ?? "ranged"
  );
}

function recordPerfectEquilibriumState(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  recordAppliedEventEffect(rt, event, {
    id: "perfect_equilibrium",
    stackCount: rt.state.ranged.perfectEquilibriumStacks,
  });
  const balance = rt.state.ranged.balanceByForce;
  if (balanceByForceActive(balance, event.tick)) {
    recordAppliedEventEffect(rt, event, {
      id: "balance_by_force",
      remainingTicks: balance.expiresAtTick - event.tick,
    });
  }
}

export function applyBotlgLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  if (event.provenance.kind === "botlg_perfect_equilibrium") {
    const perHit = shadowImbuedAdrenalinePerHit(rt.state.ranged.shadowImbued, event.tick);
    if (perHit > 0) rt.state = gainAdrenaline(rt.state, perHit);
    applyRangedAmmunitionLandedState(rt, event, resolution.damage, "botlg");
    recordPerfectEquilibriumState(rt, event);
    return;
  }
  const source = resolution.sourcePrecritDistribution;
  const style = parentStyle(rt, event);
  const provenance = event.provenance;
  if (
    !source ||
    event.attached ||
    (event.family !== "hit" && !perfectEquilibriumHitEligible({ style, provenance }))
  ) {
    return;
  }

  const forcedBalance =
    event.abilityId === "balance_by_force" && event.castSnap?.perfectEquilibriumTrigger === true;
  if (forcedBalance) {
    schedulePerfectEquilibrium(rt, event, source);
    recordPerfectEquilibriumState(rt, event);
    return;
  }

  const snap = event.castSnap;
  if (!snap?.perfectEquilibriumAtCast || !perfectEquilibriumHitEligible({ style, provenance })) {
    return;
  }
  const result = recordPerfectEquilibriumHit(rt.state.ranged, {
    style,
    provenance,
    tick: event.tick,
  });
  rt.state = patchRanged(rt.state, { perfectEquilibriumStacks: result.stacks });
  if (result.triggered) schedulePerfectEquilibrium(rt, event, source);
  recordPerfectEquilibriumState(rt, event);
}
