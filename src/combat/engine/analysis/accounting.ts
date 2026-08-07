import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import type { EventResolution } from "../resolution/types";
import type { DamageSourceKind } from "../simulation/contracts";
import type { EffectAnalysisLedger, RuntimeAnalysisState } from "./contracts";
import { resolveEventMultiplicity } from "./multiplicity";
import { isBasicAttack } from "../../shared/adrenalineGain";

export function sourceKindOf(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): DamageSourceKind {
  if (event.provenance.kind === "player_poison") return "player-poison";
  if (event.blessingId) return "league-blessing";
  if (event.abilityId === "crackling" || event.abilityId === "aftershock") return "perk";
  if (event.abilityId === "abyssal_parasite" || event.abilityId === "puncture") {
    return "equipment-passive";
  }
  if (event.family === "conjureAuto" || event.family === "command" || event.family === "poison") {
    return "conjure-or-familiar";
  }
  if (isBasicAttack(rt.byId.get(event.abilityId) ?? {})) return "basic-attack";
  // Origin provenance outranks family for derived/attached components.
  if (event.originKind === "dot" || event.family === "dot") return "ability-dot";
  if (event.family === "hit") return "ability-direct";
  return "other-modeled";
}

function isDotOrigin(event: ScheduledEvent<SimulationRuntime>): boolean {
  if (event.originKind === "dot") return true;
  if (event.originKind !== undefined) return false;
  return event.family === "dot";
}

function emptyLedger(id: string, kind: DamageSourceKind): EffectAnalysisLedger {
  return {
    id,
    kind,
    totalDamage: 0,
    directDamage: 0,
    dotDamage: 0,
    criticalContribution: 0,
    capLoss: 0,
    expectedCasts: 0,
    expectedTriggerRolls: 0,
    expectedActivations: 0,
    expectedSeparateHits: 0,
    expectedAttachedComponents: 0,
    expectedPlayerPoisonHits: 0,
    bonusDamage: 0,
  };
}

export function accountPlayerPoisonHits(
  analysis: RuntimeAnalysisState,
  event: ScheduledEvent<SimulationRuntime>,
  expectedHits: number,
): void {
  if (!(expectedHits > 0)) return;
  const ledger = analysis.effects.get(event.abilityId);
  if (!ledger) return;
  ledger.expectedPlayerPoisonHits += expectedHits;
}

/** Parent ability that a bonus-damage rider attached to (already in the event log). */
function parentAbilityId(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): string | undefined {
  if (event.derivedFrom == null) return undefined;
  return rt.events.find((e) => e.seq === event.derivedFrom)?.abilityId;
}

/**
 * Update weighted analysis ledgers for one landed event. Call from record
 * accounting - never from summary finalization over the event log.
 */
export function accountAnalysisEvent(
  analysis: RuntimeAnalysisState,
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  const { damage } = resolution;
  const kind = sourceKindOf(rt, event);
  const expected = damage.expected;
  const crit = damage.critical?.contribution ?? 0;
  const cap = damage.capLoss ?? 0;
  const blessingComponents = (resolution.components ?? []).filter(
    (component) => component.analysis?.kind === "league-blessing",
  );
  const mult = resolveEventMultiplicity({ ...event, components: blessingComponents });
  const attachedExpected = blessingComponents.reduce(
    (total, component) => total + component.damage.expected,
    0,
  );
  const attachedCrit = blessingComponents.reduce(
    (total, component) => total + (component.damage.critical?.contribution ?? 0),
    0,
  );
  const attachedCap = blessingComponents.reduce(
    (total, component) => total + (component.damage.capLoss ?? 0),
    0,
  );
  const hostExpected = expected - attachedExpected;
  const hostCrit = crit - attachedCrit;
  const hostCap = cap - attachedCap;
  // Global direct/DoT split follows parent provenance (BB on a bleed still lands
  // in the DoT total). The rider's own effect row never stamps as DoT - that is
  // bonus damage, shown in the Bonus column instead.
  const originIsDot = isDotOrigin(event);
  const riderIsBonus = event.damageTag === "bonus-damage";
  const asDotGlobal = originIsDot;
  const asDotLedger = riderIsBonus ? false : originIsDot;

  analysis.sources.set(kind, (analysis.sources.get(kind) ?? 0) + expected);
  analysis.directDamage += asDotGlobal ? 0 : expected;
  analysis.dotDamage += asDotGlobal ? expected : 0;
  analysis.criticalContribution += crit;
  analysis.capLoss += cap;

  const ledger = analysis.effects.get(event.abilityId) ?? emptyLedger(event.abilityId, kind);
  ledger.kind = kind;
  ledger.totalDamage += hostExpected;
  if (kind === "player-poison") {
    const attachedMin = blessingComponents.reduce(
      (total, component) => total + component.damage.min,
      0,
    );
    const attachedMax = blessingComponents.reduce(
      (total, component) => total + component.damage.max,
      0,
    );
    ledger.minimumDamage = (ledger.minimumDamage ?? 0) + damage.min - attachedMin;
    ledger.maximumDamage = (ledger.maximumDamage ?? 0) + damage.max - attachedMax;
  }
  ledger.directDamage += asDotLedger ? 0 : hostExpected;
  ledger.dotDamage += asDotLedger ? hostExpected : 0;
  ledger.criticalContribution += hostCrit;
  ledger.capLoss += hostCap;
  ledger.expectedTriggerRolls += mult.expectedTriggerRolls;
  ledger.expectedActivations += mult.expectedActivations;
  ledger.expectedSeparateHits += mult.expectedSeparateHits;
  ledger.expectedAttachedComponents += mult.expectedAttachedComponents;
  // Attribute bonus damage to its parent effect; packed blessing chains name it explicitly.
  if (event.damageTag === "bonus-damage") {
    const parentId = event.bonusTargetId ?? parentAbilityId(rt, event);
    if (parentId && parentId !== event.abilityId) {
      const parent =
        analysis.effects.get(parentId) ??
        emptyLedger(parentId, event.bonusTargetId ? "league-blessing" : "ability-direct");
      parent.bonusDamage += expected;
      analysis.effects.set(parentId, parent);
    }
  }

  for (const component of blessingComponents) {
    const attribution = component.analysis!;
    const componentLedger =
      analysis.effects.get(component.id) ?? emptyLedger(component.id, "league-blessing");
    componentLedger.kind = "league-blessing";
    componentLedger.totalDamage += component.damage.expected;
    componentLedger.directDamage += component.damage.expected;
    componentLedger.criticalContribution += component.damage.critical?.contribution ?? 0;
    componentLedger.capLoss += component.damage.capLoss ?? 0;
    componentLedger.expectedActivations += attribution.expectedActivations;
    componentLedger.expectedAttachedComponents += attribution.expectedActivations;
    analysis.effects.set(component.id, componentLedger);

    const parentId = attribution.bonusTargetId ?? event.abilityId;
    const parent =
      parentId === event.abilityId
        ? ledger
        : (analysis.effects.get(parentId) ?? emptyLedger(parentId, "league-blessing"));
    parent.bonusDamage += component.damage.expected;
    if (parent !== ledger) analysis.effects.set(parentId, parent);
  }

  // Cast identity is committed once per ability/sourceCast for player-owned
  // hit/dot/command events. Blessings and procs use activations, not casts.
  if (
    event.sourceCast >= 0 &&
    !event.attached &&
    (event.family === "hit" || event.family === "dot" || event.family === "command") &&
    !event.blessingId
  ) {
    const key = `${event.abilityId}:${event.sourceCast}`;
    if (!analysis.castKeys.has(key)) {
      analysis.castKeys.add(key);
      ledger.expectedCasts += 1;
    }
  }

  analysis.effects.set(event.abilityId, ledger);
}
