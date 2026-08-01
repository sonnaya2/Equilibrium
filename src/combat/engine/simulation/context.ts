import type { CastContext, CastContextInput } from "./contracts";
import { advanceTo } from "../runtime/clock";
import { costOf, performCast, performOffGcdCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { finish } from "./summary";
import { firstLegalTick } from "../runtime/state";

/**
 * Build one simulation's runtime and expose it as the canonical CastContext
 * shared by the manual rotation driver and Revolution.
 */
export function createCastContext(input: CastContextInput): CastContext {
  const rt = createRuntime(input);
  return {
    getState: () => rt.state,
    costOf: (ability) => costOf(rt.state, ability, rt.state.tick),
    firstLegalTick: (abilityId) => {
      const ability = rt.byId.get(abilityId);
      return firstLegalTick(
        rt.state,
        abilityId,
        ability?.cooldownGroup ?? ability?.replacementGroup,
      );
    },
    advanceTo: (targetTick) => advanceTo(rt, targetTick),
    performCast: (ability, readyTick, auto, rng) => performCast(rt, ability, readyTick, auto, rng),
    performOffGcdCast: (ability) => performOffGcdCast(rt, ability),
    cancelCastEvents: (castSeq) => rt.queue.cancelByOwner(castSeq),
    finish: (error, horizonTicks, options) => finish(rt, error, horizonTicks, options),
    byId: rt.byId,
    basicByStyle: rt.basicByStyle,
  };
}
