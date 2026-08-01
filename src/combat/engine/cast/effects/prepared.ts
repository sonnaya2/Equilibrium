import { spendBloodlust } from "../../../styles/melee/bloodlust";
import { patchState, type CastEffectContext } from "./context";

/**
 * Apply the transitions preparation decided, in the order it recorded them.
 * These are the consumptions a cast pays for the variant it already resolved,
 * so they land before cooldowns, resources and style grants.
 */
export function applyPreparedTransitions(fx: CastEffectContext): void {
  for (const transition of fx.prepared.transitions) {
    switch (transition.kind) {
      case "spendBloodlust":
        patchState(fx, { melee: spendBloodlust(fx.rt.state.melee, transition.stacks) });
        break;
      case "grantEndlessAssault":
        patchState(fx, { endlessAssaultUntilTick: transition.untilTick });
        break;
      case "consumeEndlessAssault":
        patchState(fx, { endlessAssaultUntilTick: 0 });
        break;
      case "consumeChaosRoar":
        patchState(fx, { chaosRoarUntilTick: 0 });
        break;
      case "consumeGreaterFury":
        patchState(fx, { greaterFuryUntilTick: 0 });
        break;
      case "consumeFury":
        patchState(fx, { furyCritBonus: false });
        break;
    }
  }
}
