import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { applyLandedHitEffects } from "./landed";
import type { EventResolution } from "./types";
import { recordEventAccounting } from "./accounting";
import { applyInventionProcs } from "./procs/invention";
import { scheduleBlessingDamage } from "./league/blessingDamage";

/**
 * Record one landed event: damage ledgers, tick/ability attribution, the owning
 * cast record, the hit detail later derived hits read, and the event log
 * (provenance kept, resolve closure dropped). Recording is the only step that
 * writes to the runtime's ledgers — resolvers only calculate.
 *
 * Canonical order:
 * 1. hit-detail cache + generic ledgers / cast attribution / event log
 * 2. schedule blessing-generated damage
 * 3. apply Invention proc charge + schedule Crackling / Aftershock
 * 4. style landed-hit state transitions (against pre-hit state for this event)
 *
 * Landed-hit state transitions run last, so a hit's own damage is resolved
 * against the state that preceded it.
 */
export function recordResolved(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  recordEventAccounting(rt, event, resolution);

  const { damage } = resolution;
  scheduleBlessingDamage(rt, event, damage);
  if (!event.blessingId) applyInventionProcs(rt, event, damage);

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
