import { grantChannelledMight } from "../../../styles/magic/effects";
import { schedulePunctureAfterFinish } from "../../resolution/landed/ranged";
import { patchMagic } from "../../runtime/state";
import type { CastEffectContext } from "./context";

/**
 * Effects that require the cast's occupancy to have finished. Applied after the
 * clock has advanced through the channel, so a mechanic can never be awarded to
 * a cast that is still running.

 * Channelled Might (30 Mar 2026): completing a full Asphyxiate channel grants
 * +15% magic critical strike damage for 3.6s from the channel's end tick. The
 * simulator always completes channels; an explicit cancellation never reaches
 * here.

 * Puncture (splintering): sequence starts 1 tick after the applying ability
 * finishes; multi-hit casts share one restart via pendingOwnerCast.
 */
export function applyCompletionEffects(fx: CastEffectContext): void {
  const { rt, ability, working, candidate, prepared } = fx;
  if (ability.id === "asphyxiate" && working.channelTicks != null) {
    rt.state = patchMagic(rt.state, {
      channelledMight: grantChannelledMight(
        candidate + working.channelTicks,
        (rt.input.tumekensPieces ?? 0) >= 5,
      ),
    });
  }
  const finishTick = candidate + prepared.occupancyTicks;
  const puncture = rt.state.ranged.puncture;
  if (
    ability.style === "ranged" &&
    puncture.stacks > 0 &&
    puncture.pendingOwnerCast === prepared.snap.castSeq
  ) {
    schedulePunctureAfterFinish(rt, finishTick);
  }
}
