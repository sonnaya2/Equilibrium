import { endBerserk } from "../../styles/melee/bloodlust";
import { METEOR_STRIKE_PASSIVE_ADREN_PER_TICK } from "../../styles/melee/effects";
import { processSpiritEvent } from "../schedulers/conjures";
import { recordResolved } from "../resolution";
import { gainAdrenaline, patchMelee } from "./state";
import type { SimulationRuntime } from "./runtime";

/**
 * The canonical simulation clock. Time moves only through advanceTo: it lands
 * every queued event due by the target tick in (tick, seq) order, applies
 * passive generation over the crossed interval, expires crossed clocks, and
 * stops with state representing exactly the target tick.
 */

function processDueEvents(rt: SimulationRuntime, bound: number): void {
  for (;;) {
    const event = rt.queue.peek();
    if (!event || event.tick > bound) return;
    rt.queue.shift();
    if (event.family === "conjureAuto" || event.family === "poison") {
      processSpiritEvent(rt, event);
      continue;
    }
    recordResolved(rt, event, event.resolve(rt, event.tick));
  }
}

/** Meteor Strike passive adrenaline: constant per-tick rate while the window covers the tick. */
function grantMeteorPassive(
  rt: SimulationRuntime,
  fromTick: number,
  toTickExclusive: number,
): void {
  if (rt.state.melee.meteorStrikeUntilTick <= 0 || toTickExclusive <= fromTick) return;
  let gain = 0;
  const end = Math.min(toTickExclusive, rt.state.melee.meteorStrikeUntilTick);
  for (let t = fromTick; t < end; t++) gain += METEOR_STRIKE_PASSIVE_ADREN_PER_TICK;
  if (gain > 0) rt.state = gainAdrenaline(rt.state, gain);
}

export function advanceTo(rt: SimulationRuntime, targetTick: number): void {
  if (targetTick < rt.state.tick) return;
  // A horizon run never lands events at or after the horizon (half-open).
  processDueEvents(rt, rt.horizon != null ? Math.min(targetTick, rt.horizon - 1) : targetTick);
  grantMeteorPassive(rt, rt.state.tick, targetTick);
  if (rt.state.melee.bloodlust.berserk && targetTick >= rt.state.melee.berserkUntilTick) {
    rt.state = patchMelee(rt.state, {
      bloodlust: endBerserk(rt.state.melee.bloodlust),
      berserkUntilTick: 0,
    });
  }
  if (targetTick > rt.state.tick) rt.state = { ...rt.state, tick: targetTick };
}
