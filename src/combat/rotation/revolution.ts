import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { MagicAbilitySpec } from "../styles/magic/abilities";
import { animaCharged } from "../styles/magic/runicCharge";
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

  while (ctx.getState().tick < input.durationTicks) {
    const state = ctx.getState();
    const ready = input.bar.find((ability) => {
      if ((ability as MagicAbilitySpec).requiresAnima && !animaCharged(state.magic, state.tick)) return false;
      return ctx.firstLegalTick(ability.id) <= state.tick && ctx.costOf(ability) <= state.adrenaline;
    });
    if (ready) {
      ctx.performCast(ready, state.tick, false);
    } else if (basic) {
      ctx.performCast(basic, state.tick, true);
    } else {
      return ctx.finish(`revolution stalled at tick ${state.tick}: no bar ability ready and no basic for ${input.style}`);
    }
  }

  return ctx.finish();
}
