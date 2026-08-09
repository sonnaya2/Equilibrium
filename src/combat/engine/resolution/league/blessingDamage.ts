import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import {
  attachedResolutionComponent,
  blessingHitEligibility,
  leagueDamageComponents,
  resolveLeagueAttachedHost,
  resolveLeagueAttachedTerms,
  type BlessingDamageSource,
} from "../../../league/damage";
import { capabilitiesOf, type DamageProvenance } from "../../../shared/damageProvenance";
import { blessingRule, resolveLeagueCritAtLand } from "../../../league/ruleset";
import { patchLeague } from "../../runtime/state";
import {
  appendAttachedComponents,
  packageCritical,
  type AttachedDamageComponent,
  type EventResolution,
  type ResolvedDamage,
} from "../types";
import { isBasicAttack } from "../../../shared/adrenalineGain";
import { statefulOccurrenceProbability } from "../../analysis/multiplicity";
import { noteBlessingDamageCache } from "../../../profiling/allocation";
import { critProbability, type CritLayers } from "../../../core/critical";
import type { CombatContext, CombatModifier } from "../../../types";
import { calculateNonCriticalHitDistribution } from "../../../pipeline/calculateHit";

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

function infernoCritLayers(rt: SimulationRuntime): CritLayers {
  const unholy = blessingRule(rt.input.league, "unholy-critual")?.unholyCritual;
  const globalCrit = resolveLeagueCritAtLand(rt.input.league, rt.input.crit);
  return {
    ...globalCrit,
    eligible: true,
    guaranteed: false,
    damageBonus: (globalCrit.damageBonus ?? 0) + (unholy?.infernoCritDamageBonus ?? 0),
  };
}

function resolveConcreteInferno(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  style: CombatContext["style"],
  context: CombatContext,
  modifiers: readonly CombatModifier[],
  band: readonly [number, number],
  forcedOutcome?: boolean,
): EventResolution {
  const provenance: DamageProvenance = { kind: "blessing", detail: "inferno-of-zamorak" };
  const inferno = resolveLeagueAttachedHost({
    rules: rt.input.league,
    source: provenance,
    bonusTargetId: "inferno-of-zamorak",
    base: rt.input.base,
    band: { minPct: band[0], maxPct: band[1] },
    level: rt.input.level,
    accuracy: rt.input.accuracy,
    crit: infernoCritLayers(rt),
    modifiers: modifiers.filter(
      (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
    ),
    context: {
      ...context,
      style,
      damageSource: "blessing",
      provenance,
    },
    cap: rt.input.cap,
    preciseRank: rt.input.preciseRank,
    landTick: event.tick,
  });
  const sourcePrecritDistribution = calculateNonCriticalHitDistribution({
    base: rt.input.base,
    band: { minPct: band[0], maxPct: band[1] },
    level: rt.input.level,
    accuracy: rt.input.accuracy,
    crit: { ...infernoCritLayers(rt), chance: 0, guaranteed: false, eligible: false },
    modifiers: modifiers.filter(
      (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
    ),
    context: {
      ...context,
      style,
      damageSource: "blessing",
      provenance,
    },
    provenance,
    cap: rt.input.cap,
    preciseRank: rt.input.preciseRank,
  });
  // Match castHit: hitDetail is pure host (baseHit). Shared riders stay as
  // components so materialize rebuilds host band + each component once.
  const base = inferno.baseHit;
  const critical = packageCritical(
    base.critChance,
    base.critExpected,
    base.nonCritExpected,
    forcedOutcome === undefined ? undefined : { outcome: forcedOutcome },
  );
  const components = inferno.components.map((component) =>
    attachedResolutionComponent(component),
  );
  // Pre-materialize EV total = pure host + every attached component (shared + separate).
  let min = base.min;
  let max = base.max;
  let expected = base.expected;
  let critExpected = base.critExpected;
  let capLoss = base.capLoss;
  for (const component of components) {
    min += component.damage.min;
    max += component.damage.max;
    expected += component.damage.expected;
    critExpected += component.damage.critExpected ?? component.damage.expected;
    capLoss += component.damage.capLoss ?? 0;
  }
  return {
    damage: {
      min,
      max,
      expected,
      critExpected,
      capLoss,
      critical,
    },
    hitDetail: {
      ...base,
      ...(forcedOutcome === undefined ? {} : { critOutcome: forcedOutcome }),
    },
    sourcePrecritDistribution,
    components,
  };
}

/** Wiki Instability: magic weapon + magic-style crit can fire LS; blessings use style at schedule. */
function blessingLightningSurgeFlag(
  style: CombatContext["style"],
  castSnap: ScheduledEvent<SimulationRuntime>["castSnap"],
): { lightningSurge: true } | Record<string, never> {
  return style === "magic" && castSnap?.magicWeaponAtCast === true
    ? { lightningSurge: true as const }
    : {};
}

function scheduleConcreteInfernoChain(
  rt: SimulationRuntime,
  parent: ScheduledEvent<SimulationRuntime>,
  style: CombatContext["style"],
  context: CombatContext,
  modifiers: readonly CombatModifier[],
  band: readonly [number, number],
  blessingId: "abyssal-cinders" | "unholy-critual",
  count: number,
  forceChainOutcomes: boolean,
): void {
  for (let index = 0; index < count; index++) {
    const forcedOutcome = forceChainOutcomes ? index < count - 1 : undefined;
    const eventBlessingId = index === 0 ? blessingId : "unholy-critual";
    scheduleEvent(rt, {
      tick: parent.tick,
      family: "blessing",
      abilityId: "inferno-of-zamorak",
      sourceCast: parent.sourceCast,
      hitIndex: parent.hitIndex,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: parent.seq,
      blessingId: eventBlessingId,
      bonusTargetId: "inferno-of-zamorak",
      originKind: "blessing",
      provenance: { kind: "blessing", detail: "inferno-of-zamorak" },
      expectedOccurrences: 1,
      expectedTriggerRolls: index === 0 ? 1 : 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      combatStyle: style,
      resourceEligible: true,
      castSnap: parent.castSnap,
      ...blessingLightningSurgeFlag(style, parent.castSnap),
      resolve: (runtime) =>
        resolveConcreteInferno(
          runtime,
          {
            ...parent,
            blessingId: eventBlessingId,
            abilityId: "inferno-of-zamorak",
          },
          style,
          context,
          modifiers,
          band,
          forcedOutcome,
        ),
    });
  }
}

/** Compose deterministic league blessing damage and schedule concrete stateful procs. */
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

  const cinders = blessingRule(rt.input.league, "abyssal-cinders");
  const unholy = blessingRule(rt.input.league, "unholy-critual")?.unholyCritual;
  const parentCapabilities = capabilitiesOf(event.provenance);
  const parentCanTriggerCritual =
    parentCapabilities.canTriggerCritual ?? parentCapabilities.canCrit;
  const parentCritOutcome = resolution.damage.critical?.outcome;
  const infernoCritChance = unholy
    ? Math.min(0.5, Math.max(0, critProbability(infernoCritLayers(rt))))
    : 0;
  const infernoBand = unholy?.infernoAbilityDamageBand ?? cinders?.inferno?.abilityDamageBand;
  if (infernoBand && !event.attached) {
    const cindersChance = eligible.cinders
      ? Math.min(
          1,
          Math.max(
            0,
            (cinders?.inferno?.chance ?? 0) *
              (blessingRule(rt.input.league, "perfidious")?.perfidious?.cindersChanceMultiplier ??
                1),
          ),
        )
      : 0;
    if (
      cindersChance > 0 &&
      rt.stochastic.bernoulli(`blessing:cinders:${event.seq}`, cindersChance)
    ) {
      const count =
        unholy && infernoCritChance > 0
          ? 1 +
            rt.stochastic.geometricSuccesses(
              `blessing:critual-chain:cinders:${event.seq}`,
              infernoCritChance,
            )
          : 1;
      scheduleConcreteInfernoChain(
        rt,
        event,
        style,
        { ...rt.input.context, style },
        modifiers,
        cinders?.inferno?.abilityDamageBand ?? unholy!.infernoAbilityDamageBand,
        "abyssal-cinders",
        count,
        unholy !== undefined,
      );
    }
    if (
      unholy &&
      parentCanTriggerCritual &&
      parentCritOutcome === true &&
      infernoCritChance >= 0 &&
      unholy.infernoAbilityDamageBand
    ) {
      const count =
        1 +
        rt.stochastic.geometricSuccesses(
          `blessing:critual-chain:parent:${event.seq}`,
          infernoCritChance,
        );
      scheduleConcreteInfernoChain(
        rt,
        event,
        style,
        { ...rt.input.context, style },
        modifiers,
        unholy.infernoAbilityDamageBand,
        "unholy-critual",
        count,
        true,
      );
    }
  }
  // Chance-weighted parents pass their activation mass into attached components.
  const parentWeight = event.expectedActivations ?? event.expectedOccurrences ?? 1;
  const parentOccurrenceProbability = statefulOccurrenceProbability(event);
  let composed = resolution;
  for (const component of components) {
    if (component.effectId === "inferno-of-zamorak") continue;
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
      castSnap: event.castSnap,
      combatStyle: style,
      ...blessingLightningSurgeFlag(style, event.castSnap),
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
        ...(component.sourcePrecritDistribution
          ? { sourcePrecritDistribution: component.sourcePrecritDistribution }
          : {}),
        ...(nested && nested.length > 0 ? { components: nested } : {}),
      }),
    });
  }
  return composed;
}
