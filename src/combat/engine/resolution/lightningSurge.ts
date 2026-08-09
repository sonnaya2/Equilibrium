import { LIGHTNING_SURGE_ABILITY } from "../../styles/magic/abilities";
import {
  channelledMightCritBonus,
  LIGHTNING_SURGE_BAND,
  lightningSurgeExpected,
  lightningSurgeSourceWeight,
  sunshineActive,
} from "../../styles/magic/effects";
import type { SimulationRuntime } from "../runtime/runtime";
import { landTimeModifiers } from "./modifiers";
import { NO_DAMAGE, packageCritical, type EventResolution } from "./types";
import { attachedResolutionComponent, resolveLeagueAttachedHost } from "../../league/damage";
import { resolveLeagueCritAtLand } from "../../league/ruleset";
import { dynamicEquipmentCritBonus } from "../../shared/equipment";
import { activeBleedCount } from "../../styles/melee/effects";
import { resolveEffectiveCombatLevel } from "../../core/effectiveLevel";
import {
  NO_SONG_OF_DESTRUCTION,
  essenceCorruptionFlatBonus,
} from "../../styles/magic/songOfDestruction";

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
  // Same weight as schedule: concrete critOutcome or EV post-league critChance.
  const sourceCritChance = lightningSurgeSourceWeight(rt.hitDetails.get(sourceSeq));
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
    ashenVowAtCast: false,
    igneousShowdownRepeat: false,
    perfectEquilibriumAtCast: false,
    wenIcyPrecisionDamageAtCast: false,
    wenIcyPrecisionDamagePotentialAtCast: false,
    songEmpowered: false,
    songConflagrateActive: false,
    songTwoPieceActive: false,
    songPreCastStacks: 0,
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
  const level = resolveEffectiveCombatLevel(input.level, state.player?.levelOverride, at);
  const essenceFlat = essenceCorruptionFlatBonus(
    input.equipmentEffects?.songOfDestruction ?? NO_SONG_OF_DESTRUCTION,
    state.magic.song.essenceCorruption,
    at,
    level,
    LIGHTNING_SURGE_ABILITY,
    provenance,
  );
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
    level,
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
    ...(essenceFlat > 0 ? { postDamagePotentialFlat: essenceFlat } : {}),
  });
  // Pure host for materialize (same contract as castHit / Inferno). Shared riders
  // stay in components; hitDetail must not already include them.
  const base = host.baseHit;
  const components = host.components.map((component) =>
    attachedResolutionComponent(component, sourceCritChance, 0, 0),
  );
  let expected = lightningSurgeExpected(sourceCritChance, base.expected);
  let critExpected = lightningSurgeExpected(sourceCritChance, base.critExpected);
  let capLoss = lightningSurgeExpected(sourceCritChance, base.capLoss);
  for (const component of components) {
    expected += component.damage.expected;
    critExpected += component.damage.critExpected ?? component.damage.expected;
    capLoss += component.damage.capLoss ?? 0;
  }
  return {
    damage: {
      min: 0,
      max: 0,
      expected,
      critExpected,
      capLoss,
      critical: packageCritical(
        base.critChance,
        base.critExpected,
        base.nonCritExpected,
        { scale: sourceCritChance },
      ),
    },
    hitDetail: base,
    ...(base.postDamagePotentialFlatContribution !== undefined
      ? {
          postDamagePotentialFlatContribution: lightningSurgeExpected(
            sourceCritChance,
            base.postDamagePotentialFlatContribution,
          ),
        }
      : {}),
    ...(components.length > 0 ? { components } : {}),
  };
}
