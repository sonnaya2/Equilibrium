import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";
import { onMagicHitLanded } from "./magic";
import { onNecromancyHitLanded } from "./necromancy";
import { onRangedHitLanded } from "./ranged";

/**
 * Per-landed-hit state effects, dispatched to the style that owns them. Only
 * real hits reach here: attached damage components, conjure autos, poison ticks
 * and procs are excluded by the caller, so one real hit is one stack roll, one
 * adrenaline grant, one extension.
 *
 * Melee has no landed-hit transitions — Bloodlust and the next-hit windows are
 * all cast-scope.
 */
export function applyLandedHitEffects(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  const ability = rt.byId.get(event.abilityId);
  if (!ability) return;
  switch (ability.style) {
    case "necromancy":
      onNecromancyHitLanded(rt, event);
      break;
    case "magic":
      onMagicHitLanded(rt, event, ability);
      break;
    case "ranged":
      onRangedHitLanded(rt, event, ability);
      break;
    case "melee":
      break;
  }
}
