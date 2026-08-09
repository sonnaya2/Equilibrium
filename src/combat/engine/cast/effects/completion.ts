import { grantChannelledMight } from "../../../styles/magic/effects";
import { schedulePunctureAfterFinish } from "../../resolution/landed/ranged";
import { patchMagic, patchRanged } from "../../runtime/state";
import type { CastEffectContext } from "./context";
import { dracolichInfusionAtCompletion } from "../../../styles/ranged/dracolich";

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
export function applyCompletionEffects(fx: CastEffectContext, completed: boolean): void {
  if (!completed) return;
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
  if (ability.style === "ranged") {
    if (ability.id === "rapid_fire") {
      const infusion = dracolichInfusionAtCompletion(rt.input.equipmentEffects, finishTick);
      if (infusion) {
        rt.state = patchRanged(rt.state, { dracolichInfusion: infusion });
      }
    }
    const puncture = rt.state.ranged.puncture;
    const shouldSchedule =
      puncture.stacks > 0 && puncture.pendingOwnerCast === prepared.snap.castSeq;
    if (shouldSchedule) {
      schedulePunctureAfterFinish(rt, finishTick);
    }
    // Record completion so late lands (tickOffset past occupancy) schedule from land.
    const p = rt.state.ranged.puncture;
    if (p.lastCompletedCastSeq < prepared.snap.castSeq) {
      rt.state = patchRanged(rt.state, {
        puncture: { ...p, lastCompletedCastSeq: prepared.snap.castSeq },
      });
    }
  }
}
