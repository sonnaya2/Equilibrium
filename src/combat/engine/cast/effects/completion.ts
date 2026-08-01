import { grantChannelledMight } from "../../../styles/magic/effects";
import { patchMagic } from "../../runtime/state";
import type { CastEffectContext } from "./context";

/**
 * Effects that require the cast's occupancy to have finished. Applied after the
 * clock has advanced through the channel, so a mechanic can never be awarded to
 * a cast that is still running.
 *
 * Channelled Might (30 Mar 2026): completing a full Asphyxiate channel grants
 * +15% magic critical strike damage for 3.6s from the channel's end tick. The
 * simulator always completes channels; an explicit cancellation never reaches
 * here.
 */
export function applyCompletionEffects(fx: CastEffectContext): void {
  const { rt, ability, candidate } = fx;
  if (ability.id === "asphyxiate" && ability.channelTicks != null) {
    rt.state = patchMagic(rt.state, {
      channelledMight: grantChannelledMight(candidate + ability.channelTicks),
    });
  }
}
