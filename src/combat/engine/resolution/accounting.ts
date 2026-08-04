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

/**
 * Write generic ledgers for one landed event: totals, per-tick / per-ability
 * attribution, cast-record updates, weighted analysis, and the provenance event
 * log. Does not schedule dependent events or apply style landed-hit transitions.
 *
 * Score-only keeps damage totals, damageByTick, hitDetails (derived-hit / branch
 * keys), and cast expected/min/max. It skips analysis, event log, and cast hit
 * arrays. Summary also skips presentation history + analysis.
 */
export function recordEventAccounting(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  const { damage, hitDetail } = resolution;
  // Always retain hitDetails: derived hits, land-time reads, and branchKey.
  if (hitDetail) rt.hitDetails.set(event.seq, hitDetail);

  rt.totalMin += damage.min;
  rt.totalMax += damage.max;
  rt.totalExpected += damage.expected;
  rt.damageByTick[event.tick] = (rt.damageByTick[event.tick] ?? 0) + damage.expected;
  rt.endTick = Math.max(rt.endTick, event.tick + 1);

  if (keepsPerAbilityMap(rt.detailLevel)) {
    rt.perAbility[event.abilityId] = (rt.perAbility[event.abilityId] ?? 0) + damage.expected;
  }

  if (keepsAnalysisLedgers(rt.detailLevel)) {
    accountAnalysisEvent(rt.analysis, rt, event, resolution);
  }

  if (event.sourceCast >= 0) {
    const record = rt.recordBySeq.get(event.sourceCast);
    if (record) {
      record.result.expected += damage.expected;
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
  const spirit = rt.spiritEventMeta.get(event.seq);
  const remainingTicks =
    event.bleedExpiresAtTick != null
      ? Math.max(0, event.bleedExpiresAtTick - event.tick)
      : event.abilityId === "abyssal_parasite"
        ? Math.max(0, parasite.expiresAtTick - event.tick)
        : spirit
          ? Math.max(0, spirit.untilTick - event.tick)
          : undefined;
  noteHistoryEventsGrowth();
  rt.events.push({
    ...provenance,
    damage,
    ...(event.abilityId === "abyssal_parasite" ? { stackCount: parasite.stacks } : {}),
    ...(remainingTicks !== undefined ? { remainingTicks } : {}),
  });
}
