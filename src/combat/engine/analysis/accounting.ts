import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import type { EventResolution } from "../resolution/types";
import type { DamageSourceKind } from "../simulation/contracts";
import type { EffectAnalysisLedger, RuntimeAnalysisState } from "./contracts";
import { resolveEventMultiplicity } from "./multiplicity";

export function sourceKindOf(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): DamageSourceKind {
  if (event.blessingId) return "league-blessing";
  if (event.abilityId === "crackling" || event.abilityId === "aftershock") return "perk";
  if (event.abilityId === "abyssal_parasite") return "equipment-passive";
  if (event.family === "conjureAuto" || event.family === "command" || event.family === "poison") {
    return "conjure-or-familiar";
  }
  if (event.sourceCast >= 0 && rt.recordBySeq.get(event.sourceCast)?.auto) return "auto-attack";
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
    casts: 0,
    triggerRolls: 0,
    expectedActivations: 0,
    expectedSeparateHits: 0,
    attachedComponents: 0,
    bonusDamage: 0,
  };
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
 * accounting — never from summary finalization over the event log.
 */
export function accountAnalysisEvent(
  analysis: RuntimeAnalysisState,
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  const { damage } = resolution;
  const kind = sourceKindOf(rt, event);
  const mult = resolveEventMultiplicity(event);
  const expected = damage.expected;
  const crit = damage.critical?.contribution ?? 0;
  const cap = damage.capLoss ?? 0;
  // Global direct/DoT split follows parent provenance (BB on a bleed still lands
  // in the DoT total). The rider's own effect row never stamps as DoT — that is
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
  ledger.totalDamage += expected;
  ledger.directDamage += asDotLedger ? 0 : expected;
  ledger.dotDamage += asDotLedger ? expected : 0;
  ledger.criticalContribution += crit;
  ledger.capLoss += cap;
  ledger.triggerRolls += mult.triggerRolls;
  ledger.expectedActivations += mult.expectedActivations;
  ledger.expectedSeparateHits += mult.expectedSeparateHits;
  ledger.attachedComponents += mult.attachedComponents;
  // Attribute bonus-damage riders ONLY onto the parent skill (how much Big Boned
  // added on that ability's hits). Never onto the rider row itself — that would
  // double-count if Bonus were summed, and mark Big Boned as "receiving" bonus.
  if (event.damageTag === "bonus-damage") {
    const parentId = parentAbilityId(rt, event);
    if (parentId && parentId !== event.abilityId) {
      const parent =
        analysis.effects.get(parentId) ?? emptyLedger(parentId, "ability-direct");
      parent.bonusDamage += expected;
      analysis.effects.set(parentId, parent);
    }
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
      ledger.casts += 1;
    }
  }

  analysis.effects.set(event.abilityId, ledger);
}
