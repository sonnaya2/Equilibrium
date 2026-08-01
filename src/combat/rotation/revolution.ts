import type { AbilitySpec } from "../pipeline/calculateAbility";
import { isMagicAbility } from "../styles/magic/abilities";
import { animaCharged } from "../styles/magic/runicCharge";
import { necroCanCast } from "../styles/necromancy/effects";
import type { RotationSummary, SimulateInput, SimulateOptions } from "./simulate";
import { createCastContext } from "./simulate";

export interface RevolutionInput extends Omit<SimulateInput, "rotation" | "autoWeave"> {
  bar: readonly AbilitySpec[];
  style: AbilitySpec["style"];
  durationTicks: number;
}

export function simulateRevolution(
  input: RevolutionInput,
  options?: SimulateOptions,
): RotationSummary {
  const ctx = createCastContext({ ...input, horizonTicks: input.durationTicks });
  const basic = ctx.basicByStyle.get(input.style);

  let guard = 0;
  const maxCasts = Math.max(input.durationTicks * 2, 64);

  while (ctx.getState().tick < input.durationTicks) {
    if (++guard > maxCasts) {
      return ctx.finish(
        `revolution stalled at tick ${ctx.getState().tick}: cast guard exceeded`,
        input.durationTicks,
      );
    }
    const state = ctx.getState();
    const ready = input.bar.find((ability) => {
      if (
        isMagicAbility(ability) &&
        ability.requiresAnima &&
        !animaCharged(state.magic, state.tick)
      )
        return false;
      if (!necroCanCast(ability, state.necro, state.conjures, state.tick)) return false;
      return (
        ctx.firstLegalTick(ability.id) <= state.tick && ctx.costOf(ability) <= state.adrenaline
      );
    });
    if (ready) {
      // Revolution completes channels: occupancy advances past the full channel.
      const attempt = ctx.performCast(ready, state.tick, false);
      if (!attempt.ok) return ctx.finish(attempt.error, input.durationTicks);
    } else if (basic) {
      // Basics fill every empty GCD when the bar has nothing ready/affordable.
      const attempt = ctx.performCast(basic, state.tick, true);
      if (!attempt.ok) return ctx.finish(attempt.error, input.durationTicks);
    } else {
      return ctx.finish(
        `revolution stalled at tick ${state.tick}: no bar ability ready and no basic for ${input.style}`,
        input.durationTicks,
      );
    }
  }

  return ctx.finish(undefined, input.durationTicks, options);
}
