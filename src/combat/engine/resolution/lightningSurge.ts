import { LIGHTNING_SURGE_ABILITY } from "../../styles/magic/abilities";
import {
  channelledMightCritBonus,
  LIGHTNING_SURGE_BAND,
  lightningSurgeExpected,
  sunshineActive,
} from "../../styles/magic/effects";
import type { SimulationRuntime } from "../runtime/runtime";
import { landTimeModifiers } from "./modifiers";
import { NO_DAMAGE, packageCritical, type EventResolution } from "./types";
import { attachedResolutionComponent, resolveLeagueAttachedHost } from "../../league/damage";
import { resolveLeagueCritAtLand } from "../../league/ruleset";
import { dynamicEquipmentCritBonus } from "../../shared/equipment";
import { activeBleedCount } from "../../styles/melee/effects";

/**
 * Resolve an Instability Lightning Surge proc at its own land tick: EV = the
 * source hit's crit chance (from its landed detail) × the surge hit's expected,
 * recomputed against land-time state. min/max stay 0 - the surge is EV-only,
 * and it is never itself proc-eligible, so it cannot chain another surge.

 * Modifiers use the explicit proc identity; parent ability crit layers do not
 * cross the proc boundary.
 */
export function resolveLightningSurge(
  rt: SimulationRuntime,
  at: number,
  sourceSeq: number,
): EventResolution {
  const { input, state } = rt;
  const sourceCritChance = rt.hitDetails.get(sourceSeq)?.critChance ?? 0;
  if (sourceCritChance <= 0) return NO_DAMAGE;
  const baseMods =
    typeof input.modifiers === "function"
      ? input.modifiers(LIGHTNING_SURGE_ABILITY)
      : (input.modifiers ?? []);
  const surgeSnap = {
    castSeq: -1,
    critLayers: { ...input.crit },
    baseMods,
    chaosRoarActive: false,
    channelled: false,
    greaterFuryActive: false,
    furyActive: false,
    firstEligibleHitIndex: 0,
    empowerMult: 1,
    searingWindsAtCast: false,
    hauntedAtCast: false,
    hauntedCapAd: 0,
    enduringRuinBonus: 0,
    magicWeaponAtCast: false,
    surgingStormAtCast: false,
  } as const;
  const equipmentCrit = dynamicEquipmentCritBonus(
    input.equipmentEffects,
    LIGHTNING_SURGE_ABILITY,
    0,
    activeBleedCount(state.target.melee, at),
  );
  const modifiers = landTimeModifiers(rt, at, LIGHTNING_SURGE_ABILITY, surgeSnap, 0, false);
  // Equipment proc: never onHitGear (Slayer/Salve). Not recursive proc-eligible.
  const provenance = { kind: "equipment_proc" as const, detail: "lightning_surge" };
  const rawCrit = {
    ...surgeSnap.critLayers,
    chance:
      surgeSnap.critLayers.chance +
      (sunshineActive(state.magic.sunshine, at)
        ? (input.equipmentEffects?.setCritChance?.conditional.sunshine ?? 0)
        : 0) +
      equipmentCrit.chance,
    damageBonus:
      (surgeSnap.critLayers.damageBonus ?? 0) +
      channelledMightCritBonus(state.magic.channelledMight, at) +
      equipmentCrit.damageBonus,
    eligible: true,
  };
  const crit = resolveLeagueCritAtLand(input.league, rawCrit);
  const host = resolveLeagueAttachedHost({
    rules: input.league,
    source: provenance,
    landTick: at,
    base: input.base,
    band: LIGHTNING_SURGE_BAND,
    level: input.level,
    accuracy: input.accuracy,
    crit,
    modifiers,
    provenance,
    context: {
      ...input.context,
      style: "magic",
      abilityCategory: LIGHTNING_SURGE_ABILITY.category,
      basicAttack: false,
      damageSource: "proc",
      provenance,
    },
    cap: input.cap,
  });
  return {
    damage: {
      min: 0,
      max: 0,
      expected: lightningSurgeExpected(sourceCritChance, host.hit.expected),
      capLoss: lightningSurgeExpected(sourceCritChance, host.hit.capLoss),
      critical: packageCritical(
        host.hit.critChance,
        host.hit.critExpected,
        host.hit.nonCritExpected,
        { scale: sourceCritChance },
      ),
    },
    hitDetail: host.hit,
    ...(host.components.length > 0
      ? {
          components: host.components.map((component) =>
            attachedResolutionComponent(component, sourceCritChance, 0, 0),
          ),
        }
      : {}),
  };
}
