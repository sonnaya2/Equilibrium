import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { applyLandedHitEffects } from "./landed";
import type { EventResolution } from "./types";
import { recordEventAccounting } from "./accounting";
import { releaseScoreOnlyHitDetails } from "./hitDetailsRetention";
import { applyInventionProcs } from "./procs/invention";
import { scheduleBlessingDamage } from "./league/blessingDamage";

/**
 * Sole ledger-write step for a landed event (resolvers only calculate).
 * Order: (1) hit-detail + ledgers/cast/event log (2) target state (3) blessing
 * damage (4) Invention procs / Crackling / Aftershock (5) style landed-hit
 * transitions last, against pre-hit state so this hit's damage does not see its
 * own side effects.
 * Score-only then drops hitDetails no longer referenced by pending derived/LS.
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
  if ((event.procEligible || event.convertedChannel || event.bleedId != null) && !event.attached) {
    applyLandedHitEffects(rt, event, damage);
  }

  releaseScoreOnlyHitDetails(rt, event);
}
