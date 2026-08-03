/**
 * UI → combat-domain adapter for Revolution solver packing.
 * Keeps CalcStats / Loadout types out of src/combat/solver.
 */
import type { CalcStats } from "./loadoutStats";
import type { Loadout } from "./loadout/model";
import { serializeLeague, type SolverPackSnapshot } from "@/combat/solver";
import { resolveSalve } from "@/combat/shared/salveAmulet";
import { resolveSlayerHelmet } from "@/combat/shared/slayerHelmet";

export function solverSnapshotFromUi(stats: CalcStats, loadout: Loadout): SolverPackSnapshot {
  const slayerHelmet = resolveSlayerHelmet({
    equipmentSlots: loadout.equipmentSlots,
    standTier: loadout.buffs.slayerHelmetStand,
    onSlayerTask: loadout.target?.onSlayerTask === true,
    style: loadout.style,
    ensouledSpectralLens: loadout.buffs.ensouledSpectralLens,
  });
  const salve = resolveSalve({
    equipmentSlots: loadout.equipmentSlots,
    targetUndead: loadout.target?.undead === true,
  });
  return {
    base: stats.base,
    level: stats.level,
    accuracy: stats.dp,
    crit: {
      chance: stats.critChance,
      disabled: stats.critsDisabled,
      damageBonus: stats.critDamageBonus,
    },
    adrenaline: stats.adrenaline,
    procs: stats.procs,
    plantedFeet: stats.plantedFeet,
    strengthCape99: stats.strengthCape99,
    preciseRank: stats.preciseRank,
    conjureBasicDamageMult: stats.conjureBasicDamageMult,
    conjureDurationMult: stats.conjureDurationMult,
    tumekensPieces: stats.tumekensPieces,
    tumekensCritEnabled: stats.tumekensCritEnabled,
    equipmentEffects: stats.equipmentEffects,
    league: serializeLeague(stats.league),
    context: stats.combatContext,
    targetHpPercent: loadout.target?.hpPercent,
    cap: stats.cap,
    startingAdrenaline: stats.startingAdrenaline,
    equipmentIds: stats.equipmentIds,
    weaponConfiguration: stats.weaponConfiguration,
    equipmentSlots: loadout.equipmentSlots,
    vulnerability: loadout.buffs.vulnerability === true,
    styleCurseId: loadout.buffs.styleCurse ?? "none",
    amZiFlatDamage: stats.equipmentEffects.amZiFlatDamage ?? 0,
    amHejDamageBonus: stats.equipmentEffects.amHejDamageBonus ?? 0,
    slayer: {
      demon: loadout.perks.demonSlayer ?? 0,
      dragon: loadout.perks.dragonSlayer ?? 0,
      undead: loadout.perks.undeadSlayer ?? 0,
    },
    target: {
      demon: loadout.target?.demon,
      dragon: loadout.target?.dragon,
      undead: loadout.target?.undead,
    },
    slayerHelmet:
      slayerHelmet.active && slayerHelmet.tier && slayerHelmet.source
        ? {
            tierId: slayerHelmet.tier.id,
            source: slayerHelmet.source,
            damageMult: slayerHelmet.damageMult,
          }
        : null,
    salve:
      salve.active && salve.variant
        ? {
            variantId: salve.variant.id,
            damageMult: salve.damageMult,
          }
        : null,
    ultimatums: loadout.perks.ultimatums ?? 0,
    lunging: loadout.perks.lunging ?? 0,
    berserkersFuryBonus: stats.berserkersFury.active ? stats.berserkersFury.bonus : 0,
  };
}
