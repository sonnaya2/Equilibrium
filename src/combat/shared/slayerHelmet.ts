import type { CombatContext, CombatModifier, CombatStyle, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";
import { resolvedEquipmentSlots, type LoadoutEquipmentView } from "./equipment";
import { isOnHitPlayerDamage } from "./onHitEligibility";

/**
 * Full Slayer Helmet line (Slayer Spirit) + Anachronia helmet stand.
 * https://runescape.wiki/w/Full_slayer_helmet
 * https://runescape.wiki/w/Slayer_helmet_stand
 * https://runescape.wiki/w/Ensouled_spectral_lens
 *
 * One resolved effect only: equipped helmet OR stand, never both stacked.
 * Damage is on-hit only (not DoT ticks, not conjures/commands).
 * Accuracy mult multiplies accuracy rating before hit chance (wiki Hit chance).
 * Necromancy needs the permanent ensouled spectral lens upgrade (account flag).
 */

export const SLAYER_HELMET_VERIFIED_AT = "2026-08-03";

export const SLAYER_HELMET_STAND_REGION = "anachronia" as const;

/** Full helmet stable id (legacy `-i` suffix; wiki has no (i)). */
export const FULL_SLAYER_HELMET_ITEM_ID = "item:slayer-helmet-i";
export const REINFORCED_SLAYER_HELMET_ITEM_ID = "item:reinforced-slayer-helmet";
export const STRONG_SLAYER_HELMET_ITEM_ID = "item:strong-slayer-helmet";
export const MIGHTY_SLAYER_HELMET_ITEM_ID = "item:mighty-slayer-helmet";
export const CORRUPTED_SLAYER_HELMET_ITEM_ID = "item:corrupted-slayer-helmet";

export type SlayerHelmetTierId = "full" | "reinforced" | "strong" | "mighty" | "corrupted";

export type SlayerHelmetActivationSource = "equipped" | "stand";

export interface SlayerHelmetTierDef {
  id: SlayerHelmetTierId;
  itemId: string;
  label: string;
  /** Damage multiplier while on task (1.075 = +7.5%). */
  damageMult: number;
  /** Accuracy rating multiplier while on task (1.125 = +12.5%). */
  hitChanceMult: number;
  rank: number;
  iconPath: string;
  wikiPath: string;
}

/** Shared typed table for UI stand picker and resolvers. */
export const SLAYER_HELMET_TIERS: readonly SlayerHelmetTierDef[] = [
  {
    id: "full",
    itemId: FULL_SLAYER_HELMET_ITEM_ID,
    label: "Full Slayer Helmet",
    damageMult: 1.075,
    hitChanceMult: 1.125,
    rank: 0,
    iconPath: "/game/combat/equipment/slayer-helmet-i.webp",
    wikiPath: "Full_slayer_helmet",
  },
  {
    id: "reinforced",
    itemId: REINFORCED_SLAYER_HELMET_ITEM_ID,
    label: "Reinforced Slayer Helmet",
    damageMult: 1.08,
    hitChanceMult: 1.13,
    rank: 1,
    iconPath: "/game/upgrades/permanent-unlocks/full-slayer-helmet.webp",
    wikiPath: "Reinforced_slayer_helmet",
  },
  {
    id: "strong",
    itemId: STRONG_SLAYER_HELMET_ITEM_ID,
    label: "Strong Slayer Helmet",
    damageMult: 1.085,
    hitChanceMult: 1.135,
    rank: 2,
    iconPath: "/game/upgrades/permanent-unlocks/full-slayer-helmet.webp",
    wikiPath: "Strong_slayer_helmet",
  },
  {
    id: "mighty",
    itemId: MIGHTY_SLAYER_HELMET_ITEM_ID,
    label: "Mighty Slayer Helmet",
    damageMult: 1.09,
    hitChanceMult: 1.14,
    rank: 3,
    iconPath: "/game/upgrades/permanent-unlocks/full-slayer-helmet.webp",
    wikiPath: "Mighty_slayer_helmet",
  },
  {
    id: "corrupted",
    itemId: CORRUPTED_SLAYER_HELMET_ITEM_ID,
    label: "Corrupted Slayer Helmet",
    damageMult: 1.095,
    hitChanceMult: 1.145,
    rank: 4,
    iconPath: "/game/combat/equipment/corrupted-slayer-helmet.webp",
    wikiPath: "Corrupted_slayer_helmet",
  },
] as const;

const TIER_BY_ID = new Map(SLAYER_HELMET_TIERS.map((t) => [t.id, t]));
const TIER_BY_ITEM = new Map(SLAYER_HELMET_TIERS.map((t) => [t.itemId, t]));

export function slayerHelmetTierById(
  id: string | null | undefined,
): SlayerHelmetTierDef | undefined {
  if (id == null) return undefined;
  return TIER_BY_ID.get(id as SlayerHelmetTierId);
}

export function slayerHelmetTierByItemId(
  itemId: string | null | undefined,
): SlayerHelmetTierDef | undefined {
  if (itemId == null) return undefined;
  return TIER_BY_ITEM.get(itemId);
}

export function normalizeSlayerHelmetStand(value: unknown): SlayerHelmetTierId | null {
  if (typeof value !== "string") return null;
  return TIER_BY_ID.has(value as SlayerHelmetTierId) ? (value as SlayerHelmetTierId) : null;
}

export function isSlayerHelmetStandAvailable(
  unlockedRegions: readonly string[] | undefined,
): boolean {
  if (unlockedRegions == null) return true;
  return unlockedRegions.includes(SLAYER_HELMET_STAND_REGION);
}

export function styleEligibleForSlayerHelmet(
  style: CombatStyle,
  ensouledSpectralLens: boolean,
): boolean {
  if (style === "necromancy") return ensouledSpectralLens === true;
  return style === "melee" || style === "ranged" || style === "magic";
}

function wikiSource(title: string, path: string): SourceReference {
  return {
    source: "runescape-wiki",
    url: `https://runescape.wiki/w/${path}`,
    title,
    verifiedAt: SLAYER_HELMET_VERIFIED_AT,
  };
}

export interface ResolveSlayerHelmetInput {
  equipmentSlots?: LoadoutEquipmentView["equipmentSlots"];
  /** Stand selection (tier id); ignored when Anachronia is locked. */
  standTier?: SlayerHelmetTierId | null;
  unlockedRegions?: readonly string[];
  onSlayerTask?: boolean;
  style: CombatStyle;
  /** Permanent ensouled spectral lens consumed into the helmet line. */
  ensouledSpectralLens?: boolean;
}

export interface ResolvedSlayerHelmet {
  active: boolean;
  source: SlayerHelmetActivationSource | null;
  tier: SlayerHelmetTierDef | null;
  damageMult: number;
  hitChanceMult: number;
  styleEligible: boolean;
  onSlayerTask: boolean;
  /** Why inactive, or activation summary. */
  status: string;
  analysisLabel: string | null;
}

/**
 * Precedence when both equipped and stand are present: higher tier wins;
 * equal tier prefers equipped (worn helmet is the live combat slot).
 */
export function resolveSlayerHelmet(input: ResolveSlayerHelmetInput): ResolvedSlayerHelmet {
  const onSlayerTask = input.onSlayerTask === true;
  const styleEligible = styleEligibleForSlayerHelmet(
    input.style,
    input.ensouledSpectralLens === true,
  );
  const slots = resolvedEquipmentSlots(input);
  const equippedTier = slayerHelmetTierByItemId(slots.helmet ?? null);
  const standOk = input.standTier != null && isSlayerHelmetStandAvailable(input.unlockedRegions);
  const standTier = standOk ? slayerHelmetTierById(input.standTier) : undefined;

  let chosen: { tier: SlayerHelmetTierDef; source: SlayerHelmetActivationSource } | null = null;
  if (equippedTier && standTier) {
    if (standTier.rank > equippedTier.rank) {
      chosen = { tier: standTier, source: "stand" };
    } else {
      chosen = { tier: equippedTier, source: "equipped" };
    }
  } else if (equippedTier) {
    chosen = { tier: equippedTier, source: "equipped" };
  } else if (standTier) {
    chosen = { tier: standTier, source: "stand" };
  }

  if (!chosen) {
    return {
      active: false,
      source: null,
      tier: null,
      damageMult: 1,
      hitChanceMult: 1,
      styleEligible,
      onSlayerTask,
      status: "No Full Slayer Helmet equipped or on stand",
      analysisLabel: null,
    };
  }

  if (!onSlayerTask) {
    return {
      active: false,
      source: chosen.source,
      tier: chosen.tier,
      damageMult: 1,
      hitChanceMult: 1,
      styleEligible,
      onSlayerTask,
      status: "Inactive - not on a Slayer task",
      analysisLabel: null,
    };
  }

  if (!styleEligible) {
    return {
      active: false,
      source: chosen.source,
      tier: chosen.tier,
      damageMult: 1,
      hitChanceMult: 1,
      styleEligible,
      onSlayerTask,
      status:
        input.style === "necromancy"
          ? "Inactive for Necromancy - needs ensouled spectral lens"
          : "Inactive for selected style",
      analysisLabel: null,
    };
  }

  const via = chosen.source === "equipped" ? "equipped" : "Slayer helmet stand";
  return {
    active: true,
    source: chosen.source,
    tier: chosen.tier,
    damageMult: chosen.tier.damageMult,
    hitChanceMult: chosen.tier.hitChanceMult,
    styleEligible,
    onSlayerTask,
    status: `Active via ${via}`,
    analysisLabel: `${chosen.tier.label} (${via})`,
  };
}

export function slayerHelmetDamageModifier(resolved: ResolvedSlayerHelmet): CombatModifier | null {
  if (!resolved.active || resolved.tier == null || resolved.damageMult === 1) return null;
  const mult = resolved.damageMult;
  const tier = resolved.tier;
  const sourceLabel = resolved.source === "stand" ? "stand" : "equipped";
  return {
    id: `item:slayer-helmet:${tier.id}:${sourceLabel}`,
    stage: "onHit",
    priority: 40,
    applies: (context: CombatContext) => isOnHitPlayerDamage(context),
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiSource(tier.label, tier.wikiPath),
  };
}

export function formatSlayerHelmetDamageLine(resolved: ResolvedSlayerHelmet): string | null {
  if (!resolved.active || resolved.tier == null) return null;
  const pct = ((resolved.tier.damageMult - 1) * 100).toFixed(1).replace(/\.0$/, "");
  const via = resolved.source === "stand" ? "stand" : "equipped";
  return `${resolved.tier.label} - +${pct}% direct-hit damage (${via})`;
}

export function formatSlayerHelmetHitChanceLine(resolved: ResolvedSlayerHelmet): string | null {
  if (!resolved.active || resolved.tier == null) return null;
  const pct = ((resolved.tier.hitChanceMult - 1) * 100).toFixed(1).replace(/\.0$/, "");
  const via = resolved.source === "stand" ? "stand" : "equipped";
  return `${resolved.tier.label} - +${pct}% hit chance (${via})`;
}
