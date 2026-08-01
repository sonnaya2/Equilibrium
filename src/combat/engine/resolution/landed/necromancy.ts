import { skeletonCommandHitLanded } from "../../../styles/necromancy/conjures";
import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";

/**
 * Necromancy state a real landed hit changes. Only the Skeleton Warrior's
 * command hits do: each builds one rage stack, on the skeleton it was commanded
 * on (damage resolved first, so the hit itself uses the pre-stack multiplier).
 */
export function onNecromancyHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  if (event.family !== "command" || event.abilityId !== "command_skeleton_warrior") return;
  const spirit = rt.state.conjures.spirits.find((s) => s.id === "skeleton_warrior");
  if (!spirit) return;
  rt.state = {
    ...rt.state,
    conjures: {
      spirits: rt.state.conjures.spirits.map((s) =>
        s === spirit ? skeletonCommandHitLanded(s) : s,
      ),
    },
  };
}
