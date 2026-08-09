const SAVED_EQUIPMENT_ID_ALIASES: Readonly<Record<string, string>> = {
  "item:hydra-bakriminel-bolts-e": "item:hydrix-bakriminel-bolts-e",
};

export function normalizeSavedEquipmentId(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  return SAVED_EQUIPMENT_ID_ALIASES[raw] ?? raw;
}

export function normalizeSelectedAmmunitionId(
  isQuiver: boolean,
  rawSelectedAmmunitionId: unknown,
): string | null {
  if (!isQuiver) return null;
  return normalizeSavedEquipmentId(rawSelectedAmmunitionId);
}
