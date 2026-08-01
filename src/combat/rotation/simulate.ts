import { runicChargeReady } from "../styles/magic/runicCharge";
import { necroCanCast } from "../styles/necromancy/effects";

export type {
  AdrenalineRules,
  ProcRules,
  SimulateInput,
  SimulateOptions,
  CastRecord,
  RotationSummary,
  CastAttempt,
  CastContext,
  CastContextInput,
} from "./contracts";
import type { RotationSummary, SimulateInput, SimulateOptions } from "./contracts";
import { createCastContext } from "./context";

export { createCastContext } from "./context";

/** Deterministic expected-value run; unpayable casts return an error summary. */
export function simulate(input: SimulateInput, options?: SimulateOptions): RotationSummary {
  const ctx = createCastContext(input);

  for (const action of input.rotation) {
    const ability = ctx.byId.get(action.abilityId);
    if (!ability) return ctx.finish(`unknown ability: ${action.abilityId}`);

    if (ability.stateEffect === "runic_charge") {
      if (!runicChargeReady(ctx.getState().magic, ctx.getState().tick)) {
        return ctx.finish(`runic_charge is on cooldown at tick ${ctx.getState().tick}`);
      }
      ctx.performOffGcdCast(ability);
      continue;
    }

    if (input.autoWeave) {
      const basic = ctx.basicByStyle.get(ability.style);
      let guard = 0;
      while (
        basic &&
        (ctx.firstLegalTick(ability.id) > ctx.getState().tick ||
          ctx.costOf(ability) > ctx.getState().adrenaline ||
          !necroCanCast(
            ability,
            ctx.getState().necro,
            ctx.getState().conjures,
            ctx.getState().tick,
          ))
      ) {
        if (++guard > 200)
          return ctx.finish(
            `${ability.id} is unaffordable at tick ${ctx.getState().tick}, even weaving basics`,
          );
        const attempt = ctx.performCast(basic, ctx.getState().tick, true);
        if (!attempt.ok) return ctx.finish(attempt.error);
      }
    }

    const attempt = ctx.performCast(ability, ctx.firstLegalTick(ability.id), false);
    if (!attempt.ok) return ctx.finish(attempt.error);
  }

  return ctx.finish(undefined, undefined, options);
}
