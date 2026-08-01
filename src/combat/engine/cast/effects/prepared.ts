import { spendBloodlust } from "../../../styles/melee/bloodlust";
import { patchMelee } from "../../runtime/state";
import type { CastEffectContext } from "./context";

/**
 * Apply the transitions preparation decided, in the order it recorded them.
 * These are the consumptions a cast pays for the variant it already resolved,
 * so they land before cooldowns, resources and style grants.
 */
export function applyPreparedTransitions(fx: CastEffectContext): void {
  const { rt } = fx;
  for (const transition of fx.prepared.transitions) {
    switch (transition.kind) {
      case "spendBloodlust":
        rt.state = patchMelee(rt.state, {
          bloodlust: spendBloodlust(rt.state.melee.bloodlust, transition.stacks),
        });
        break;
      case "grantEndlessAssault":
        rt.state = patchMelee(rt.state, { endlessAssaultUntilTick: transition.untilTick });
        break;
      case "consumeEndlessAssault":
        rt.state = patchMelee(rt.state, { endlessAssaultUntilTick: 0 });
        break;
      case "consumeChaosRoar":
        rt.state = patchMelee(rt.state, { chaosRoarUntilTick: 0 });
        break;
      case "consumeGreaterFury":
        rt.state = patchMelee(rt.state, { greaterFuryUntilTick: 0 });
        break;
      case "consumeFury":
        rt.state = patchMelee(rt.state, { furyCritBonus: false });
        break;
    }
  }
}
