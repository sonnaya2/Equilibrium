/**
 * Pure labels for league blessing damage in analysis / revo UI.
 * Engine effect ids (abilityId on blessing events) are not always BlessingId plates.
 */

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
  "light-of-saradomin": "Striking Light",
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
