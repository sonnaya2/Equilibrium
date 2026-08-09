import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";

/** Pending events that still need source HitResult at land time. */
export function hitDetailStillNeeded(rt: SimulationRuntime, seq: number): boolean {
  for (const e of rt.queue.pending()) {
    if (e.derivedFrom === seq) return true;
  }
  return false;
}

/**
 * Score-only stores HitResult only when a later land may read it:
 * pre-scheduled derived tails/bounces, or Lightning Surge (scheduled post-land).
 * full-analysis / summary keep every landed detail for presentation.
 */
export function shouldRetainHitDetail(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): boolean {
  if (rt.detailLevel !== "score-only") return true;
  if (event.lightningSurge) return true;
  return hitDetailStillNeeded(rt, event.seq);
}

/** Drop unreferenced score-only hitDetails after land side effects. */
export function releaseScoreOnlyHitDetails(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  if (rt.detailLevel !== "score-only") return;
  if (event.derivedFrom != null && !hitDetailStillNeeded(rt, event.derivedFrom)) {
    rt.hitDetails.delete(event.derivedFrom);
  }
  if (rt.hitDetails.has(event.seq) && !hitDetailStillNeeded(rt, event.seq)) {
    rt.hitDetails.delete(event.seq);
  }
}

/** Seq set of live derivedFrom sources for score-only retention. */
export function liveDerivedSourceSeqs(rt: SimulationRuntime): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const e of rt.queue.pending()) {
    const d = e.derivedFrom;
    if (d == null || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  out.sort((a, b) => a - b);
  return out;
}
