/**
 * Lightweight runtime validation at data boundaries.
 * Validate once when loading JSON; UI consumes trusted typed values.
 * Graceful: incomplete generated data yields null / empty, never throws to the UI.
 */

import { log } from "./log";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Dataset envelope used by combat / league JSON. */
export type DatasetEnvelope<T> = {
  snapshotDate?: string;
  records: T[];
};

export function readDatasetRecords<T>(
  raw: unknown,
  parseRecord: (row: unknown) => T | null,
  scope: string,
): T[] {
  if (!isRecord(raw) || !Array.isArray(raw.records)) {
    log.warn("data", `malformed dataset envelope: ${scope}`);
    return [];
  }
  const out: T[] = [];
  for (const row of raw.records) {
    const parsed = parseRecord(row);
    if (parsed) out.push(parsed);
  }
  if (out.length === 0 && raw.records.length > 0) {
    log.warn("data", `no valid records in ${scope}`, { raw: raw.records.length });
  }
  return out;
}

export type SourceRefShape = {
  source: string;
  url: string;
  title?: string;
  verifiedAt?: string;
};

export function parseSourceRef(raw: unknown): SourceRefShape | null {
  if (!isRecord(raw)) return null;
  const source = asString(raw.source);
  const url = asString(raw.url);
  if (!source || !url) return null;
  return {
    source,
    url,
    title: asString(raw.title),
    verifiedAt: asString(raw.verifiedAt),
  };
}

/** Combat ability row used by the Reference tab (modernisation-2026). */
export type CombatAbilityRow = {
  name: string;
  damage_percent?: string | number;
  damage?: string | number;
  two_handed?: string | number | boolean;
  dual_wield?: string | number | boolean;
  special_rule?: string;
  summary?: string;
  igneous_variant?: string;
  bloodlust?: string | number;
  other?: string;
  chain?: string;
  movement?: string;
  healing_percent?: string | number;
  cooldown_seconds?: string | number;
  duration_seconds?: string | number;
  damage_multiplier?: string | number;
  incoming_damage_multiplier?: string | number;
  bloodlust_gain?: string | number;
  [key: string]: string | number | boolean | undefined;
};

export function parseCombatAbilityRow(raw: unknown): CombatAbilityRow | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  if (!name) return null;
  const row: CombatAbilityRow = { name };
  for (const [key, value] of Object.entries(raw)) {
    if (key === "name") continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      row[key] = value;
    }
  }
  return row;
}

export function parseAbilityList(raw: unknown, scope: string): CombatAbilityRow[] {
  if (!Array.isArray(raw)) {
    log.warn("data", `expected ability array: ${scope}`);
    return [];
  }
  return raw.map(parseCombatAbilityRow).filter((r): r is CombatAbilityRow => r != null);
}

/** League region record (data/league/regions.json). */
export type LeagueRegionRow = {
  id: string;
  name: string;
  availability: string;
};

export function parseLeagueRegion(raw: unknown): LeagueRegionRow | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name);
  const availability = asString(raw.availability);
  if (!id || !name || !availability) return null;
  return { id, name, availability };
}

/** Relic tier envelope row. */
export type RelicTierRow = {
  tier: number;
  revealed: boolean;
  verified?: boolean;
  source?: SourceRefShape | null;
  choices: Array<{
    name: string;
    /** 0 top, 1 middle, 2 bottom. Absent on fully revealed tiers, which fill in order. */
    seat?: number | null;
    effects: string[];
    source?: SourceRefShape | null;
    verified?: boolean;
  }>;
};

export function parseRelicTier(raw: unknown): RelicTierRow | null {
  if (!isRecord(raw)) return null;
  const tier = asNumber(raw.tier);
  if (tier == null) return null;
  const choicesRaw = Array.isArray(raw.choices) ? raw.choices : [];
  const choices = choicesRaw
    .map((c) => {
      if (!isRecord(c)) return null;
      const name = asString(c.name);
      if (!name) return null;
      return {
        name,
        // Explicit once a tier is only partly revealed: without it a known
        // bottom relic would slide up into the empty top slot.
        seat: asNumber(c.seat),
        effects: asStringArray(c.effects),
        source: parseSourceRef(c.source),
        verified: asBoolean(c.verified),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);
  return {
    tier,
    revealed: asBoolean(raw.revealed) ?? false,
    verified: asBoolean(raw.verified),
    source: parseSourceRef(raw.source),
    choices,
  };
}

/** Blessing tier envelope row. */
export type BlessingTierRow = {
  tier: number;
  revealed: boolean;
  paths: string[];
  godTier: boolean;
  choices: Array<{
    /** Order, Balance or Chaos - the card names its own path rather than relying on column order. */
    path: string;
    name: string;
    effects: string[];
    source?: SourceRefShape | null;
    verified?: boolean;
  }>;
  source?: SourceRefShape | null;
  verified?: boolean;
};

export function parseBlessingTier(raw: unknown): BlessingTierRow | null {
  if (!isRecord(raw)) return null;
  const tier = asNumber(raw.tier);
  if (tier == null) return null;
  const choicesRaw = Array.isArray(raw.choices) ? raw.choices : [];
  const choices = choicesRaw
    .map((c) => {
      if (!isRecord(c)) return null;
      const name = asString(c.name);
      const path = asString(c.path);
      if (!name || !path) return null;
      return {
        path,
        name,
        effects: asStringArray(c.effects),
        source: parseSourceRef(c.source),
        verified: asBoolean(c.verified),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);
  return {
    tier,
    revealed: asBoolean(raw.revealed) ?? false,
    paths: asStringArray(raw.paths),
    godTier: asBoolean(raw.godTier) ?? false,
    choices,
    source: parseSourceRef(raw.source),
    verified: asBoolean(raw.verified),
  };
}

/** Task record boundary - incomplete rows are dropped, not cast through. */
export type TaskRow = {
  id?: string;
  name: string;
  tier: string;
  points?: number;
  description?: string;
  region?: string;
  regionId?: string;
  category?: string;
  requirements?: string;
  catalystCompletionRate?: number;
  skills?: string[];
};

export function parseTaskRow(raw: unknown): TaskRow | null {
  if (!isRecord(raw)) return null;
  const name = asString(raw.name);
  const tier = asString(raw.tier);
  if (!name || !tier) return null;
  const rate = raw.catalystCompletionRate;
  return {
    id: asString(raw.id),
    name,
    tier,
    points: asNumber(raw.points),
    description: asString(raw.description),
    region: asString(raw.region),
    regionId: asString(raw.regionId),
    category: asString(raw.category),
    requirements: asString(raw.requirements),
    catalystCompletionRate: typeof rate === "number" && Number.isFinite(rate) ? rate : undefined,
    skills: Array.isArray(raw.skills)
      ? raw.skills.filter((s): s is string => typeof s === "string")
      : undefined,
  };
}

export function parseTaskList(raw: unknown, scope = "tasks"): TaskRow[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.records)
      ? raw.records
      : null;
  if (!list) {
    log.warn("data", `malformed task payload: ${scope}`);
    return [];
  }
  return list.map(parseTaskRow).filter((r): r is TaskRow => r != null);
}
