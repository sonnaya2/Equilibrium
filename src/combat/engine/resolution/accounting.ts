import { accountAnalysisEvent } from "../analysis";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import type { EventResolution } from "./types";
import { noteHistoryEventsGrowth } from "../../profiling/allocation";
import {
  keepsAnalysisLedgers,
  keepsPerAbilityMap,
  keepsPresentationHistory,
} from "../simulation/contracts";
import { COMMAND_REQUIRES_CONJURE, findConjure } from "../../styles/necromancy/conjures";
import { sacrificeExpectedHeal } from "../../styles/shared/constitutionAbilities";
import { shouldRetainHitDetail } from "./hitDetailsRetention";
import { blessingRule } from "../../league/ruleset";

/**
 * Write generic ledgers for one landed event: totals, per-tick / per-ability
 * attribution, cast-record updates, weighted analysis, and the provenance event
 * log. Does not schedule dependent events or apply style landed-hit transitions.
 *
 * Score-only keeps damage totals + damageByTick. hitDetails only when a pending
 * derived/LS consumer needs them. Cast result expected/min/max/hits skipped
 * (ranking never reads cast records).
 */
export function recordEventAccounting(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  const { damage, hitDetail } = resolution;
  if (hitDetail && shouldRetainHitDetail(rt, event)) {
    rt.hitDetails.set(event.seq, hitDetail);
  }

  rt.totalMin += damage.min;
  rt.totalMax += damage.max;
  rt.totalExpected += damage.expected;
  rt.damageByTick[event.tick] = (rt.damageByTick[event.tick] ?? 0) + damage.expected;
  rt.endTick = Math.max(rt.endTick, event.tick + 1);

  // Sacrifice: 25% of damage dealt as self-heal. Kill-blow 100% not modeled.
  const sacrificeHeal =
    event.abilityId === "sacrifice" && event.family !== "proc"
      ? sacrificeExpectedHeal(damage.expected)
      : 0;
  const lightHealFraction =
    event.abilityId === "light-of-saradomin"
      ? (blessingRule(rt.input.league, "lord-of-light")?.light?.healFraction ?? 0)
      : 0;
  const lightHeal = Math.floor(damage.expected * lightHealFraction);
  const expectedHeal = sacrificeHeal + lightHeal;
  if (expectedHeal > 0) rt.totalHealed += expectedHeal;

  if (keepsPerAbilityMap(rt.detailLevel)) {
    rt.perAbility[event.abilityId] = (rt.perAbility[event.abilityId] ?? 0) + damage.expected;
  }

  if (keepsAnalysisLedgers(rt.detailLevel)) {
    accountAnalysisEvent(rt.analysis, rt, event, resolution);
  }

  // Score-only ranking never reads cast.result; skip map lookup + mutations.
  if (event.sourceCast >= 0 && rt.detailLevel !== "score-only") {
    const record = rt.recordBySeq.get(event.sourceCast);
    if (record) {
      record.result.expected += damage.expected;
      if (expectedHeal > 0) {
        record.expectedHeal = (record.expectedHeal ?? 0) + expectedHeal;
      }
      if (event.attached && event.blessingId) {
        record.result.min += damage.min;
        record.result.max += damage.max;
      } else if (event.family !== "proc") {
        record.result.min += damage.min;
        record.result.max += damage.max;
        if (hitDetail && keepsPresentationHistory(rt.detailLevel)) {
          record.result.hits.push(hitDetail);
        }
      }
    }
  }

  if (!keepsPresentationHistory(rt.detailLevel)) return;

  const { resolve: _resolve, ...provenance } = event;
  const parasite = rt.state.target.melee.abyssalParasite;
  const spiritMeta = rt.spiritEventMeta.get(event.seq);
  const commandConjureId = COMMAND_REQUIRES_CONJURE[event.abilityId];
  const commandSpirit =
    commandConjureId != null
      ? findConjure(rt.state.necromancy.conjures, commandConjureId)
      : undefined;
  const remainingTicks =
    event.bleedExpiresAtTick != null
      ? Math.max(0, event.bleedExpiresAtTick - event.tick)
      : event.abilityId === "abyssal_parasite"
        ? Math.max(0, parasite.expiresAtTick - event.tick)
        : spiritMeta
          ? Math.max(0, spiritMeta.untilTick - event.tick)
          : commandSpirit
            ? Math.max(0, commandSpirit.untilTick - event.tick)
            : undefined;
  noteHistoryEventsGrowth();
  rt.events.push({
    ...provenance,
    damage,
    ...(event.abilityId === "abyssal_parasite" ? { stackCount: parasite.stacks } : {}),
    ...(remainingTicks !== undefined ? { remainingTicks } : {}),
  });
}
