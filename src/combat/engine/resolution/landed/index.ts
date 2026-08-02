import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";
import { onMagicHitLanded } from "./magic";
import { onNecromancyHitLanded } from "./necromancy";
import { onRangedHitLanded } from "./ranged";
import { onMeleeHitLanded } from "./melee";
import type { ResolvedDamage } from "../types";

/**
 * Per-landed-hit state effects, dispatched to the style that owns them. Only
 * real hits reach here: attached damage components, conjure autos, poison ticks
 * and procs are excluded by the caller, so one real hit is one stack roll, one
 * adrenaline grant, one extension.
 */
export function applyLandedHitEffects(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  const ability = rt.byId.get(event.abilityId);
  if (event.abilityId === "abyssal_parasite") {
    onMeleeHitLanded(rt, event, undefined, damage);
    return;
  }
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
      onMeleeHitLanded(rt, event, ability, damage);
      break;
  }
}
