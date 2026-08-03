/**
 * Shared map frame budget and bloom gate.

 * MotionDriver reads these; CameraRig / plates / markers poke them.
 * Not React state - rAF already owns the loop; a store would only add
 * re-renders on every pointer move.
 */

/** Sea + idle board. e2e/map-ocean.spec counts this band. */
export const MAP_IDLE_HZ = 30;
/** Orbit, pan, focus lerp, unlock sweep. Capped - not free-run refresh. */
export const MAP_ACTIVE_HZ = 120;

/** How long after last poke we stay in the active band. */
const ACTIVITY_GRACE_MS = 450;
/** Unlock sweep (~3.2s) + settle; bloom MRT only while this is live. */
const BLOOM_GRACE_MS = 3600;

let activityUntil = 0;
let bloomUntil = 0;

export function pokeMapActivity(ms = ACTIVITY_GRACE_MS): void {
  if (typeof performance === "undefined") return;
  activityUntil = Math.max(activityUntil, performance.now() + ms);
}

export function pokeMapBloom(ms = BLOOM_GRACE_MS): void {
  if (typeof performance === "undefined") return;
  const now = performance.now();
  bloomUntil = Math.max(bloomUntil, now + ms);
  activityUntil = Math.max(activityUntil, now + ms);
}

export function mapActivityHz(): number {
  if (typeof performance === "undefined") return MAP_IDLE_HZ;
  return performance.now() < activityUntil ? MAP_ACTIVE_HZ : MAP_IDLE_HZ;
}

export function mapBloomWanted(): boolean {
  if (typeof performance === "undefined") return false;
  return performance.now() < bloomUntil;
}
