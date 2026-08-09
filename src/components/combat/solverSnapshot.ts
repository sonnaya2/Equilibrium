/**
 * UI -> combat-domain adapters for Revolution solver packing.
 * Keeps CalcStats / Loadout types out of src/combat/solver.
 *
 * Sole production adapter: ResolvedCombatModel → SolverPackSnapshot
 * (host already resolved helmet/salve/arch/RoV - no re-derive).
 */
import type { ResolvedCombatModel } from "@/combat/model";
import type { SolverPackSnapshot } from "@/combat/solver";

/**
 * Preferred adapter: copy only pre-resolved model fields.
 * No re-derive from raw Loadout perks/slots/buffs.
 */
export function solverSnapshotFromResolvedModel(model: ResolvedCombatModel): SolverPackSnapshot {
  const sources = model.modifierSources;
  return {
    base: model.base,
    level: model.level,
    ...(model.overrideBase != null ? { overrideBase: model.overrideBase } : {}),
    ...(model.overrideLevel != null ? { overrideLevel: model.overrideLevel } : {}),
    ...(model.activateNaragiAtStart === true ? { activateNaragiAtStart: true } : {}),
    accuracy: model.accuracy,
    crit: {
      chance: model.crit.chance,
      disabled: model.crit.disabled,
      damageBonus: model.crit.damageBonus,
      critualConvertedDamageBonus: model.crit.critualConvertedDamageBonus,
    },
    adrenaline: model.adrenaline,
    procs: model.procs,
    plantedFeet: model.plantedFeet,
    strengthCape99: model.strengthCape99,
    preciseRank: model.preciseRank,
    ammo: model.ammo,
    caroming: model.caromingRank,
    conjureBasicDamageMult: model.conjureBasicDamageMult,
    conjureDurationMult: model.conjureDurationMult,
    tumekensPieces: model.tumekensPieces,
    equipmentEffects: model.equipmentEffects,
    league: {
      ...model.league,
      blessingIds: [...model.league.blessingIds],
      relics: [...(model.league.relics ?? [])],
      powerburstUntilTick: Math.max(0, Math.floor(model.league.powerburstUntilTick ?? 0)),
    },
    context: model.context,
    targetHpPercent: model.target.hpPercent,
    targetMaximumLifePoints: model.target.maximumLifePoints,
    playerPoison: { ...model.playerPoison },
    targetPoisonImmune: model.target.poisonImmune === true,
    cap: model.cap,
    startingAdrenaline: model.startingAdrenaline,
    equipmentIds: model.equipmentIds,
    weaponConfiguration: model.weaponConfiguration,
    // Precomputed sources only - pack must not re-scan slots for these.
    setCounts: [...sources.setCounts].map(([id, n]) => [id, n] as const),
    vulnerability: sources.vulnerability === true,
    styleCurseId: sources.styleCurseId ?? "none",
    amZiFlatDamage: sources.amZiFlatDamage ?? 0,
    amHejDamageBonus: sources.amHejDamageBonus ?? 0,
    slayer: {
      demon: sources.slayer.demon ?? 0,
      dragon: sources.slayer.dragon ?? 0,
      undead: sources.slayer.undead ?? 0,
    },
    target: {
      demon: sources.target.demon,
      dragon: sources.target.dragon,
      undead: sources.target.undead,
    },
    slayerHelmet: sources.slayerHelmet ?? null,
    salve: sources.salve ?? null,
    ultimatums: sources.ultimatums ?? 0,
    lunging: sources.lunging ?? 0,
    berserkersFuryBonus: sources.berserkersFuryBonus ?? 0,
  };
}
