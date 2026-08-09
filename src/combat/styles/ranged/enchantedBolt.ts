import type { RangedAmmunitionMechanicId } from "../../data/ammunition";

export type EnchantedBoltActivationGroup = "ordinary" | "emerald" | "onyx-hydrix";

export interface EnchantedBoltChanceModifiers {
  rangedCape?: boolean;
  eliteSeersVillage?: boolean;
}

const ORDINARY_BOLT_MECHANICS: ReadonlySet<RangedAmmunitionMechanicId> = new Set([
  "opal",
  "pearl",
  "jade",
  "topaz",
  "sapphire",
  "ruby",
  "diamond",
  "dragonstone",
]);

export const ENCHANTED_BOLT_BASE_CHANCE_FRACTION: Readonly<
  Record<EnchantedBoltActivationGroup, number>
> = {
  ordinary: 0.05,
  emerald: 0.55,
  "onyx-hydrix": 0.1,
};

export function enchantedBoltActivationGroup(
  mechanicId: RangedAmmunitionMechanicId,
): EnchantedBoltActivationGroup | null {
  if (ORDINARY_BOLT_MECHANICS.has(mechanicId)) return "ordinary";
  if (mechanicId === "emerald") return "emerald";
  if (mechanicId === "onyx" || mechanicId === "hydrix" || mechanicId === "ascendri") {
    return "onyx-hydrix";
  }
  return null;
}

export function enchantedBoltActivationChance(
  mechanicId: RangedAmmunitionMechanicId,
  modifiers: EnchantedBoltChanceModifiers = {},
): number | null {
  const group = enchantedBoltActivationGroup(mechanicId);
  if (group == null) return null;
  const base = ENCHANTED_BOLT_BASE_CHANCE_FRACTION[group];
  const withEliteSeers = base + (modifiers.eliteSeersVillage === true ? 0.02 : 0);
  return modifiers.rangedCape === true
    ? Math.round(withEliteSeers * 1.2 * 1000) / 1000
    : Math.round(withEliteSeers * 1000) / 1000;
}

export function enchantedBoltChancePercent(chanceFraction: number): number {
  if (!Number.isFinite(chanceFraction) || chanceFraction < 0 || chanceFraction > 1) {
    throw new Error("bolt chance fraction must be between 0 and 1");
  }
  return chanceFraction * 100;
}
