import type { DamageOriginKind, ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import {
  blessingHitEligibility,
  leagueDamageComponents,
  type BlessingDamageSource,
} from "../../../league/damage";
import { outgoingSourceOf, type DamageProvenance } from "../../../shared/damageProvenance";
import { blessingRule, resolveMaximumLife } from "../../../league/ruleset";
import { patchLeague } from "../../runtime/state";
import type { ResolvedDamage } from "../types";
import { isBasicAttack } from "../../../shared/adrenalineGain";

const componentCache = new WeakMap<
  object,
  Map<string, ReturnType<typeof leagueDamageComponents>>
>();

function sourceKey(source: BlessingDamageSource | DamageProvenance): string {
  return typeof source === "string" ? source : `${source.kind}:${source.detail ?? ""}`;
}

/**
 * Prefer scheduled DamageProvenance (keeps blessing detail for rider carve-out);
 * fall back to family/ownership for older events.
 * Parasite (sourceCast < 0) stays ineligible even if family is "dot".
 */
function blessingSourceOf(
  event: ScheduledEvent<SimulationRuntime>,
): BlessingDamageSource | DamageProvenance {
  if (event.provenance != null) return event.provenance;
  if (event.blessingId) {
    return { kind: "blessing", detail: event.abilityId };
  }
  if (event.family === "proc" || event.sourceCast < 0) return "proc";
  if (event.family === "conjureAuto" || event.family === "poison") return "conjure";
  if (event.family === "command") return "command";
  return event.family === "dot" ? "dot" : "direct";
}

/**
 * Parent origin for derived blessing riders. Big Boned on a bleed stays "dot"
 * so analysis attributes the rider with the bleed, not as a free-standing hit.
 */
function parentOriginKind(
  event: ScheduledEvent<SimulationRuntime>,
  source: BlessingDamageSource | DamageProvenance,
): DamageOriginKind {
  if (event.originKind) return event.originKind;
  if (typeof source === "string") return source;
  return outgoingSourceOf(source);
}

/** Scale EV-packed damage when riders attach to chance-weighted parents (Inferno 5%). */
function scaleResolvedDamage(damage: ResolvedDamage, weight: number): ResolvedDamage {
  if (weight === 1) return damage;
  return {
    min: 0,
    max: damage.max,
    expected: damage.expected * weight,
    critExpected: damage.critExpected === undefined ? undefined : damage.critExpected * weight,
    capLoss: damage.capLoss === undefined ? undefined : damage.capLoss * weight,
    critical: damage.critical
      ? { ...damage.critical, contribution: damage.critical.contribution * weight }
      : undefined,
  };
}

/**
 * Schedule league blessing damage components for a landed event and advance
 * Striking Light readiness when Light of Saradomin contributes.
 * Inferno descendants are folded into their parent's geometric EV components.
 */
export function scheduleBlessingDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  if (!rt.input.league || damage.max <= 0) return;
  if (event.abilityId === "inferno-of-zamorak") return;
  const source = blessingSourceOf(event);
  const eligible = blessingHitEligibility(source, event.attached);
  if (!eligible.rider && !eligible.cinders && !eligible.onHit) return;
  const ability = rt.byId.get(event.abilityId);
  // Spirit auto/poison ledger ids are not bar AbilitySpecs; rider path uses a stub.
  // Blessing separate hits (Light/Inferno) also lack bar specs; rider path uses a stub.
  if (!ability && !eligible.rider && !eligible.cinders) return;
  const style = ability?.style ?? rt.input.context?.style ?? "necromancy";
  const resolvedAbility = ability ?? {
    id: event.abilityId,
    name: event.abilityId,
    style,
    category: "basic" as const,
    hits: [],
  };
  const modifiers =
    typeof rt.input.modifiers === "function"
      ? rt.input.modifiers(resolvedAbility)
      : (rt.input.modifiers ?? []);
  const parentCrit = {
    ...rt.input.crit,
    chance: damage.critical?.chance ?? 0,
    guaranteed: damage.critical?.mode === "guaranteed",
    eligible: damage.critical?.mode !== "none",
  };
  const lightReady = event.tick >= (rt.state.league?.strikingLightReadyTick ?? Infinity);
  // Input identity is shared by every branch; land-time fields remain in the key.
  let cache = componentCache.get(rt.input);
  if (!cache) {
    cache = new Map();
    componentCache.set(rt.input, cache);
  }
  const key = [
    resolvedAbility.id,
    event.hitIndex,
    resolveMaximumLife(rt.input.league, event.tick),
    event.attached ? 1 : 0,
    sourceKey(source),
    parentCrit.chance,
    parentCrit.guaranteed ? 1 : 0,
    ability != null && lightReady ? 1 : 0,
  ].join("\x1f");
  let components = cache.get(key);
  if (!components) {
    components = leagueDamageComponents({
      rules: rt.input.league,
      ability: resolvedAbility,
      hitIndex: event.hitIndex,
      source,
      attached: event.attached,
      landTick: event.tick,
      base: rt.input.base,
      level: rt.input.level,
      accuracy: rt.input.accuracy,
      crit: rt.input.crit,
      parentCrit,
      modifiers,
      context: {
        ...rt.input.context,
        style,
        abilityCategory: resolvedAbility.category,
        basicAttack: isBasicAttack(resolvedAbility),
        area: resolvedAbility.area,
      },
      cap: rt.input.cap,
      // Light needs a real bar Basic ability; stubs never open the gate.
      strikingLightReady: ability != null && lightReady,
    });
    cache.set(key, components);
  }
  if (components.some((component) => component.effectId === "light-of-saradomin")) {
    const cooldown = blessingRule(rt.input.league, "striking-light")?.light?.cooldownTicks;
    if (cooldown !== undefined) {
      rt.state = patchLeague(rt.state, { strikingLightReadyTick: event.tick + cooldown });
    }
  }
  // Chance-weighted parents pass their activation mass into attached components.
  const parentWeight = event.expectedActivations ?? event.expectedOccurrences ?? 1;
  const originKind = parentOriginKind(event, source);
  for (const component of components) {
    const scaledDamage = scaleResolvedDamage(component.damage, parentWeight);
    const componentOrigin =
      !component.attached || component.bonusTargetId === "inferno-of-zamorak"
        ? "blessing"
        : originKind;
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
      ...(component.damageTag ? { damageTag: component.damageTag } : {}),
      ...(component.bonusTargetId ? { bonusTargetId: component.bonusTargetId } : {}),
      originKind: componentOrigin,
      provenance: { kind: "blessing", detail: component.effectId },
      expectedOccurrences: component.expectedOccurrences * parentWeight,
      triggerRolls: component.triggerRolls,
      expectedActivations: component.expectedActivations * parentWeight,
      expectedSeparateHits: component.expectedSeparateHits * parentWeight,
      resolve: () => ({
        damage: scaledDamage,
        hitDetail: parentWeight === 1 ? component.hitDetail : undefined,
      }),
    });
  }
}
