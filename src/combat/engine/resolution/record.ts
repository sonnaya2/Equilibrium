import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { applyLandedHitEffects } from "./landed";
import type { EventResolution } from "./types";
import { recordEventAccounting } from "./accounting";
import { releaseScoreOnlyHitDetails } from "./hitDetailsRetention";
import { applyInventionProcs } from "./procs/invention";
import { applyBlessingDamage } from "./league/blessingDamage";
import { applyLeagueLandedHitEffects } from "./landed/league";
import { noteAttachedTermsResolved } from "../../profiling/allocation";
import { applyDeathMarkLanded } from "./landed/deathMark";
import { applyBotlgLanded } from "./botlg";

function materializeCriticalOutcome(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
  inheritedOutcome?: boolean,
): EventResolution {
  const existingOutcome = resolution.damage.critical?.outcome;
  const critical = resolution.damage.critical;
  if (!critical || critical.mode === "none") return resolution;
  const outcome =
    existingOutcome ??
    inheritedOutcome ??
    (critical.mode === "guaranteed"
      ? true
      : rt.stochastic.bernoulli(`land:critical:${event.seq}`, critical.chance));
  const damage = {
    ...resolution.damage,
    critical: { ...critical, outcome },
  };
  const hitDetail = resolution.hitDetail
    ? { ...resolution.hitDetail, critOutcome: outcome }
    : undefined;
  const components = resolution.components?.map((component) => {
    const componentCritical = component.damage.critical;
    return {
      ...component,
      hitDetail: component.hitDetail
        ? { ...component.hitDetail, critOutcome: outcome }
        : component.hitDetail,
      damage: componentCritical
        ? { ...component.damage, critical: { ...componentCritical, outcome } }
        : component.damage,
    };
  });
  return {
    ...resolution,
    damage,
    ...(hitDetail ? { hitDetail } : {}),
    ...(components ? { components } : {}),
  };
}

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
): EventResolution {
  const landed = materializeCriticalOutcome(rt, event, resolution);
  const composed =
    event.family === "status"
      ? landed
      : materializeCriticalOutcome(
          rt,
          event,
          applyBlessingDamage(rt, event, landed),
          landed.damage.critical?.outcome,
        );
  noteAttachedTermsResolved(composed.components?.length ?? 0);
  recordEventAccounting(rt, event, composed);
  applyDeathMarkLanded(rt, event, composed.damage.expected);

  if (event.family === "status") {
    releaseScoreOnlyHitDetails(rt, event);
    return composed;
  }

  applyBotlgLanded(rt, event, landed);

  const { damage } = composed;
  if (!event.blessingId) applyInventionProcs(rt, event, damage);

  if (!event.attached && event.family === "dot") {
    applyLeagueLandedHitEffects(rt, event, damage);
  }

  // Endless Assault damage is not proc-eligible, but it is still the original
  // channel hit for ability-owned landed effects such as Greater Flurry's
  // Berserk extension.
  if ((event.procEligible || event.convertedChannel || event.bleedId != null) && !event.attached) {
    applyLandedHitEffects(rt, event, damage);
  }

  releaseScoreOnlyHitDetails(rt, event);
  return composed;
}
