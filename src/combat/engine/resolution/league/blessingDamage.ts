import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import {
  blessingHitEligibility,
  leagueDamageComponents,
  type BlessingDamageSource,
} from "../../../league/damage";
import { blessingRule } from "../../../league/ruleset";
import { patchLeague } from "../../runtime/state";
import type { ResolvedDamage } from "../types";

/** Event provenance in the vocabulary the blessing eligibility policy speaks. */
function blessingSourceOf(event: ScheduledEvent<SimulationRuntime>): BlessingDamageSource {
  if (event.blessingId) return "blessing";
  if (event.family === "proc" || event.sourceCast < 0) return "proc";
  if (event.family === "conjureAuto" || event.family === "poison") return "conjure";
  if (event.family === "command") return "command";
  return event.family === "dot" ? "dot" : "direct";
}

/**
 * Schedule league blessing damage components for a landed event and advance
 * Striking Light readiness when Light of Saradomin contributes.
 */
export function scheduleBlessingDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  if (!rt.input.league || damage.max <= 0) return;
  const source = blessingSourceOf(event);
  const eligible = blessingHitEligibility(source, event.attached);
  if (!eligible.rider && !eligible.onHit) return;
  const ability = rt.byId.get(event.abilityId);
  if (!ability) return;
  const modifiers =
    typeof rt.input.modifiers === "function"
      ? rt.input.modifiers(ability)
      : (rt.input.modifiers ?? []);
  const lightReady = event.tick >= (rt.state.league?.strikingLightReadyTick ?? Infinity);
  const components = leagueDamageComponents({
    rules: rt.input.league,
    ability,
    hitIndex: event.hitIndex,
    source,
    attached: event.attached,
    base: rt.input.base,
    level: rt.input.level,
    accuracy: rt.input.accuracy,
    crit: rt.input.crit,
    modifiers,
    context: {
      ...rt.input.context,
      style: ability.style,
      abilityCategory: ability.category,
      autoAttack: ability.autoAttack,
      area: ability.area,
    },
    cap: rt.input.cap,
    strikingLightReady: lightReady,
  });
  if (components.some((component) => component.effectId === "light-of-saradomin")) {
    const cooldown = blessingRule(rt.input.league, "striking-light")?.light?.cooldownTicks;
    if (cooldown !== undefined) {
      rt.state = patchLeague(rt.state, { strikingLightReadyTick: event.tick + cooldown });
    }
  }
  for (const component of components) {
    scheduleEvent(rt, {
      tick: event.tick,
      family: "blessing",
      abilityId: component.effectId,
      sourceCast: event.sourceCast,
      hitIndex: event.hitIndex,
      attached: component.attached,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: event.seq,
      blessingId: component.blessingId,
      expectedOccurrences: component.expectedOccurrences,
      resolve: () => ({ damage: component.damage, hitDetail: component.hitDetail }),
    });
  }
}
