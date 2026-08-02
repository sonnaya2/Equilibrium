import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { applyLandedHitEffects } from "./landed";
import type { EventResolution } from "./types";

/**
 * Record one landed event: damage ledgers, tick/ability attribution, the owning
 * cast record, the hit detail later derived hits read, and the event log
 * (provenance kept, resolve closure dropped). Recording is the only step that
 * writes to the runtime's ledgers — resolvers only calculate.
 *
 * Landed-hit state transitions run last, so a hit's own damage is resolved
 * against the state that preceded it.
 */
export function recordResolved(
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
      // Attached components and procs fold into the cast's expected total only:
      // they are not separate hits, so they never extend the min/max span or the
      // per-hit breakdown.
      if (event.family !== "proc" && !event.attached) {
        record.result.min += damage.min;
        record.result.max += damage.max;
        if (hitDetail) record.result.hits.push(hitDetail);
      }
    }
  }

  const { resolve: _resolve, ...provenance } = event;
  rt.events.push({ ...provenance, damage });

  // Endless Assault damage is not proc-eligible, but it is still the original
  // channel hit for ability-owned landed effects such as Greater Flurry's
  // Berserk extension.
  if (
    (event.procEligible ||
      event.convertedChannel ||
      event.bleedId != null ||
      event.abyssalParasiteEligible) &&
    !event.attached
  ) {
    applyLandedHitEffects(rt, event, damage);
  }
}
