import type { CombatContext, CombatModifier, SourceReference } from "../types";
import { mulFloor } from "../core/rounding";
import { resolvedEquipmentSlots, type LoadoutEquipmentView } from "./equipment";
import { isOnHitPlayerDamage } from "./onHitEligibility";

/**
 * Salve amulet / Salve amulet (e) undead on-hit passives.
 * https://runescape.wiki/w/Salve_amulet
 * https://runescape.wiki/w/Salve_amulet_(e)
 *
 * Derived only from the resolved amulet slot - never a free buff toggle.
 * Salve and Salve (e) cannot stack (one neck slot). Stacks with Full Slayer Helmet
 * and Undead Slayer perk/ability. On-hit only: not DoT ticks, not conjures.
 */

export const SALVE_VERIFIED_AT = "2026-08-03";

export const SALVE_AMULET_ITEM_ID = "item:salve-amulet";
export const SALVE_AMULET_E_ITEM_ID = "item:salve-amulet-e";

export type SalveVariant = "salve" | "salve-e";

export interface SalveVariantDef {
  id: SalveVariant;
  itemId: string;
  label: string;
  damageMult: number;
  hitChanceMult: number;
  iconPath: string;
  wikiPath: string;
}

export const SALVE_VARIANTS: readonly SalveVariantDef[] = [
  {
    id: "salve",
    itemId: SALVE_AMULET_ITEM_ID,
    label: "Salve amulet",
    damageMult: 1.15,
    hitChanceMult: 1.15,
    iconPath: "/game/upgrades/permanent-unlocks/salve-amulet.webp",
    wikiPath: "Salve_amulet",
  },
  {
    id: "salve-e",
    itemId: SALVE_AMULET_E_ITEM_ID,
    label: "Salve amulet (e)",
    damageMult: 1.2,
    hitChanceMult: 1.2,
    iconPath: "/game/combat/equipment/salve-amulet-e.webp",
    wikiPath: "Salve_amulet_(e)",
  },
] as const;

const VARIANT_BY_ITEM = new Map(SALVE_VARIANTS.map((v) => [v.itemId, v]));

export function salveVariantByItemId(
  itemId: string | null | undefined,
): SalveVariantDef | undefined {
  if (itemId == null) return undefined;
  return VARIANT_BY_ITEM.get(itemId);
}

function wikiSource(title: string, path: string): SourceReference {
  return {
    source: "runescape-wiki",
    url: `https://runescape.wiki/w/${path}`,
    title,
    verifiedAt: SALVE_VERIFIED_AT,
  };
}

export interface ResolveSalveInput {
  equipmentSlots?: LoadoutEquipmentView["equipmentSlots"];
  /** Legacy flat ids - amulet slot still wins when set. */
  equipmentIds?: readonly string[] | null;
  targetUndead?: boolean;
}

export interface ResolvedSalve {
  active: boolean;
  variant: SalveVariantDef | null;
  damageMult: number;
  hitChanceMult: number;
  targetUndead: boolean;
  status: string;
  analysisLabel: string | null;
}

/**
 * Amulet slot is authoritative. Malformed loadouts that list both salves in
 * equipmentIds never stack - only the resolved amulet slot is read.
 */
export function resolveSalve(input: ResolveSalveInput): ResolvedSalve {
  const slots = resolvedEquipmentSlots(input);
  const variant = salveVariantByItemId(slots.amulet ?? null);
  const targetUndead = input.targetUndead === true;

  if (!variant) {
    return {
      active: false,
      variant: null,
      damageMult: 1,
      hitChanceMult: 1,
      targetUndead,
      status: "No Salve amulet equipped",
      analysisLabel: null,
    };
  }

  if (!targetUndead) {
    return {
      active: false,
      variant,
      damageMult: 1,
      hitChanceMult: 1,
      targetUndead,
      status: "Inactive - target is not undead",
      analysisLabel: null,
    };
  }

  return {
    active: true,
    variant,
    damageMult: variant.damageMult,
    hitChanceMult: variant.hitChanceMult,
    targetUndead,
    status: `Active vs undead (${variant.label})`,
    analysisLabel: variant.label,
  };
}

export function salveDamageModifier(resolved: ResolvedSalve): CombatModifier | null {
  if (!resolved.active || resolved.variant == null || resolved.damageMult === 1) return null;
  const mult = resolved.damageMult;
  const variant = resolved.variant;
  return {
    id: `item:salve:${variant.id}`,
    stage: "onHit",
    priority: 41,
    applies: (context: CombatContext) => isOnHitPlayerDamage(context),
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, mult) }),
    source: wikiSource(variant.label, variant.wikiPath),
  };
}

export function formatSalveDamageLine(resolved: ResolvedSalve): string | null {
  if (!resolved.active || resolved.variant == null) return null;
  const pct = Math.round((resolved.variant.damageMult - 1) * 100);
  return `${resolved.variant.label} - +${pct}% direct-hit damage`;
}

export function formatSalveHitChanceLine(resolved: ResolvedSalve): string | null {
  if (!resolved.active || resolved.variant == null) return null;
  const pct = Math.round((resolved.variant.hitChanceMult - 1) * 100);
  return `${resolved.variant.label} - +${pct}% hit chance`;
}
