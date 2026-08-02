import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import type { EventResolution } from "./types";

/**
 * Write generic ledgers for one landed event: totals, per-tick / per-ability
 * attribution, cast-record updates, and the provenance event log. Does not
 * schedule dependent events or apply style landed-hit transitions.
 */
export function recordEventAccounting(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  const { damage, hitDetail } = resolution;
  if (hitDetail) rt.hitDetails.set(event.seq, hitDetail);

  rt.totalMin += damage.min;
  rt.totalMax += damage.max;
  rt.totalExpected += damage.expected;
  rt.damageByTick[event.tick] = (rt.damageByTick[event.tick] ?? 0) + damage.expected;
  rt.perAbility[event.abilityId] = (rt.perAbility[event.abilityId] ?? 0) + damage.expected;
  rt.endTick = Math.max(rt.endTick, event.tick + 1);

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
        if (hitDetail) record.result.hits.push(hitDetail);
      }
    }
  }

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
  rt.events.push({
    ...provenance,
    damage,
    ...(event.abilityId === "abyssal_parasite" ? { stackCount: parasite.stacks } : {}),
    ...(remainingTicks !== undefined ? { remainingTicks } : {}),
  });
}
