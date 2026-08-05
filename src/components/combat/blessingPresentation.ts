/**
 * Pure labels for league blessing damage in analysis / revo UI.
 * Engine effect ids (abilityId on blessing events) are not always BlessingId plates.
 */
import { ticksToSeconds } from "@/combat/core/ticks";
import type { BlessingChoice } from "@/league/blessings";

export const BLESSING_DAMAGE_EFFECT_IDS = [
  "big-boned",
  "abyssal-cinders",
  "light-of-saradomin",
  "inferno-of-zamorak",
  "grasp-of-guthix",
] as const;

export type BlessingDamageEffectId = (typeof BLESSING_DAMAGE_EFFECT_IDS)[number];

/** Display names for procedural blessing damage effect ids. */
export const BLESSING_EFFECT_LABEL: Readonly<Record<BlessingDamageEffectId, string>> = {
  "big-boned": "Big Boned",
  "abyssal-cinders": "Cinders",
  "inferno-of-zamorak": "Inferno",
  // Hit name (card is Striking Light); keep distinct in timeline / byEffect.
  "light-of-saradomin": "Light of Saradomin",
  "grasp-of-guthix": "Grasp of Guthix",
};

const BLESSING_EFFECT_ID_SET = new Set<string>(BLESSING_DAMAGE_EFFECT_IDS);

export function isBlessingDamageEffectId(id: string): boolean {
  return BLESSING_EFFECT_ID_SET.has(id);
}

export function blessingEffectDisplayName(id: string): string | null {
  return (BLESSING_EFFECT_LABEL as Readonly<Record<string, string>>)[id] ?? null;
}

/** True when the resolved event is league blessing damage. */
export function isBlessingDamageEvent(event: {
  family?: string;
  blessingId?: string;
  abilityId?: string;
}): boolean {
  return (
    event.family === "blessing" ||
    event.blessingId != null ||
    isBlessingDamageEffectId(event.abilityId ?? "")
  );
}

/** Event column: Blessing (not Hit / Bonus / Expected proc). */
export function blessingEventTypeLabel(event: {
  family?: string;
  blessingId?: string;
  abilityId?: string;
}): string | null {
  return isBlessingDamageEvent(event) ? "Blessing" : null;
}

/** byEffect row is league blessing when ledger kind or known effect id says so. */
export function isBlessingEffectRow(id: string, kind?: string): boolean {
  return kind === "league-blessing" || isBlessingDamageEffectId(id);
}

/**
 * Revo / compact byEffect label. Prefixes "Blessing · " for blessing damage ids.
 */
export function formatBlessingByEffectLabel(
  id: string,
  kind: string | undefined,
  baseName: string,
): string {
  if (!isBlessingEffectRow(id, kind)) return baseName;
  if (baseName.startsWith("Blessing · ")) return baseName;
  return `Blessing · ${baseName}`;
}

/** Striking Light plate when active (tier-2 Order). */
export function strikingLightChoice(
  blessings: readonly BlessingChoice[] | undefined,
): BlessingChoice | undefined {
  return blessings?.find((choice) => choice.id === "striking-light");
}

/**
 * Assumptions rows: +40% basics is ability-stage (not baked into base AD),
 * plus Light of Saradomin separate hit (AD band + armour share + CD).
 */
export function strikingLightAssumptionRows(
  blessings: readonly BlessingChoice[] | undefined,
  totalArmour = 0,
): Array<[string, string]> {
  const choice = strikingLightChoice(blessings);
  if (!choice) return [];
  const rows: Array<[string, string]> = [];
  const mult = choice.combat.basicDamageMultiplier;
  if (mult != null && mult !== 1) {
    const pct = Math.round((mult - 1) * 100);
    rows.push([
      "Striking Light basics",
      `+${pct}% damage on Basic-category abilities and autos (ability-stage mult; not in base ability damage field)`,
    ]);
  }
  const light = choice.combat.light;
  if (light) {
    const [bandMin, bandMax] = light.abilityDamageBand;
    const armourPct = Math.round(light.armourPercent * 100);
    const armourShare = Math.floor(totalArmour * light.armourPercent);
    const cdSeconds = ticksToSeconds(light.cooldownTicks).toFixed(1);
    rows.push([
      "Light of Saradomin",
      `${bandMin}-${bandMax}% AD + ${armourPct}% armour` +
        (totalArmour > 0 ? ` (${armourShare.toLocaleString("en-US")} from armour)` : "") +
        ` · ${cdSeconds}s CD · separate hit on first basic land while ready`,
    ]);
  }
  return rows;
}

/** One-line quick-calc note when the selected cast is a basic under Striking Light. */
export function strikingLightBasicCastNote(
  blessings: readonly BlessingChoice[] | undefined,
  ability: { category?: string; autoAttack?: boolean } | null | undefined,
): string | null {
  const choice = strikingLightChoice(blessings);
  const mult = choice?.combat.basicDamageMultiplier;
  if (mult == null || mult === 1) return null;
  if (ability?.category !== "basic" && ability?.autoAttack !== true) return null;
  const pct = Math.round((mult - 1) * 100);
  return `Includes Striking Light +${pct}% on this basic`;
}
