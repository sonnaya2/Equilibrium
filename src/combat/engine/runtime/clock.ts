import { endBerserk } from "../../styles/melee/bloodlust";
import { METEOR_STRIKE_PASSIVE_ADREN_PER_TICK } from "../../styles/melee/effects";
import { processSpiritEvent } from "../schedulers/conjures";
import { recordResolved } from "../resolution";
import { gainAdrenaline, patchMelee } from "./state";
import type { SimulationRuntime } from "./runtime";
import { playerPoisonPrecedes } from "../schedulers/playerPoison";
import {
  nextPlayerPoisonEvent,
  processNextPlayerPoisonEvent,
} from "../schedulers/playerPoisonState";
import { applyPoisonLandEffects } from "../simulation/poisonLand";
import { temperedHeartAdrenalineGain } from "../../league/ruleset";
import { clockAdvanceBounds } from "./clockBounds";
import { applyStatefulLandRng } from "../simulation/statefulLand";
import { expirePrimordialIce } from "../../styles/melee/primordialIce";

/**
 * The canonical simulation clock. Time moves only through advanceTo: it lands
 * every queued event due by the target tick in (tick, seq) order, applies
 * passive generation over the crossed interval, expires crossed clocks, and
 * stops with state representing exactly the target tick.
 */

function processDueEvents(rt: SimulationRuntime, bound: number): void {
  for (;;) {
    const event = rt.queue.peek();
    const poison = nextPlayerPoisonEvent(rt);
    if (playerPoisonPrecedes(poison, event)) {
      if (!poison || poison.tick > bound) return;
      processNextPlayerPoisonEvent(rt, bound);
      continue;
    }
    if (!event || event.tick > bound) return;
    rt.queue.shift();
    if (event.family === "conjureAuto" || event.family === "poison") {
      processSpiritEvent(rt, event);
      continue;
    }
    // Player meta (heals / expire / revive markers): resolve mutates player state;
    // still record for timeline, then skip damage side-effects.
    if (event.family === "player") {
      const resolution = event.resolve(rt, event.tick);
      recordResolved(rt, event, resolution);
      continue;
    }
    const resolution = event.resolve(rt, event.tick);
    const landed = recordResolved(rt, event, resolution);
    applyPoisonLandEffects(rt, event, resolution.damage);
    applyStatefulLandRng(rt, event, landed.damage);
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

/** Vestments Herald timed ledger: 0.5 adren/tick while window open (15 over 18s). */
function grantVestmentsPassive(
  rt: SimulationRuntime,
  fromTick: number,
  toTickExclusive: number,
): void {
  const end = Math.min(toTickExclusive, rt.state.vestmentsAdrenalineUntilTick);
  if (end > fromTick) {
    // VESTMENTS_REGEN_PER_TICK = 0.5; kept inline so clock stays free of equipment import cycles.
    rt.state = gainAdrenaline(rt.state, (end - fromTick) * 0.5);
  }
}

function grantTemperedHeart(
  rt: SimulationRuntime,
  fromTick: number,
  toTickInclusive: number,
): void {
  const gain = temperedHeartAdrenalineGain(rt.input.league, fromTick, toTickInclusive);
  if (gain > 0) rt.state = gainAdrenaline(rt.state, gain);
}

export function advanceTo(rt: SimulationRuntime, targetTick: number): void {
  if (targetTick < rt.state.tick) return;
  const bounds = clockAdvanceBounds(targetTick, rt.horizon);
  // A horizon run never lands events at or after the horizon (half-open).
  processDueEvents(rt, bounds.eventEndInclusive);
  grantMeteorPassive(rt, rt.state.tick, bounds.perTickEndExclusive);
  grantVestmentsPassive(rt, rt.state.tick, bounds.perTickEndExclusive);
  grantTemperedHeart(rt, rt.state.tick, bounds.eventEndInclusive);
  if (rt.state.melee.bloodlust.berserk && targetTick >= rt.state.melee.berserkUntilTick) {
    rt.state = patchMelee(rt.state, {
      bloodlust: endBerserk(rt.state.melee.bloodlust),
      berserkUntilTick: 0,
    });
  }
  if (targetTick > rt.state.tick) rt.state = { ...rt.state, tick: targetTick };
  const ice = expirePrimordialIce(rt.state.melee.primordialIce, rt.state.tick);
  if (ice !== rt.state.melee.primordialIce) {
    rt.state = patchMelee(rt.state, { primordialIce: ice });
  }
}
