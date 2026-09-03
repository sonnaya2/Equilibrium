import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { calculateHit } from "../../pipeline/calculateHit";
import {
  DEVOURERS_CONTAGION_DAMAGE_BAND,
  DEVOURERS_CONTAGION_EFFECT_ID,
} from "../../passives/scriptureOfAmascut";
import type { CombatModifier, CombatStyle } from "../../types";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";
import { abilityDamageAt } from "./castHit";
import { landTimeModifiers } from "./modifiers";
import type { EventResolution, ResolvedDamage } from "./types";

function scaledDamage(damage: ResolvedDamage, targets: number): ResolvedDamage {
  return {
    ...damage,
    min: damage.min * targets,
    max: damage.max * targets,
    expected: damage.expected * targets,
    ...(damage.critExpected !== undefined ? { critExpected: damage.critExpected * targets } : {}),
    ...(damage.capLoss !== undefined ? { capLoss: damage.capLoss * targets } : {}),
  };
}

function contagionAbility(style: CombatStyle): AbilitySpec {
  return {
    id: DEVOURERS_CONTAGION_EFFECT_ID,
    name: "Devourer's Contagion",
    style,
    category: "utility",
    hits: [],
    tearingThornsEligible: true,
  };
}

function contagionSnapshot(baseMods: CombatModifier[]): CastSnapshot {
  return {
    castSeq: -1,
    critLayers: { chance: 0, guaranteed: false, eligible: false },
    baseMods,
    chaosRoarActive: false,
    channelled: false,
    greaterFuryActive: false,
    furyActive: false,
    firstEligibleHitIndex: -1,
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
    perfectEquilibriumTrigger: false,
    wenIcyPrecisionDamageAtCast: false,
    wenIcyPrecisionDamagePotentialAtCast: false,
    songEmpowered: false,
    songConflagrateActive: false,
    songTwoPieceActive: false,
    songPreCastStacks: 0,
    kerapacCombustActive: false,
    scriptureOfAmascutDamageAtCast: false,
  };
}

export function resolveDevourersContagion(
  rt: SimulationRuntime,
  at: number,
  style: CombatStyle,
  targets: number,
): EventResolution {
  const ability = contagionAbility(style);
  const provenance = { kind: "equipment_proc" as const, detail: DEVOURERS_CONTAGION_EFFECT_ID };
  const baseMods =
    typeof rt.input.modifiers === "function"
      ? rt.input.modifiers(ability)
      : [...(rt.input.modifiers ?? [])];
  const hit = calculateHit({
    base: abilityDamageAt(rt, at),
    band: DEVOURERS_CONTAGION_DAMAGE_BAND,
    level: rt.input.level,
    accuracy: rt.input.accuracy,
    crit: { chance: 0, eligible: false },
    modifiers: landTimeModifiers(
      rt,
      at,
      ability,
      contagionSnapshot(baseMods),
      0,
      true,
      false,
      "other",
      undefined,
      provenance,
    ),
    context: {
      ...rt.input.context,
      style,
      abilityCategory: "utility",
      dotKind: "other",
      damageSource: "dot",
      provenance,
    },
    provenance,
    cap: rt.input.cap,
    preciseRank: rt.input.preciseRank,
  });
  const damage = scaledDamage(
    {
      min: hit.min,
      max: hit.max,
      expected: hit.expected,
      critExpected: hit.critExpected,
      capLoss: hit.capLoss,
    },
    targets,
  );
  return { damage, hitDetail: hit };
}
