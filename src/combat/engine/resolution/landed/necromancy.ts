import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import { findConjure, skeletonCommandHitLanded } from "../../../styles/necromancy/conjures";
import { residualSoulCapFor } from "../../../styles/necromancy/effects";
import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";
import { patchConjures, patchNecro } from "../../runtime/state";
import type { ResolvedDamage } from "../types";

function isNecroBasicAbility(ability: AbilitySpec | undefined): boolean {
  if (!ability) return false;
  return ability.id === "necromancy_basic" || ability.autoAttack === true;
}

/**
 * Necromancy state a real landed hit changes: Soul Sap residual soul, Skeleton
 * Warrior command rage, and Soul Reave residual-soul grant on empowered basic land.
 */
export function onNecromancyHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability?: AbilitySpec,
  damage?: ResolvedDamage,
): void {
  // Soul Sap: +1 residual soul on successful land (not attached), capped.
  // https://runescape.wiki/w/Soul_Sap
  if (
    ability?.id === "soul_sap" &&
    !event.attached &&
    damage != null &&
    (damage.max > 0 || damage.expected > 0)
  ) {
    const necro = rt.state.necromancy.resources;
    const gain = (ability as { soulGain?: number }).soulGain ?? 1;
    if (gain > 0) {
      rt.state = patchNecro(rt.state, {
        residualSouls: Math.min(residualSoulCapFor(necro), necro.residualSouls + gain),
      });
    }
  }

  if (event.family === "command" && event.abilityId === "command_skeleton_warrior") {
    const spirit = findConjure(rt.state.necromancy.conjures, "skeleton_warrior");
    if (spirit) {
      rt.state = patchConjures(rt.state, {
        spirits: rt.state.necromancy.conjures.spirits.map((s) =>
          s === spirit ? skeletonCommandHitLanded(s) : s,
        ),
      });
    }
  }

  // Soul Reave: +1 residual soul on successful land of the empowered basic.
  // Once per cast (hitIndex 0); skip attached / zero-damage lands.
  // https://runescape.wiki/w/Devourer%27s_Guard
  if (event.attached || event.hitIndex !== 0) return;
  const resources = rt.state.necromancy.resources;
  if (!resources.soulReaveGrantOnLand) return;
  if (!isNecroBasicAbility(ability)) return;
  if (!damage || (damage.expected <= 0 && damage.min <= 0)) return;

  const cap = residualSoulCapFor(resources);
  rt.state = patchNecro(rt.state, {
    residualSouls: Math.min(cap, resources.residualSouls + 1),
    soulReaveGrantOnLand: false,
  });
}
