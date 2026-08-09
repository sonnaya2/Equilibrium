import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import {
  extendSearingWinds,
  onRangedHit,
  shadowImbuedAdrenalinePerHit,
} from "../../../styles/ranged/onHit";
import {
  applyPunctureStack,
  PUNCTURE_ABILITY_ID,
  PUNCTURE_FIRST_OFFSET_AFTER_FINISH,
  PUNCTURE_HIT_PERCENTS,
  punctureHitDamage,
  punctureSequenceTicks,
} from "../../../styles/ranged/puncture";
import type { ResolvedDamage } from "../types";
import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import { gainAdrenaline, patchRanged, patchTarget } from "../../runtime/state";
import { dracolichAdrenalinePerRapidFireHit } from "../../../styles/ranged/dracolich";
import { attachedResolutionComponent, resolveLeagueAttachedRawHost } from "../../../league/damage";
import { targetAndPostHitModifiers } from "../modifiers";
import {
  isAmmunitionHitEligible,
  type AmmunitionAttackOrigin,
} from "../../../styles/ranged/ammunitionEligibility";
import {
  applyBlackStoneArmourReduction,
  newBlackStoneArmourState,
  resetBlackStoneOnTargetDeath,
} from "../../../styles/ranged/blackStone";
import { enchantedBoltActivationChance } from "../../../styles/ranged/enchantedBolt";
import {
  activateBoltDeathmark,
  BOLT_DEATHMARK_ACTIVATION_ADRENALINE,
} from "../../../styles/ranged/enchantedBoltRuntime";
import { resolveRangedAmmunitionHitEffects } from "../../../styles/ranged/ammunitionPayloads";
import { ammunitionAppliedEffectId } from "../../../styles/ranged/ammunitionEffects";
import { recordWenBasicHit, wenBasicHitEligible } from "../../../styles/ranged/wen";
import { recordAppliedEventEffect } from "../accounting";

function mayActivateBoltDeathmark(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
  attackOrigin: AmmunitionAttackOrigin,
): boolean {
  const mechanicId = rt.input.ammunition?.projectile?.mechanicId;
  if (mechanicId !== "hydrix" && mechanicId !== "ascendri") return false;
  if (damage.max <= 0) return false;
  if (
    !isAmmunitionHitEligible({
      style: "ranged",
      provenance: event.provenance,
      attackOrigin,
    })
  ) {
    return false;
  }
  const chance = enchantedBoltActivationChance(
    mechanicId,
    rt.input.enchantedBoltChanceModifiers,
  );
  return chance != null && rt.stochastic.bernoulli(`ammunition:deathmark:${event.seq}`, chance);
}

function mayApplyPuncture(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
  attackOrigin: AmmunitionAttackOrigin,
): boolean {
  if (rt.input.ammunition?.projectile?.mechanicId !== "splintering") return false;
  if (event.abilityId === PUNCTURE_ABILITY_ID) return false;
  if (damage.max <= 0) return false;
  return isAmmunitionHitEligible({
    style: "ranged",
    provenance: event.provenance,
    attackOrigin,
  });
}

/** Drop stale puncture sequence events (gen bump / refresh). */
function cancelPendingPuncture(rt: SimulationRuntime): void {
  rt.queue.cancelWhere((e) => e.abilityId === PUNCTURE_ABILITY_ID);
}

function schedulePunctureSequence(
  rt: SimulationRuntime,
  firstTick: number,
  generation: number,
  storedDamage: number,
): void {
  cancelPendingPuncture(rt);
  const ticks = punctureSequenceTicks(firstTick);
  for (let i = 0; i < PUNCTURE_HIT_PERCENTS.length; i++) {
    const percent = PUNCTURE_HIT_PERCENTS[i]!;
    const tick = ticks[i]!;
    const amount = punctureHitDamage(storedDamage, percent);
    scheduleEvent(rt, {
      tick,
      family: "dot",
      abilityId: PUNCTURE_ABILITY_ID,
      sourceCast: -1,
      hitIndex: i,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      originKind: "dot",
      provenance: { kind: "equipment_proc", detail: "puncture" },
      resolve: (eventRt) => {
        const p = eventRt.state.ranged.puncture;
        if (p.generation !== generation || tick >= p.expiresAtTick) {
          return { damage: { min: 0, max: 0, expected: 0 } };
        }
        const provenance = { kind: "equipment_proc" as const, detail: "puncture" };
        const host = resolveLeagueAttachedRawHost({
          rules: eventRt.input.league,
          source: provenance,
          landTick: tick,
          abilityBase: eventRt.input.base,
          min: amount,
          max: amount,
          level: eventRt.input.level,
          accuracy: 1,
          crit: { chance: 0, eligible: false },
          modifiers: targetAndPostHitModifiers(eventRt),
          context: {
            ...(eventRt.input.context ?? { style: "ranged" }),
            style: "ranged",
            damageSource: "proc",
            provenance,
          },
          cap: { cap: eventRt.input.cap?.cap ?? 30_000, bypass: true },
          bonusTargetId: "puncture",
        });
        return {
          damage: {
            min: host.hit.min,
            max: host.hit.max,
            expected: host.hit.expected,
            critExpected: host.hit.critExpected,
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
  }
}

/** Schedule Puncture sequence after the applying ability finishes (finish+1). */
export function schedulePunctureAfterFinish(rt: SimulationRuntime, finishTick: number): void {
  const p = rt.state.ranged.puncture;
  if (p.stacks <= 0 || p.storedDamage <= 0) {
    cancelPendingPuncture(rt);
    return;
  }
  const first = finishTick + PUNCTURE_FIRST_OFFSET_AFTER_FINISH;
  schedulePunctureSequence(rt, first, p.generation, p.storedDamage);
  rt.state = patchRanged(rt.state, {
    puncture: { ...p, pendingOwnerCast: -1 },
  });
}

export function applyRangedAmmunitionLandedState(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
  attackOrigin: AmmunitionAttackOrigin,
  ability?: AbilitySpec,
): void {
  const mechanicId = rt.input.ammunition?.projectile?.mechanicId;
  const eligible = isAmmunitionHitEligible({
    style: "ranged",
    provenance: event.provenance,
    attackOrigin,
  });
  const targetVitality = rt.state.target.vitality;
  const targetHealthFraction =
    targetVitality && targetVitality.maximumLifePoints > 0
      ? targetVitality.currentLifePoints / targetVitality.maximumLifePoints
      : null;
  const sourceEffects = resolveRangedAmmunitionHitEffects({
    ammunition: rt.input.ammunition,
    style: "ranged",
    provenance: event.provenance,
    attackOrigin,
    attackKind: "ability",
    targetClassification: rt.input.targetClassification,
    targetHealthFraction,
  });
  const sourceEffectId = ammunitionAppliedEffectId(mechanicId);
  if (
    eligible &&
    sourceEffectId &&
    (sourceEffects.sourceHitMultiplier !== 1 || sourceEffects.damagePotentialDelta !== 0)
  ) {
    recordAppliedEventEffect(rt, event, { id: sourceEffectId });
  }

  if (mayActivateBoltDeathmark(rt, event, damage, attackOrigin)) {
    const boltDeathmark = activateBoltDeathmark(event.tick);
    rt.state = patchRanged(rt.state, { boltDeathmark });
    rt.state = gainAdrenaline(rt.state, BOLT_DEATHMARK_ACTIVATION_ADRENALINE);
    if (sourceEffectId) {
      recordAppliedEventEffect(rt, event, {
        id: sourceEffectId,
        remainingTicks: Math.max(0, boltDeathmark.expiresAtTick - event.tick),
      });
    }
  }

  if (mechanicId === "deathspore" && eligible) {
    const prior = rt.state.ranged.deathspore;
    const deathspore = onRangedHit(prior, event.tick);
    rt.state = patchRanged(rt.state, { deathspore });
    if (deathspore !== prior) {
      recordAppliedEventEffect(rt, event, {
        id: "ammunition:deathspore",
        stackCount: deathspore.stacks,
        remainingTicks: Math.max(0, deathspore.freeCastUntilTick - event.tick),
      });
    }
  }

  if (mechanicId === "black-stone" && rt.input.targetAccuracyProfile && eligible) {
    const existing = rt.state.target.blackStone;
    if (rt.state.target.vitality?.currentLifePoints === 0) {
      if (existing) {
        rt.state = patchTarget(rt.state, {
          blackStone: resetBlackStoneOnTargetDeath(existing).state,
        });
      }
    } else {
      const state =
        existing ??
        newBlackStoneArmourState(rt.input.targetAccuracyProfile.originalTargetArmourRating);
      const application = applyBlackStoneArmourReduction(state, event.tick);
      rt.state = patchTarget(rt.state, { blackStone: application.state });
      if (application.reduction > 0) {
        recordAppliedEventEffect(rt, event, {
          id: "ammunition:black-stone",
          stackCount: application.state.applications,
          remainingTicks: Math.max(
            0,
            (application.state.expiresAtTick ?? event.tick) - event.tick,
          ),
        });
      }
    }
  }

  const wenBasic =
    attackOrigin === "botlg" || (ability != null && wenBasicHitEligible(ability));
  if (mechanicId === "wen" && eligible && wenBasic) {
    const wen = recordWenBasicHit(rt.state.ranged.wen, event.tick);
    rt.state = patchRanged(rt.state, { wen });
    recordAppliedEventEffect(rt, event, {
      id: "ammunition:wen",
      stackCount: wen.icyChillStacks,
      remainingTicks: Math.max(0, wen.icyChillExpiresAtTick - event.tick),
    });
  }
  if (mechanicId === "wen" && eligible && event.castSnap?.wenIcyPrecisionDamageAtCast) {
    recordAppliedEventEffect(rt, event, {
      id: "ammunition:wen-icy-precision",
      remainingTicks: Math.max(0, rt.state.ranged.wen.icyPrecisionUntilTick - event.tick),
    });
  }

  if (!mayApplyPuncture(rt, event, damage, attackOrigin)) return;

  const owner = event.sourceCast;
  const finished = owner < 0 || owner <= rt.state.ranged.puncture.lastCompletedCastSeq;
  const next = applyPunctureStack(
    rt.state.ranged.puncture,
    event.tick,
    rt.input.base,
    finished ? -1 : owner,
  );
  rt.state = patchRanged(rt.state, { puncture: next });
  recordAppliedEventEffect(rt, event, {
    id: "ammunition:splintering",
    stackCount: next.stacks,
    remainingTicks: Math.max(0, next.expiresAtTick - event.tick),
  });
  cancelPendingPuncture(rt);
  if (next.pendingOwnerCast < 0) schedulePunctureAfterFinish(rt, event.tick);
}

/**
 * Ranged state a real landed hit changes: Deathspore, Shadow Imbued adren,
 * Rapid Fire Searing Winds extension, and Puncture stacks (splintering).
 */
export function onRangedHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec,
  damage: ResolvedDamage,
): void {
  if (ability.id === "rapid_fire") {
    const grant = dracolichAdrenalinePerRapidFireHit(rt.input.equipmentEffects);
    if (grant > 0) rt.state = gainAdrenaline(rt.state, grant);
  }
  const fleeting = rt.input.equipmentIds?.some(
    (id) => id === "item:fleeting-boots" || id === "item:enhanced-fleeting-boots",
  );
  const snipeReduction =
    ability.id === "piercing_shot"
      ? fleeting
        ? 6
        : 4
      : ability.id === "ranged_attack" && fleeting
        ? 6
        : 0;
  const snipeReady = rt.state.cooldowns.snipe;
  if (snipeReduction > 0 && snipeReady !== undefined && snipeReady > event.tick) {
    rt.state = {
      ...rt.state,
      cooldowns: {
        ...rt.state.cooldowns,
        snipe: Math.max(event.tick, snipeReady - snipeReduction),
      },
    };
  }
  const perHit = shadowImbuedAdrenalinePerHit(rt.state.ranged.shadowImbued, event.tick);
  if (perHit > 0) rt.state = gainAdrenaline(rt.state, perHit);
  // Rapid Fire: each landed hit extends an active Searing Winds by 1 tick (wiki).
  if (ability.id === "rapid_fire" && event.tick < rt.state.ranged.searingWinds.expiresAtTick) {
    rt.state = patchRanged(rt.state, {
      searingWinds: extendSearingWinds(rt.state.ranged.searingWinds, 1),
    });
  }

  applyRangedAmmunitionLandedState(rt, event, damage, "player", ability);
}
