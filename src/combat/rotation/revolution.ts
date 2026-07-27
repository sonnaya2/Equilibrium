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
 * Revolution evaluation (RuneScape Wiki, current):
 * "automatically triggers the first available compatible ability on the action bar"
 * (https://runescape.wiki/w/Revolution). Available = off cooldown, affordable, and
 * state-gated. Unaffordable high-priority slots (e.g. Berserk at <100% adren) are
 * skipped — revo never waits or banks adrenaline for a later slot. Empty slots are
 * also skipped with no delay (wiki Revolution/Bars). When nothing on the bar is
 * ready, the style's basic attack fires. Deterministic EV only; same cast path as
 * queued rotations. No invented "save for ultimate" rules.
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
    // First-available scan: insufficient adren / CD / gate => not available => skip.
    const ready = input.bar.find((ability) => {
      if ((ability as MagicAbilitySpec).requiresAnima && !animaCharged(state.magic, state.tick))
        return false;
      if (!necroCanCast(ability, state.necro, state.conjures, state.tick)) return false;
      return (
        ctx.firstLegalTick(ability.id) <= state.tick && ctx.costOf(ability) <= state.adrenaline
      );
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
