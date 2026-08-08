import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import {
  attachedResolutionComponent,
  blessingHitEligibility,
  leagueDamageComponents,
  resolveLeagueAttachedTerms,
  type BlessingDamageSource,
} from "../../../league/damage";
import type { DamageProvenance } from "../../../shared/damageProvenance";
import { blessingRule } from "../../../league/ruleset";
import { patchLeague } from "../../runtime/state";
import {
  appendAttachedComponents,
  type AttachedDamageComponent,
  type EventResolution,
  type ResolvedDamage,
} from "../types";
import { isBasicAttack } from "../../../shared/adrenalineGain";
import { statefulOccurrenceProbability } from "../../analysis/multiplicity";
import { noteBlessingDamageCache } from "../../../profiling/allocation";

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

function scaleAttachedComponent(
  component: AttachedDamageComponent,
  weight: number,
): AttachedDamageComponent {
  if (weight === 1) return component;
  return {
    ...component,
    damage: scaleResolvedDamage(component.damage, weight),
    ...(component.analysis
      ? {
          analysis: {
            ...component.analysis,
            expectedActivations: component.analysis.expectedActivations * weight,
          },
        }
      : {}),
  };
}

/**
 * Compose league blessing damage components for a landed event and advance
 * Striking Light readiness when Light of Saradomin contributes.
 * Chance-weighted Inferno is one separate hit and may host attached Big Boned damage.
 */
export function applyBlessingDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): EventResolution {
  const damage = resolution.damage;
  if (!rt.input.league || damage.max <= 0) return resolution;
  if (event.family === "blessing") return resolution;
  const source = blessingSourceOf(event);
  const eligible = blessingHitEligibility(source, event.attached);
  const unholyActive = blessingRule(rt.input.league, "unholy-critual")?.unholyCritual != null;
  if (!eligible.rider && !eligible.cinders && !eligible.onHit && !unholyActive) return resolution;
  const ability = rt.byId.get(event.abilityId);
  // Spirit auto/poison ledger ids are not bar AbilitySpecs; rider path uses a stub.
  // Blessing separate hits (Light/Inferno) also lack bar specs; rider path uses a stub.
  if (!ability && !eligible.rider && !eligible.cinders && !unholyActive) return resolution;
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
    damageBonus: resolution.hitDetail?.critDamageBonus ?? rt.input.crit.damageBonus,
  };
  const strikingLightReady = event.tick >= (rt.state.league?.strikingLightReadyTick ?? Infinity);
  const lordOfLightReady = event.tick >= (rt.state.league?.lordOfLightReadyTick ?? Infinity);
  const includedAttached = new Set(resolution.components?.map((component) => component.id) ?? []);
  const expectedAttached = resolveLeagueAttachedTerms({
    rules: rt.input.league,
    source,
    attached: event.attached,
    landTick: event.tick,
    abilityBase: rt.input.base,
  });
  const includeAttachedHost = expectedAttached.some((term) => !includedAttached.has(term.id));
  if (!includeAttachedHost && !eligible.cinders && !eligible.onHit && !unholyActive) {
    return resolution;
  }
  const componentCacheKey = [
    event.tick,
    event.abilityId,
    event.hitIndex,
    event.attached ? 1 : 0,
    typeof source === "string" ? source : `${source.kind}:${source.detail ?? ""}`,
    parentCrit.chance,
    parentCrit.damageBonus ?? 0,
    parentCrit.guaranteed ? 1 : 0,
    parentCrit.eligible === false ? 0 : 1,
    strikingLightReady ? 1 : 0,
    lordOfLightReady ? 1 : 0,
    includeAttachedHost ? 1 : 0,
  ].join("\x1f");
  let components = rt.leagueDamageCache.get(componentCacheKey) as
    ReturnType<typeof leagueDamageComponents> | undefined;
  if (components) {
    noteBlessingDamageCache(true);
  } else {
    noteBlessingDamageCache(false);
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
      preciseRank: rt.input.preciseRank,
      strikingLightReady: ability != null && strikingLightReady,
      lordOfLightReady: ability != null && lordOfLightReady,
      includeAttachedHost,
    });
    rt.leagueDamageCache.set(componentCacheKey, components);
    if (rt.leagueDamageCache.size > 1_024) {
      const oldest = rt.leagueDamageCache.keys().next().value;
      if (oldest !== undefined) rt.leagueDamageCache.delete(oldest);
    }
  }
  if (components.some((component) => component.blessingId === "striking-light")) {
    const cooldown =
      blessingRule(rt.input.league, "perfidious")?.strikingLightCooldownTicks ??
      blessingRule(rt.input.league, "striking-light")?.light?.cooldownTicks;
    if (cooldown !== undefined) {
      rt.state = patchLeague(rt.state, { strikingLightReadyTick: event.tick + cooldown });
    }
  }
  if (components.some((component) => component.blessingId === "lord-of-light")) {
    const cooldown = blessingRule(rt.input.league, "lord-of-light")?.light?.cooldownTicks;
    if (cooldown !== undefined) {
      rt.state = patchLeague(rt.state, { lordOfLightReadyTick: event.tick + cooldown });
    }
  }
  // Chance-weighted parents pass their activation mass into attached components.
  const parentWeight = event.expectedActivations ?? event.expectedOccurrences ?? 1;
  const parentOccurrenceProbability = statefulOccurrenceProbability(event);
  let composed = resolution;
  for (const component of components) {
    const scaledDamage = scaleResolvedDamage(component.damage, parentWeight);
    if (component.attached) {
      if (includedAttached.has(component.effectId)) continue;
      composed = appendAttachedComponents(composed, [
        attachedResolutionComponent(
          component,
          component.expectedActivations * parentWeight,
          component.expectedActivations * parentWeight,
          component.expectedActivations * parentWeight,
        ),
      ]);
      continue;
    }
    const nested = component.components?.map((child) =>
      scaleAttachedComponent(child, parentWeight),
    );
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
      originKind: "blessing",
      provenance: { kind: "blessing", detail: component.effectId },
      expectedOccurrences: component.expectedOccurrences * parentWeight,
      expectedTriggerRolls: component.expectedTriggerRolls * parentWeight,
      expectedActivations: component.expectedActivations * parentWeight,
      expectedSeparateHits: component.expectedSeparateHits * parentWeight,
      ...(component.occurrenceModel?.kind === "geometric"
        ? {
            occurrenceModel: {
              ...component.occurrenceModel,
              startProbability:
                component.occurrenceModel.startProbability * parentOccurrenceProbability,
            },
          }
        : component.occurrenceModel?.kind === "bernoulli"
          ? {
              occurrenceModel: {
                ...component.occurrenceModel,
                probability: component.occurrenceModel.probability * parentOccurrenceProbability,
              },
            }
          : {}),
      resolve: () => ({
        damage: scaledDamage,
        hitDetail: parentWeight === 1 ? component.hitDetail : undefined,
        ...(nested && nested.length > 0 ? { components: nested } : {}),
      }),
    });
  }
  return composed;
}
