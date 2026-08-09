import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { costOf, performCast, performOffGcdCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { DEFAULT_STOCHASTIC_LANES } from "../runtime/stochastic";
import { firstLegalTick, firstLegalTickFor } from "../runtime/state";
import type {
  CastAttempt,
  CastContext,
  CastContextInput,
  CastRng,
  SimulateOptions,
} from "./contracts";
import { finish } from "./summary";

export function createCastContext(input: CastContextInput): CastContext {
  const rt = createRuntime(input, { laneIndex: 0, laneCount: DEFAULT_STOCHASTIC_LANES });
  return {
    getState: () => rt.state,
    costOf: (ability) => costOf(rt.state, ability, rt.state.tick),
    firstLegalTick: (abilityId) => {
      const ability = rt.byId.get(abilityId);
      return ability
        ? firstLegalTickFor(rt.state, ability, rt.input.level)
        : firstLegalTick(rt.state, abilityId);
    },
    advanceTo: (targetTick) => advanceTo(rt, targetTick),
    performCast: (
      ability: AbilitySpec,
      readyTick: number,
      auto: boolean,
      rng?: CastRng,
    ): CastAttempt => performCast(rt, ability, readyTick, auto, rng),
    performOffGcdCast: (ability) => performOffGcdCast(rt, ability),
    cancelCastEvents: (castSeq) => rt.queue.cancelByOwner(castSeq),
    finish: (error?: string, horizonTicks?: number, options?: SimulateOptions) =>
      finish(rt, error, horizonTicks ?? input.horizonTicks, options),
    byId: rt.byId,
    basicByStyle: rt.basicByStyle,
  };
}
