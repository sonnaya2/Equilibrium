import { resolveEffectiveCombatLevel } from "../../core/effectiveLevel";
import { NARAGI_LEVEL_OVERRIDE } from "../../league/naragiEdict";
import { resolveLeagueAttachedHost } from "../../league/damage";
import { FROST_SURGE_ABILITY, FROST_SURGE_BAND } from "../../styles/magic/ancientSpells";
import { effectiveBaseArmourAtTick } from "../../styles/ranged/blackStone";
import { liveTargetDamagePotential } from "../../target/genericTarget";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";
import { landTimeModifiers } from "./modifiers";
import type { EventResolution, ResolvedDamage } from "./types";

const FROST_SURGE_PROVENANCE = { kind: "spell_proc" as const, detail: "frost_surge" };

function scaledDamage(damage: ResolvedDamage, targets: number): ResolvedDamage {
  return {
    ...damage,
    min: damage.min * targets,
    max: damage.max * targets,
    expected: damage.expected * targets,
    ...(damage.critExpected !== undefined ? { critExpected: damage.critExpected * targets } : {}),
    ...(damage.capLoss !== undefined ? { capLoss: damage.capLoss * targets } : {}),
    ...(damage.critical
      ? {
          critical: {
            ...damage.critical,
            contribution: damage.critical.contribution * targets,
          },
        }
      : {}),
  };
}

export function resolveFrostSurge(
  rt: SimulationRuntime,
  at: number,
  sourceCast: number,
  targets: number,
): EventResolution {
  const { input, state } = rt;
  const baseMods =
    typeof input.modifiers === "function"
      ? input.modifiers(FROST_SURGE_ABILITY)
      : (input.modifiers ?? []);
  const snap = {
    castSeq: sourceCast,
    critLayers: { chance: 0, eligible: false },
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
    kerapacCombustActive: false,
  } as CastSnapshot;
  const level = resolveEffectiveCombatLevel(input.level, state.player?.levelOverride, at);
  const overrideLevel = input.overrideLevel ?? NARAGI_LEVEL_OVERRIDE;
  const base =
    input.overrideBase != null &&
    level === overrideLevel &&
    state.player?.levelOverride != null &&
    at < state.player.levelOverride.untilTick
      ? input.overrideBase
      : input.base;
  const targetProfile = input.targetAccuracyProfile;
  const accuracy = targetProfile
    ? liveTargetDamagePotential(targetProfile, {
        ...(state.target.blackStone
          ? { blackStone: { state: state.target.blackStone, currentTick: at } }
          : {}),
        equipmentEffects: input.equipmentEffects,
      })
    : input.accuracy;
  const modifiers = landTimeModifiers(
    rt,
    at,
    FROST_SURGE_ABILITY,
    snap,
    0,
    false,
    false,
    undefined,
    undefined,
    FROST_SURGE_PROVENANCE,
  );
  const host = resolveLeagueAttachedHost({
    rules: input.league,
    source: FROST_SURGE_PROVENANCE,
    landTick: at,
    base,
    band: FROST_SURGE_BAND,
    level,
    accuracy,
    crit: { chance: 0, eligible: false },
    modifiers,
    context: {
      ...input.context,
      style: "magic",
      abilityCategory: FROST_SURGE_ABILITY.category,
      basicAttack: false,
      damageSource: "proc",
      provenance: FROST_SURGE_PROVENANCE,
    },
    cap: input.cap,
  });
  return {
    damage: scaledDamage(host.baseHit, targets),
    hitDetail: host.baseHit,
  };
}
