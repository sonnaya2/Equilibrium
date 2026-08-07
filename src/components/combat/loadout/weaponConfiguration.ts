import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { equilibriumDamageBonus, eruptiveDamageBonus } from "@/combat/shared/perks";
import { resolvedEquipmentSlots } from "@/combat/shared/equipment";
import { equipmentRecordDamage } from "@/combat/shared/equipmentStats";
import { overloadBoostedLevel, type OverloadTier } from "@/combat/shared/potions";
import { equipmentById } from "@/combat/data";
import type { Loadout } from "./model";

const clampLevel = (value: number) => Math.min(Math.max(1, value), 145);

const WEAPON_SLOTS = new Set(["mainhand", "offhand", "twohand", "ammo"]);

export type WeaponTierOverrides = readonly (number | null | undefined)[];

/** Tier overrides are floors, so applying the same override twice is harmless. */
export function effectiveWeaponTier(baseTier: number, overrides: WeaponTierOverrides = []): number {
  if (!Number.isFinite(baseTier) || baseTier < 0) {
    throw new RangeError(`effectiveWeaponTier: bad base tier ${baseTier}`);
  }
  let effectiveTier = baseTier;
  for (const override of overrides) {
    if (override == null) continue;
    if (!Number.isFinite(override) || override < 0) {
      throw new RangeError(`effectiveWeaponTier: bad override ${override}`);
    }
    effectiveTier = Math.max(effectiveTier, Math.floor(override));
  }
  return effectiveTier;
}

function effectiveWeaponProfileTier(tier: number, overrides: WeaponTierOverrides): number {
  // Zero is the explicit weaponless sentinel used by manual loadout setups.
  return tier === 0 ? tier : effectiveWeaponTier(tier, overrides);
}

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

export interface StyleDamageContribution {
  id: string;
  label: string;
  /** Damage applied for the current loadout style (0 when style-mismatched). */
  value: number;
  /** Record's combat style when it blocked the contribution. */
  blockedByStyle?: string;
}

/**
 * Per-piece style Damage for Setup breakdowns. Non-weapon only. Style-mismatched
 * pieces keep their resolved value on `blockedByStyle` so rings like Channeller's
 * are visible when the loadout style does not match.
 */
export function equipmentStyleDamageContributions(loadout: Loadout): StyleDamageContribution[] {
  const rows: StyleDamageContribution[] = [];
  for (const id of equippedRecordIds(loadout)) {
    const record = equipmentById(id);
    if (!record?.slot || WEAPON_SLOTS.has(record.slot)) continue;
    const damage = equipmentRecordDamage(record);
    if (damage === 0) continue;
    const styleOk = !record.style || record.style === "hybrid" || record.style === loadout.style;
    rows.push({
      id,
      label: record.name,
      value: styleOk ? damage : 0,
      ...(styleOk ? {} : { blockedByStyle: record.style }),
    });
  }
  return rows;
}

/**
 * Style bonus `b` for ability damage: non-weapon pieces only, same resolve as
 * Setup "Equipment damage" (exact `bonuses.damage` or formula). Weapons never
 * enter here - tier handles them; defenders use half-tier OH, not style b.
 */
export function equipmentStyleDamageBonus(loadout: Loadout): number {
  return equipmentStyleDamageContributions(loadout).reduce((sum, row) => sum + row.value, 0);
}

/** Equipped twohand or mainhand tier when tagged on the record. */
export function equippedWeaponTier(loadout: Loadout): number | null {
  const slots = resolvedEquipmentSlots(loadout);
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

export function loadoutWeaponTier(loadout: Loadout, overrides: WeaponTierOverrides = []): number {
  return effectiveWeaponProfileTier(equippedWeaponTier(loadout) ?? loadout.weaponTier, overrides);
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
  overrides: WeaponTierOverrides,
): number | null {
  const id = resolvedEquipmentSlots(loadout)[slot];
  if (id === undefined) return null;
  const record = equipmentById(id);
  if (!record) return null;
  if (record?.style && record.style !== "hybrid" && record.style !== loadout.style) return null;
  const tier = record.tier;
  if (tier == null || !Number.isFinite(tier)) return null;
  if (slot === "offhand" && record.shield && !record.defender) return null;
  const effectiveTier = effectiveWeaponProfileTier(tier, overrides);
  return slot === "offhand" && record.defender ? effectiveTier / 2 : effectiveTier;
}

export type WeaponHand = Parameters<typeof baseAbilityDamage>[1];

/**
 * Weapon configuration from equipped slots: twohand → 2H formula; mainhand +
 * offhand → dual wield (a necromancy conduit occupies the offhand slot and
 * routes here); mainhand only → main hand. No tiered weapon in any slot → the
 * legacy fallback: weaponTier slider through the twohand formula, as before.
 */
export function loadoutWeaponConfig(
  loadout: Loadout,
  overrides: WeaponTierOverrides = [],
): WeaponHand {
  const styleBonus = equipmentStyleDamageBonus(loadout) + loadout.styleDamageBonus;
  const twohandTier = slotWeaponTier(loadout, "twohand", overrides);
  const mainhandTier = slotWeaponTier(loadout, "mainhand", overrides);
  const offhandTier = slotWeaponTier(loadout, "offhand", overrides);
  const offhandOccupied = resolvedEquipmentSlots(loadout).offhand !== undefined;
  if (loadout.style === "necromancy") {
    return {
      kind: "necromancy",
      deathGuard: {
        tier: mainhandTier ?? effectiveWeaponProfileTier(loadout.weaponTier, overrides),
      },
      conduit:
        offhandTier != null
          ? { tier: offhandTier }
          : offhandOccupied
            ? undefined
            : { tier: effectiveWeaponProfileTier(loadout.offhandTier, overrides) },
      styleBonus,
    };
  }
  const caps =
    loadout.style === "ranged"
      ? { ammunitionTier: slotWeaponTier(loadout, "ammo", []) ?? loadout.ammunitionTier }
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
  // Slider fallback when no tiered weapon is equipped. Shield = main-hand only;
  // defender is dual-capable for AD at half-tier OH; dualwield uses full offhandTier.
  if (loadout.weaponConfiguration === "mainhand" || loadout.weaponConfiguration === "shield") {
    return {
      kind: "mainhand",
      style: loadout.style,
      weapon: { tier: effectiveWeaponProfileTier(loadout.weaponTier, overrides) },
      styleBonus,
      ...caps,
    };
  }
  if (loadout.weaponConfiguration === "defender") {
    return {
      kind: "mainhand",
      style: loadout.style,
      weapon: { tier: effectiveWeaponProfileTier(loadout.weaponTier, overrides) },
      offhand: { tier: effectiveWeaponProfileTier(loadout.offhandTier, overrides) / 2 },
      styleBonus,
      ...caps,
    };
  }
  if (loadout.weaponConfiguration === "dualwield") {
    return {
      kind: "mainhand",
      style: loadout.style,
      weapon: { tier: effectiveWeaponProfileTier(loadout.weaponTier, overrides) },
      offhand: { tier: effectiveWeaponProfileTier(loadout.offhandTier, overrides) },
      styleBonus,
      ...caps,
    };
  }
  return {
    kind: "twohand",
    weapon: { tier: effectiveWeaponProfileTier(loadoutWeaponTier(loadout), overrides) },
    style: loadout.style,
    styleBonus,
    ...caps,
  };
}

/** Base ability damage computed from the effective level and equipped weapon config. */
export function computedLoadoutBase(loadout: Loadout, overrides: WeaponTierOverrides = []): number {
  return baseAbilityDamage(
    loadoutEffectiveDamageLevel(loadout),
    loadoutWeaponConfig(loadout, overrides),
  );
}

export function loadoutBase(loadout: Loadout, overrides: WeaponTierOverrides = []): number {
  const raw = computedLoadoutBase(loadout, overrides);
  const equilibrium =
    loadout.perks.equilibrium > 0 ? 1 + equilibriumDamageBonus(loadout.perks.equilibrium) : 1;
  const eruptive = loadout.perks.eruptive > 0 ? 1 + eruptiveDamageBonus(loadout.perks.eruptive) : 1;
  return Math.floor(Math.floor(raw * equilibrium) * eruptive);
}
