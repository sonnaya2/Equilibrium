import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { equilibriumDamageBonus, eruptiveDamageBonus } from "@/combat/shared/perks";
import { resolvedEquipmentSlots } from "@/combat/shared/equipment";
import { overloadBoostedLevel, type OverloadTier } from "@/combat/shared/potions";
import { equipmentById } from "@/combat/data";
import type { Loadout } from "./model";

const clampLevel = (value: number) => Math.min(Math.max(1, value), 145);

const WEAPON_SLOTS = new Set(["mainhand", "offhand", "twohand", "ammo"]);

/**
 * Unique records the player is actually wearing. Unlock pins are never equipped,
 * and a stale main-hand/off-hand under a two-handed weapon is resolved away by
 * the canonical equipped state rather than counted here.
 */
export function equippedRecordIds(loadout: Loadout): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of Object.values(resolvedEquipmentSlots(loadout))) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Style bonus `b`: matching armour/jewellery bonuses, never weapon damage. */
export function equipmentStyleDamageBonus(loadout: Loadout): number {
  let bonus = 0;
  for (const id of equippedRecordIds(loadout)) {
    const record = equipmentById(id);
    if (!record?.slot || WEAPON_SLOTS.has(record.slot)) continue;
    if (record.style && record.style !== "hybrid" && record.style !== loadout.style) continue;
    if (record.bonuses.damage != null && Number.isFinite(record.bonuses.damage)) {
      bonus += record.bonuses.damage;
    }
  }
  return bonus;
}

/** Equipped twohand or mainhand tier when tagged on the record. */
export function equippedWeaponTier(loadout: Loadout): number | null {
  const slots = loadout.equipmentSlots ?? {};
  for (const slot of ["twohand", "mainhand"] as const) {
    const id = slots[slot];
    if (typeof id !== "string") continue;
    const record = equipmentById(id);
    if (
      record?.tier != null &&
      Number.isFinite(record.tier) &&
      (!record.style || record.style === "hybrid" || record.style === loadout.style)
    ) {
      return record.tier;
    }
  }
  return null;
}

export function loadoutWeaponTier(loadout: Loadout): number {
  return equippedWeaponTier(loadout) ?? loadout.weaponTier;
}

export function loadoutAttackLevel(loadout: Loadout): number {
  return clampLevel(loadout.style === "melee" ? loadout.attackLevel : loadout.level);
}

export function loadoutDamageLevel(loadout: Loadout): number {
  return clampLevel(loadout.style === "melee" ? loadout.strengthLevel : loadout.level);
}

export function loadoutOverloadTier(loadout: Loadout): OverloadTier | null {
  return loadout.buffs?.overload && loadout.buffs.overload !== "none"
    ? (loadout.buffs.overload as OverloadTier)
    : null;
}

/**
 * Damage level feeding base ability damage: overload-boosted (wiki Ability damage
 * uses the style level "including boosts", capped at 145 = 120 + potion boosts;
 * verified 2026-07-31). Prayer stays an ability-stage modifier, never baked in.
 */
export function loadoutEffectiveDamageLevel(loadout: Loadout): number {
  const level = loadoutDamageLevel(loadout);
  const tier = loadoutOverloadTier(loadout);
  return clampLevel(tier ? overloadBoostedLevel(level, tier) : level);
}

function slotWeaponTier(
  loadout: Loadout,
  slot: "twohand" | "mainhand" | "offhand" | "ammo",
): number | null {
  const id = resolvedEquipmentSlots(loadout)[slot];
  if (id === undefined) return null;
  const record = equipmentById(id);
  if (!record) return null;
  if (record?.style && record.style !== "hybrid" && record.style !== loadout.style) return null;
  const tier = record.tier;
  if (tier == null || !Number.isFinite(tier)) return null;
  if (slot === "offhand" && record.shield && !record.defender) return null;
  return slot === "offhand" && record.defender ? tier / 2 : tier;
}

export type WeaponHand = Parameters<typeof baseAbilityDamage>[1];

/**
 * Weapon configuration from equipped slots: twohand → 2H formula; mainhand +
 * offhand → dual wield (a necromancy conduit occupies the offhand slot and
 * routes here); mainhand only → main hand. No tiered weapon in any slot → the
 * legacy fallback: weaponTier slider through the twohand formula, as before.
 */
export function loadoutWeaponConfig(loadout: Loadout): WeaponHand {
  const styleBonus = equipmentStyleDamageBonus(loadout) + loadout.styleDamageBonus;
  const twohandTier = slotWeaponTier(loadout, "twohand");
  const mainhandTier = slotWeaponTier(loadout, "mainhand");
  const offhandTier = slotWeaponTier(loadout, "offhand");
  const offhandOccupied = resolvedEquipmentSlots(loadout).offhand !== undefined;
  if (loadout.style === "necromancy") {
    return {
      kind: "necromancy",
      deathGuard: { tier: mainhandTier ?? loadout.weaponTier },
      conduit:
        offhandTier != null
          ? { tier: offhandTier }
          : offhandOccupied
            ? undefined
            : { tier: loadout.offhandTier },
      styleBonus,
    };
  }
  const caps =
    loadout.style === "ranged"
      ? { ammunitionTier: slotWeaponTier(loadout, "ammo") ?? loadout.ammunitionTier }
      : loadout.style === "magic"
        ? { spellTier: loadout.spellTier }
        : {};
  if (twohandTier != null) {
    return {
      kind: "twohand",
      weapon: { tier: twohandTier },
      style: loadout.style,
      styleBonus,
      ...caps,
    };
  }
  if (mainhandTier != null) {
    return offhandTier != null
      ? {
          kind: "mainhand",
          style: loadout.style,
          weapon: { tier: mainhandTier },
          offhand: { tier: offhandTier },
          styleBonus,
          ...caps,
        }
      : {
          kind: "mainhand",
          style: loadout.style,
          weapon: { tier: mainhandTier },
          styleBonus,
          ...caps,
        };
  }
  if (loadout.weaponConfiguration === "mainhand") {
    return {
      kind: "mainhand",
      style: loadout.style,
      weapon: { tier: loadout.weaponTier },
      styleBonus,
      ...caps,
    };
  }
  if (loadout.weaponConfiguration === "dualwield") {
    return {
      kind: "mainhand",
      style: loadout.style,
      weapon: { tier: loadout.weaponTier },
      offhand: { tier: loadout.offhandTier },
      styleBonus,
      ...caps,
    };
  }
  return {
    kind: "twohand",
    weapon: { tier: loadoutWeaponTier(loadout) },
    style: loadout.style,
    styleBonus,
    ...caps,
  };
}

/** Base ability damage computed from the effective level and equipped weapon config. */
export function computedLoadoutBase(loadout: Loadout): number {
  return baseAbilityDamage(loadoutEffectiveDamageLevel(loadout), loadoutWeaponConfig(loadout));
}

export function loadoutBase(loadout: Loadout): number {
  const raw =
    loadout.baseDamage.mode === "manual" && loadout.baseDamage.manualValue > 0
      ? loadout.baseDamage.manualValue
      : computedLoadoutBase(loadout);
  const equilibrium =
    loadout.perks.equilibrium > 0 ? 1 + equilibriumDamageBonus(loadout.perks.equilibrium) : 1;
  const eruptive = loadout.perks.eruptive > 0 ? 1 + eruptiveDamageBonus(loadout.perks.eruptive) : 1;
  return Math.floor(Math.floor(raw * equilibrium) * eruptive);
}
