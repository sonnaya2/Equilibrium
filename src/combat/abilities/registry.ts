import { abilityById, combatAbilities } from "../data";
import type { AbilityCategory, UnlockInfo } from "../data/records";
import { engineIdForRecord } from "../data/specs";
import type { AbilitySpec, SupportStatus } from "../pipeline/calculateAbility";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import type { CombatStyle } from "../types";

export interface AbilityRegistryEntry {
  engineId: string;
  recordId: string | null;
  parentRecordId?: string;
  recordAliases?: readonly string[];
  linkKind:
    "canonical" | "record-alias" | "setup-variant" | "equipment-variant" | "cast-stage" | "factory";
  spec: AbilitySpec;
  style: CombatStyle;
  category: AbilityCategory;
  level?: number;
  unlock?: UnlockInfo;
  support: { status: SupportStatus | "full"; note?: string };
  /** Eligible for solver by default when fully modeled, not auto, not offGcd, not cast-stage>1. */
  solverEligibleDefault: boolean;
}

/** Engine id -> primary + alias record ids (from ENGINE_ID_BY_RECORD_ID scan). */
const RECORDS_BY_ENGINE: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const record of combatAbilities.records) {
    const engineId = engineIdForRecord(record.id);
    if (!engineId) continue;
    const list = map.get(engineId) ?? [];
    list.push(record.id);
    map.set(engineId, list);
  }
  return map;
})();

/** Prefer the record whose kebab id matches engine snake id (e.g. greater_fury). */
function pickPrimaryRecord(engineId: string, ids: readonly string[]): string {
  const expected = engineId.replace(/_/g, "-");
  const stylePrefixed = ids.find((id) => id.endsWith(`:${expected}`));
  if (stylePrefixed) return stylePrefixed;
  return ids[0]!;
}

function supportOf(spec: AbilitySpec): AbilityRegistryEntry["support"] {
  if (spec.supportStatus) {
    return { status: spec.supportStatus, note: spec.supportNote };
  }
  return { status: "full", note: spec.supportNote };
}

function solverEligible(
  spec: AbilitySpec,
  linkKind: AbilityRegistryEntry["linkKind"],
  castStage?: number,
): boolean {
  if (spec.autoAttack) return false;
  if (spec.offGcd) return false;
  if (linkKind === "cast-stage" && (castStage ?? 2) > 1) return false;
  if (spec.supportStatus === "partially-modeled") return false;
  if (spec.supportStatus === "not-modeled") return false;
  if (spec.supportStatus === "mechanics-unverified") return false;
  return true;
}

function fromRecord(recordId: string | null | undefined): {
  level?: number;
  unlock?: UnlockInfo;
  category?: AbilityCategory;
} {
  if (!recordId) return {};
  const record = abilityById(recordId);
  if (!record) return {};
  return { level: record.level, unlock: record.unlock, category: record.category };
}

type LinkOverride = {
  linkKind: AbilityRegistryEntry["linkKind"];
  recordId?: string | null;
  parentRecordId?: string;
  castStage?: number;
  forceSolver?: boolean;
};

const LINK_OVERRIDES: Readonly<Record<string, LinkOverride>> = {
  adaptive_strike_2h: {
    linkKind: "setup-variant",
    recordId: "melee:adaptive-strike",
    parentRecordId: "melee:adaptive-strike",
  },
  adaptive_strike_dw: {
    linkKind: "setup-variant",
    recordId: "melee:adaptive-strike",
    parentRecordId: "melee:adaptive-strike",
  },
  overpower_igneous: {
    linkKind: "equipment-variant",
    recordId: "melee:overpower",
    parentRecordId: "melee:overpower",
  },
  deadshot_igneous: {
    linkKind: "equipment-variant",
    recordId: "ranged:deadshot",
    parentRecordId: "ranged:deadshot",
  },
  omnipower_igneous: {
    linkKind: "equipment-variant",
    recordId: "magic:omnipower",
    parentRecordId: "magic:omnipower",
  },
  death_skulls_igneous: {
    linkKind: "equipment-variant",
    recordId: "necromancy:death-skulls",
    parentRecordId: "necromancy:death-skulls",
  },
  spectral_scythe_2: {
    linkKind: "cast-stage",
    recordId: "necromancy:spectral-scythe",
    parentRecordId: "necromancy:spectral-scythe",
    castStage: 2,
  },
  spectral_scythe_3: {
    linkKind: "cast-stage",
    recordId: "necromancy:spectral-scythe",
    parentRecordId: "necromancy:spectral-scythe",
    castStage: 3,
  },
  volley_of_souls: {
    linkKind: "factory",
    forceSolver: true,
  },
};

function buildEntry(spec: AbilitySpec): AbilityRegistryEntry {
  const override = LINK_OVERRIDES[spec.id];
  const mapped = RECORDS_BY_ENGINE.get(spec.id) ?? [];
  const linkKind: AbilityRegistryEntry["linkKind"] = override?.linkKind ?? "canonical";
  let recordId: string | null = override?.recordId !== undefined ? override.recordId : null;
  let recordAliases: readonly string[] | undefined;
  const parentRecordId = override?.parentRecordId;

  if (recordId == null && mapped.length > 0) {
    recordId = pickPrimaryRecord(spec.id, mapped);
  }
  if (recordId != null && mapped.length > 0) {
    const aliases = mapped.filter((id) => id !== recordId);
    if (aliases.length > 0) recordAliases = aliases;
  }

  const meta = fromRecord(recordId ?? parentRecordId);
  const solverEligibleDefault =
    override?.forceSolver ?? solverEligible(spec, linkKind, override?.castStage);

  return {
    engineId: spec.id,
    recordId,
    parentRecordId,
    recordAliases,
    linkKind,
    spec,
    style: spec.style,
    category: meta.category ?? spec.category,
    level: meta.level,
    unlock: meta.unlock,
    support: supportOf(spec),
    solverEligibleDefault,
  };
}

const ENGINE_SPECS_LIST: AbilitySpec[] = [
  ...MELEE_ABILITIES,
  ...RANGED_ABILITIES,
  ...MAGIC_ABILITIES,
  ...NECROMANCY_ABILITIES,
  volleyOfSouls(3),
];

export const ABILITY_REGISTRY: readonly AbilityRegistryEntry[] = ENGINE_SPECS_LIST.map(buildEntry);

export const engineSpecs: ReadonlyMap<string, AbilitySpec> = new Map(
  ABILITY_REGISTRY.map((e) => [e.engineId, e.spec]),
);

const BY_ENGINE = new Map(ABILITY_REGISTRY.map((e) => [e.engineId, e]));
const BY_RECORD = new Map<string, AbilityRegistryEntry>();
for (const entry of ABILITY_REGISTRY) {
  if (entry.recordId && !BY_RECORD.has(entry.recordId)) {
    BY_RECORD.set(entry.recordId, entry);
  }
  for (const alias of entry.recordAliases ?? []) {
    if (!BY_RECORD.has(alias)) BY_RECORD.set(alias, entry);
  }
  if (entry.parentRecordId && !BY_RECORD.has(entry.parentRecordId)) {
    BY_RECORD.set(entry.parentRecordId, entry);
  }
}

export function entryByEngineId(id: string): AbilityRegistryEntry | undefined {
  return BY_ENGINE.get(id);
}

export function entryByRecordId(id: string): AbilityRegistryEntry | undefined {
  return BY_RECORD.get(id);
}

export function allEngineSpecs(): AbilitySpec[] {
  return ABILITY_REGISTRY.map((e) => e.spec);
}

export function engineSpecsForStyle(style: CombatStyle): AbilitySpec[] {
  return ABILITY_REGISTRY.filter((e) => e.style === style).map((e) => e.spec);
}

export function solverPalette(
  style: CombatStyle,
  opts?: { includePartial?: boolean },
): AbilitySpec[] {
  return ABILITY_REGISTRY.filter((e) => {
    if (e.style !== style) return false;
    if (e.solverEligibleDefault) return true;
    if (
      opts?.includePartial &&
      e.support.status === "partially-modeled" &&
      !e.spec.autoAttack &&
      !e.spec.offGcd &&
      e.linkKind !== "cast-stage"
    ) {
      return true;
    }
    return false;
  }).map((e) => e.spec);
}

/** Reverse of engineIdForRecord for every mapped ability record. */
export const ENGINE_ID_BY_RECORD_ID: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  for (const record of combatAbilities.records) {
    const engineId = engineIdForRecord(record.id);
    if (engineId) out[record.id] = engineId;
  }
  return out;
})();
