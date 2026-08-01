import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import { FLOW_DURATION_TICKS, isConcentratedBlast } from "../../../styles/magic/effects";
import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";

/**
 * Magic state a real landed hit changes: the Concentrated Blast crit ledger and
 * Sonic Wave's Flow window.
 */
export function onMagicHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec,
): void {
  // Concentrated Blast hits stack their crit grant at land time (wiki: each
  // channelled hit increases crit chance for the next Magic attack).
  if (isConcentratedBlast(ability.id)) {
    rt.state = {
      ...rt.state,
      magicFx: { ...rt.state.magicFx, concCritStacks: rt.state.magicFx.concCritStacks + 1 },
    };
  }
  // Sonic Wave / Greater Sonic Wave grant Flow when their hit lands (wiki: "If
  // the ability successfully damages your opponent, Flow is gained") — the 9s
  // window starts at the land tick; a non-landed cast grants nothing.
  if (ability.id === "sonic_wave" || ability.id === "greater_sonic_wave") {
    rt.state = {
      ...rt.state,
      magicFx: {
        ...rt.state.magicFx,
        flowUntilTick: event.tick + FLOW_DURATION_TICKS,
        flowReduction: rt.state.magicFx.pendingFlowReduction,
        pendingFlowReduction: 0,
      },
    };
  }
}
