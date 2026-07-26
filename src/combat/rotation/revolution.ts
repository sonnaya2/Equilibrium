import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { MagicAbilitySpec } from "../styles/magic/abilities";
import { animaCharged } from "../styles/magic/runicCharge";
import { necroCanCast } from "../styles/necromancy/effects";
import type { RotationSummary, SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";

export interface RevolutionInput extends Omit<SimulateInput, "rotation" | "autoWeave"> {
  /** Modelled bar slots in priority order — the first ready and affordable fires. */
  bar: readonly AbilitySpec[];
  /** The bar's style; its basic attack fires when no slot is ready (§5.6). */
  style: AbilitySpec["style"];
  /** Revolution is continuous; the sim runs to this horizon. DoT tails land past it
   *  on their sourced ticks and still count. */
  durationTicks: number;
}

/**
 * Revolution evaluation (RuneScape Wiki, current): each global-cooldown slot fires
 * the first bar ability that is off cooldown, affordable, and passes its state
 * gates; when nothing is ready the style's basic attack fires. Deterministic and
 * expected-value only, sharing the single cast path with queued rotations.
 */
export function simulateRevolution(input: RevolutionInput): RotationSummary {
  const ctx = createCastContext(input);
  const basic = ctx.basicByStyle.get(input.style);

  // Guard against infinite loops if GCD never advances (should never happen).
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
      if ((ability as MagicAbilitySpec).requiresAnima && !animaCharged(state.magic, state.tick)) return false;
      if (!necroCanCast(ability, state.necro)) return false;
      // Skip pure-buff ultimates that cost adren we don't have yet — revo never waits.
      return ctx.firstLegalTick(ability.id) <= state.tick && ctx.costOf(ability) <= state.adrenaline;
    });
    if (ready) {
      ctx.performCast(ready, state.tick, false);
    } else if (basic) {
      // Basics fill every empty GCD when the bar has nothing ready/affordable.
      ctx.performCast(basic, state.tick, true);
    } else {
      return ctx.finish(
        `revolution stalled at tick ${state.tick}: no bar ability ready and no basic for ${input.style}`,
        input.durationTicks,
      );
    }
  }

  // DPS is over the requested horizon (e.g. 60s), not just the last GCD edge.
  return ctx.finish(undefined, input.durationTicks);
}
