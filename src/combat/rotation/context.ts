import type { CastContext, CastContextInput } from "./contracts";
import { advanceTo } from "./clock";
import { costOf, performCast, performOffGcdCast } from "./cast";
import { createRuntime } from "./runtime";
import { finish } from "./summary";
import { firstLegalTick } from "./state";

/**
 * Build one simulation's runtime and expose it as the canonical CastContext
 * shared by the manual rotation driver and Revolution.
 */
export function createCastContext(input: CastContextInput): CastContext {
  const rt = createRuntime(input);
  return {
    getState: () => rt.state,
    costOf: (ability) => costOf(rt, ability),
    firstLegalTick: (abilityId) => firstLegalTick(rt.state, abilityId),
    advanceTo: (targetTick) => advanceTo(rt, targetTick),
    performCast: (ability, readyTick, auto) => performCast(rt, ability, readyTick, auto),
    performOffGcdCast: (ability) => performOffGcdCast(rt, ability),
    cancelCastEvents: (castSeq) => rt.queue.cancelByOwner(castSeq),
    finish: (error, horizonTicks, options) => finish(rt, error, horizonTicks, options),
    byId: rt.byId,
    basicByStyle: rt.basicByStyle,
  };
}
