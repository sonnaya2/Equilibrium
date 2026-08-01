import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import {
  extendSearingWinds,
  onRangedHit,
  shadowImbuedAdrenalinePerHit,
} from "../../../styles/ranged/onHit";
import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";
import { gainAdrenaline, patchRanged } from "../../runtime/state";

/**
 * Ranged state a real landed hit changes: a Deathspore stack, Shadow Imbued's
 * per-hit adrenaline, and Rapid Fire's Searing Winds extension.
 */
export function onRangedHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec,
): void {
  if (rt.input.ammo === "deathspore") {
    rt.state = patchRanged(rt.state, {
      deathspore: onRangedHit(rt.state.ranged.deathspore, event.tick),
    });
  }
  const perHit = shadowImbuedAdrenalinePerHit(rt.state.ranged.shadowImbued, event.tick);
  if (perHit > 0) rt.state = gainAdrenaline(rt.state, perHit);
  // Rapid Fire: each landed hit extends an active Searing Winds by 1 tick (wiki).
  if (ability.id === "rapid_fire" && event.tick < rt.state.ranged.searingWinds.expiresAtTick) {
    rt.state = patchRanged(rt.state, {
      searingWinds: extendSearingWinds(rt.state.ranged.searingWinds, 1),
    });
  }
}
