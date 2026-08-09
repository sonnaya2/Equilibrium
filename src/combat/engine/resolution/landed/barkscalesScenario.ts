import { secondsToTicks, ticksToSeconds } from "../../../core/ticks";
import { barkscalesOutcome } from "../../../league/barkscales";
import { graspOfGuthixComponents } from "../../../league/damage";
import {
  blessingRule,
  hasBlessing,
  leagueModifiers,
  targetPoisonImmuneForBlessingPoison,
} from "../../../league/ruleset";
import type { CombatModifier } from "../../../types";
import type { SimulationRuntime } from "../../runtime/runtime";
import { scheduleEvent } from "../../runtime/runtime";

/** Host mods plus any missing league poison mods (Envenomed, Havoc on poison). */
function modifiersForGraspScenario(
  rt: SimulationRuntime,
  style: string,
): readonly CombatModifier[] {
  const modifierProxy = rt.basicByStyle.get(style as "melee" | "ranged" | "magic" | "necromancy");
  const host =
    typeof rt.input.modifiers === "function"
      ? modifierProxy
        ? rt.input.modifiers(modifierProxy)
        : []
      : (rt.input.modifiers ?? []);
  const merged: CombatModifier[] = [...host];
  const seen = new Set(merged.map((mod) => mod.id));
  for (const mod of leagueModifiers(rt.input.league)) {
    if (seen.has(mod.id)) continue;
    seen.add(mod.id);
    merged.push(mod);
  }
  return merged;
}

/**
 * Schedule Barkscales Grasp of Guthix from the stated incoming-hit interval.
 * Outgoing rotation cannot supply enemy autos; interval is scenario input
 * (manual field or wiki attack rate on boss preset). Without interval or
 * horizon, no events are scheduled (honest no-scenario, not 0 DPM).
 */
export function scheduleBarkscalesScenarioGrasps(rt: SimulationRuntime): void {
  const league = rt.input.league;
  if (!league || !hasBlessing(league, "barkscales")) return;

  const intervalSeconds = rt.input.incomingHitIntervalSeconds;
  if (intervalSeconds == null || !(intervalSeconds > 0) || !Number.isFinite(intervalSeconds)) {
    return;
  }

  const horizon = rt.horizon ?? rt.input.horizonTicks;
  if (horizon == null || !(horizon > 0)) return;

  const windowSeconds = ticksToSeconds(horizon);
  const hitsOverride =
    blessingRule(league, "perfidious")?.perfidious?.barkscalesHitsPerTrigger;
  const poisonBlocked = targetPoisonImmuneForBlessingPoison(
    rt.input.targetPoisonImmune,
    league,
  );
  const outcome = barkscalesOutcome(
    blessingRule(league, "barkscales"),
    league.totalArmour,
    windowSeconds,
    {
      incomingHitIntervalSeconds: intervalSeconds,
      targetsStruck: league.areaTargets,
      poisonImmune: poisonBlocked,
    },
    hitsOverride,
  );
  if (outcome.support !== "modeled" || outcome.triggers == null || outcome.triggers <= 0) {
    return;
  }
  if (outcome.targetsStruck <= 0) return;

  const style = rt.input.context?.style ?? "melee";
  // Scenario Grasp has no host cast; proxy basic for ability-scoped mods + force league poison mods.
  const modifiers = modifiersForGraspScenario(rt, style);
  const intervalTicks = Math.max(1, secondsToTicks(intervalSeconds));
  const ticksPerTrigger = intervalTicks * outcome.hitsPerTrigger;

  for (let i = 0; i < outcome.triggers; i++) {
    // Land on the tick of the Nth qualifying reduction (end of that auto interval).
    const landTick = Math.min(horizon - 1, (i + 1) * ticksPerTrigger - 1);
    if (landTick < 0) continue;
    const components = graspOfGuthixComponents({
      rules: league,
      triggers: 1,
      targetsStruck: outcome.targetsStruck,
      base: rt.input.base,
      level: rt.input.level,
      accuracy: rt.input.accuracy,
      modifiers,
      context: {
        ...rt.input.context,
        style,
        area: "aoe",
        damageSource: "blessing",
      },
      cap: rt.input.cap,
      landTick,
      // Envenomed must match barkscalesOutcome: otherwise Amascut-style immune targets
      // schedule zero Grasp components while the scenario counter still advances.
      poisonImmune: poisonBlocked,
    });
    for (const component of components) {
      scheduleEvent(rt, {
        tick: landTick,
        family: "blessing",
        abilityId: component.effectId,
        sourceCast: -1,
        hitIndex: 0,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
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
}
