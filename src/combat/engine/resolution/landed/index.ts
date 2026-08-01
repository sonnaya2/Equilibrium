import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";
import { onMagicHitLanded } from "./magic";
import { onNecromancyHitLanded } from "./necromancy";
import { onRangedHitLanded } from "./ranged";
import { secondsToTicks } from "../../../core/ticks";
import { GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS } from "../../../styles/melee/effects";
import { patchMelee } from "../../runtime/state";

/**
 * Per-landed-hit state effects, dispatched to the style that owns them. Only
 * real hits reach here: attached damage components, conjure autos, poison ticks
 * and procs are excluded by the caller, so one real hit is one stack roll, one
 * adrenaline grant, one extension.
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
      if (
        ability.id === "greater_flurry" &&
        rt.state.melee.bloodlust.berserk &&
        event.tick < rt.state.melee.berserkUntilTick
      ) {
        rt.state = patchMelee(rt.state, {
          berserkUntilTick:
            rt.state.melee.berserkUntilTick +
            secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS),
        });
      }
      break;
  }
}
