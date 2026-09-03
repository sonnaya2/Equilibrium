import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import { patchLeague } from "../../runtime/state";
import {
  blessingRule,
  hasBlessing,
  targetPoisonImmuneForBlessingPoison,
} from "../../../league/ruleset";
import { graspOfGuthixComponents } from "../../../league/damage";
import type { ResolvedDamage } from "../types";
import { poisonAbilityDamageAt } from "../castHit";

export function applyLeagueLandedHitEffects(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  if (
    !rt.input.league ||
    event.family !== "dot" ||
    event.attached ||
    event.blessingId ||
    event.sourceCast < 0 ||
    damage.expected <= 0 ||
    !hasBlessing(rt.input.league, "tearing-thorns") ||
    (event.provenance.kind !== "player_dot" && event.provenance.kind !== "derived_tail")
  ) {
    return;
  }
  const ability = rt.byId.get(event.abilityId);
  const tearing = blessingRule(rt.input.league, "tearing-thorns")?.tearingThorns;
  if (!ability?.tearingThornsEligible || !tearing) return;

  const nextCount = (rt.state.league?.tearingThornsHitCount ?? 0) + 1;
  const threshold = Math.max(1, Math.floor(tearing.hitsPerGrasp));
  const count = nextCount >= threshold ? nextCount - threshold : nextCount;
  rt.state = patchLeague(rt.state, { tearingThornsHitCount: count });
  if (nextCount < threshold) return;

  const modifiers =
    typeof rt.input.modifiers === "function"
      ? rt.input.modifiers(ability)
      : (rt.input.modifiers ?? []);
  const targets = Math.min(
    Math.max(1, Math.floor(rt.input.league.areaTargets)),
    Math.max(1, Math.floor(tearing.graspMaxTargets)),
  );
  const components = graspOfGuthixComponents({
    rules: rt.input.league,
    triggers: 1,
    targetsStruck: targets,
    base: poisonAbilityDamageAt(rt, event.tick),
    level: rt.input.level,
    accuracy: rt.input.accuracy,
    modifiers,
    context: {
      ...rt.input.context,
      style: ability.style,
      area: "aoe",
      damageSource: "blessing",
    },
    cap: rt.input.cap,
    landTick: event.tick,
    poisonImmune: targetPoisonImmuneForBlessingPoison(rt.input.targetPoisonImmune, rt.input.league),
  });
  for (const component of components) {
    scheduleEvent(rt, {
      tick: event.tick,
      family: "blessing",
      abilityId: component.effectId,
      sourceCast: event.sourceCast,
      hitIndex: event.hitIndex,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: event.seq,
      blessingId: component.blessingId,
      ...(component.damageTag ? { damageTag: component.damageTag } : {}),
      ...(component.bonusTargetId ? { bonusTargetId: component.bonusTargetId } : {}),
      ...(component.analysisGroupId ? { analysisGroupId: component.analysisGroupId } : {}),
      ...(component.analysisGroupActivations !== undefined
        ? { analysisGroupActivations: component.analysisGroupActivations }
        : {}),
      originKind: "blessing",
      provenance: { kind: "blessing", detail: component.effectId },
      expectedOccurrences: component.expectedOccurrences,
      expectedTriggerRolls: component.expectedTriggerRolls,
      expectedActivations: component.expectedActivations,
      expectedSeparateHits: component.expectedSeparateHits,
      resolve: () => ({
        damage: component.damage,
        ...(component.hitDetail ? { hitDetail: component.hitDetail } : {}),
        ...(component.components && component.components.length > 0
          ? { components: component.components }
          : {}),
      }),
    });
  }
}
