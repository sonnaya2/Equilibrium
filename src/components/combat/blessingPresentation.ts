/**
 * Pure labels for league blessing damage in analysis / revo UI.
 * Engine effect ids (abilityId on blessing events) are not always BlessingId plates.
 */
import { ticksToSeconds } from "@/combat/core/ticks";
import { isBasicAttack } from "@/combat/shared/adrenalineGain";
import type { BlessingChoice } from "@/league/blessings";

export const BLESSING_DAMAGE_EFFECT_IDS = [
  "big-boned",
  "abyssal-cinders",
  "light-of-saradomin",
  "inferno-of-zamorak",
  "grasp-of-guthix",
  "grasp-of-guthix-max-life",
  "grasp-of-guthix-poison",
  "grasp-of-guthix-big-boned",
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
  "grasp-of-guthix-max-life": "Grasp of Guthix · Max life",
  "grasp-of-guthix-poison": "Grasp of Guthix · Poison",
  "grasp-of-guthix-big-boned": "Big Boned · attached to Grasp",
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
 * Assumptions rows: +40% Basic Attacks is ability-stage (not baked into base AD),
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
      "Striking Light Basic Attacks",
      `+${pct}% damage on Basic Attacks (ability-stage mult; not in base ability damage field)`,
    ]);
  }
  const light = choice.combat.light;
  if (light) {
    const [bandMin, bandMax] = light.abilityDamageBand;
    const armourPct = Math.round(light.armourPercent * 100);
    const armourShare = Math.floor(totalArmour * light.armourPercent);
    const cooldownTicks =
      blessings?.find((entry) => entry.id === "perfidious")?.combat.strikingLightCooldownTicks ??
      light.cooldownTicks;
    const cdSeconds = ticksToSeconds(cooldownTicks).toFixed(1);
    rows.push([
      "Light of Saradomin",
      `${bandMin}-${bandMax}% AD + ${armourPct}% armour` +
        (totalArmour > 0 ? ` (${armourShare.toLocaleString("en-US")} from armour)` : "") +
        ` · ${cdSeconds}s CD · separate hit on first Basic Attack land while ready`,
    ]);
  }
  return rows;
}

export function lordOfLightAssumptionRows(
  blessings: readonly BlessingChoice[] | undefined,
  totalArmour = 0,
  prayerBonus = 0,
  areaTargets = 1,
): Array<[string, string]> {
  const light = blessings?.find((choice) => choice.id === "lord-of-light")?.combat.light;
  if (!light) return [];
  const strikes = light.strikes ?? 1;
  const targets = Math.min(light.maxTargetsPerStrike ?? 1, Math.max(1, areaTargets));
  const prayerMultiplier = 1 + prayerBonus * (light.prayerDamagePerBonus ?? 0);
  const armourShare = Math.floor(totalArmour * light.armourPercent);
  const spatialNote =
    targets === 1
      ? "primary-target overlap is an areaTargets:1 scenario"
      : "multi-target tile overlap approximated by areaTargets";
  return [
    [
      "Lord of Light",
      `${strikes} strikes · ${targets} target${targets === 1 ? "" : "s"} per strike · ${spatialNote} · ${ticksToSeconds(light.cooldownTicks).toFixed(1)}s independent CD`,
    ],
    [
      "Lord Light hit",
      `${light.abilityDamageBand[0]}-${light.abilityDamageBand[1]}% AD + ${Math.round(light.armourPercent * 100)}% armour (${armourShare.toLocaleString("en-US")}) · Prayer ${prayerBonus.toLocaleString("en-US")} = ×${prayerMultiplier.toFixed(2)} · ${Math.round((light.healFraction ?? 0) * 100)}% heal`,
    ],
  ];
}

export function temperedHeartAssumptionRows(
  blessings: readonly BlessingChoice[] | undefined,
): Array<[string, string]> {
  const passive = blessings?.find((choice) => choice.id === "tempered-heart")?.combat
    .passiveAdrenaline;
  if (!passive) return [];
  return [
    [
      "Tempered Heart",
      `+${passive.amount} adrenaline every ${ticksToSeconds(passive.intervalTicks).toFixed(1)}s (${passive.intervalTicks} ticks) · first pulse at t${passive.intervalTicks}`,
    ],
  ];
}

/** One-line quick-calc note when the selected cast is a Basic Attack under Striking Light. */
export function strikingLightBasicCastNote(
  blessings: readonly BlessingChoice[] | undefined,
  ability: { basicAttack?: boolean; autoAttack?: boolean } | null | undefined,
): string | null {
  const choice = strikingLightChoice(blessings);
  const mult = choice?.combat.basicDamageMultiplier;
  if (mult == null || mult === 1) return null;
  if (!isBasicAttack(ability ?? {})) return null;
  const pct = Math.round((mult - 1) * 100);
  return `Includes Striking Light +${pct}% on this Basic Attack`;
}

/**
 * Compact byEffect / revo contribution mark when Striking Light scales this row.
 * Basic Attacks only; not on Light of Saradomin or other blessing hits.
 */
export function strikingLightBasicRowMark(
  blessings: readonly BlessingChoice[] | undefined,
  ability:
    | {
        category?: string;
        basicAttack?: boolean;
        autoAttack?: boolean;
        kind?: string;
      }
    | null
    | undefined,
): string | null {
  const choice = strikingLightChoice(blessings);
  const mult = choice?.combat.basicDamageMultiplier;
  if (mult == null || mult === 1) return null;
  const isBasic = isBasicAttack(ability ?? {}) || ability?.kind === "basic-attack";
  if (!isBasic) return null;
  const pct = Math.round((mult - 1) * 100);
  return `+${pct}% SL`;
}
