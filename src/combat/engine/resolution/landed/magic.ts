import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import {
  armTsunamiCritAdren,
  FLOW_DURATION_TICKS,
  instabilityActive,
  isConcentratedBlast,
  LIGHTNING_SURGE_TICK_DELAY,
} from "../../../styles/magic/effects";
import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import { patchMagic } from "../../runtime/state";
import type { ResolvedDamage } from "../types";
import { resolveLightningSurge } from "../lightningSurge";

/**
 * Magic state a real landed hit changes: Conc Blast crit ledger, Sonic Flow,
 * and Tsunami crit-adrenaline state.
 */
export function onMagicHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec,
  damage?: ResolvedDamage,
): void {
  const snap = event.castSnap;
  const lightningSurgeChance = rt.hitDetails.get(event.seq)?.critChance ?? 0;
  if (
    event.lightningSurge &&
    snap &&
    snap.magicWeaponAtCast &&
    instabilityActive(rt.state.magic.instability, event.tick) &&
    lightningSurgeChance > 0
  ) {
    scheduleEvent(rt, {
      tick: event.tick + LIGHTNING_SURGE_TICK_DELAY,
      family: "proc",
      abilityId: "instability_lightning_surge",
      sourceCast: event.sourceCast,
      hitIndex: event.hitIndex,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      expectedOccurrences: lightningSurgeChance,
      expectedTriggerRolls: 0,
      expectedActivations: lightningSurgeChance,
      expectedSeparateHits: lightningSurgeChance,
      lightningSurgeSourceCritChance: lightningSurgeChance,
      originKind: "proc",
      provenance: { kind: "equipment_proc", detail: "lightning_surge" },
      derivedFrom: event.seq,
      resolve: (eventRt, at) => resolveLightningSurge(eventRt, at, event.seq),
    });
  }
  // Concentrated Blast hits stack their crit grant at land time (wiki: each
  // channelled hit increases crit chance for the next Magic attack).
  if (isConcentratedBlast(ability.id)) {
    rt.state = patchMagic(rt.state, { concCritStacks: rt.state.magic.concCritStacks + 1 });
  }
  // Sonic Wave / Greater Sonic Wave grant Flow when their hit lands (wiki: "If
  // the ability successfully damages your opponent, Flow is gained") - the 9s
  // window starts at the land tick; a non-landed cast grants nothing.
  if (ability.id === "sonic_wave" || ability.id === "greater_sonic_wave") {
    rt.state = patchMagic(rt.state, {
      flowUntilTick: event.tick + FLOW_DURATION_TICKS,
      flowReduction: event.flowReduction ?? 0,
    });
  }
  // Tsunami arms/refreshes the crit-adren window when the hit deals damage
  // (wiki: includes damage-immune targets; sim uses max/expected > 0).
  if (ability.id === "tsunami" && damage != null && (damage.max > 0 || damage.expected > 0)) {
    rt.state = patchMagic(rt.state, {
      tsunamiCritAdrenUntilTick: armTsunamiCritAdren(event.tick),
    });
  }
}
