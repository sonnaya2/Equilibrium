import { abilityById } from "../data";
import type { AbilityCategory, UnlockInfo } from "../data/records";
import type { AbilitySpec, SupportStatus } from "../pipeline/calculateAbility";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import {
  abilityStyleForBar,
  isSharedConstitutionAbilityId,
  SHARED_CONSTITUTION_ABILITIES,
} from "../styles/shared/constitutionAbilities";
import type { CombatStyle } from "../types";
import { isBasicAttack } from "../shared/adrenalineGain";
import {
  ENGINE_LINK_OVERRIDES,
  pickPrimaryRecord,
  recordsForEngineId,
  type AbilityLinkKind,
  validateEngineMap,
} from "./engineMap";

export type { AbilityLinkKind };
export { engineIdForRecord, RECORD_TO_ENGINE, ENGINE_LINK_OVERRIDES } from "./engineMap";

/**
 * One explicit registry entry per engine ability.
 * Canonical engine ID, primary record, aliases, setup/equipment variants,
 * replacement group, cast stage, solver eligibility, support status.
 */
export interface AbilityRegistryEntry {
  engineId: string;
  /** Canonical primary data record (null when factory-only). */
  recordId: string | null;
  parentRecordId?: string;
  recordAliases?: readonly string[];
  linkKind: AbilityLinkKind;
  castStage?: number;
  replacementGroup?: string;
  cooldownGroup?: string;
  spec: AbilitySpec;
  style: CombatStyle;
  category: AbilityCategory;
  level?: number;
  unlock?: UnlockInfo;
  support: { status: SupportStatus | "full"; note?: string };
  /** Eligible for solver by default when fully modeled, on-GCD, and not an implicit Basic Attack or later cast stage. */
  solverEligibleDefault: boolean;
}

function supportOf(spec: AbilitySpec): AbilityRegistryEntry["support"] {
  if (spec.supportStatus) {
    return { status: spec.supportStatus, note: spec.supportNote };
  }
  return { status: "full", note: spec.supportNote };
}

function solverEligible(spec: AbilitySpec, linkKind: AbilityLinkKind, castStage?: number): boolean {
  if (spec.offGcd) return false;
  if (isBasicAttack(spec)) return false;
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

function buildEntry(spec: AbilitySpec): AbilityRegistryEntry {
  const override = ENGINE_LINK_OVERRIDES[spec.id];
  const mapped = recordsForEngineId(spec.id);
  const linkKind: AbilityLinkKind = override?.linkKind ?? "canonical";
  let recordId: string | null = override?.recordId !== undefined ? override.recordId : null;
  let recordAliases: readonly string[] | undefined;
  const parentRecordId = override?.parentRecordId;
  const castStage = override?.castStage;

  if (recordId == null && mapped.length > 0) {
    recordId = pickPrimaryRecord(spec.id, mapped);
  }
  if (recordId != null && mapped.length > 0) {
    const aliases = mapped.filter((id) => id !== recordId);
    if (aliases.length > 0) recordAliases = aliases;
  }

  const meta = fromRecord(recordId ?? parentRecordId);
  const solverEligibleDefault = override?.forceSolver ?? solverEligible(spec, linkKind, castStage);

  return {
    engineId: spec.id,
    recordId,
    parentRecordId,
    recordAliases,
    linkKind,
    castStage,
    replacementGroup: spec.replacementGroup,
    cooldownGroup: spec.cooldownGroup,
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
  ...SHARED_CONSTITUTION_ABILITIES,
];

/** Fail loud on duplicate engine ids at module load. */
function assertUniqueEngineIds(specs: readonly AbilitySpec[]): void {
  const seen = new Set<string>();
  for (const s of specs) {
    if (seen.has(s.id)) {
      throw new Error(`ABILITY_REGISTRY: duplicate engine id "${s.id}"`);
    }
    seen.add(s.id);
  }
}

assertUniqueEngineIds(ENGINE_SPECS_LIST);

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
  return ABILITY_REGISTRY.filter(
    (e) => e.style === style || isSharedConstitutionAbilityId(e.engineId),
  ).map((e) => abilityStyleForBar(e.spec, style));
}

export function solverPalette(
  style: CombatStyle,
  opts?: { includePartial?: boolean },
): AbilitySpec[] {
  return ABILITY_REGISTRY.filter((e) => {
    if (e.style !== style && !isSharedConstitutionAbilityId(e.engineId)) return false;
    if (e.solverEligibleDefault) return true;
    if (
      opts?.includePartial &&
      e.support.status === "partially-modeled" &&
      !e.spec.offGcd &&
      e.linkKind !== "cast-stage"
    ) {
      return true;
    }
    return false;
  }).map((e) => abilityStyleForBar(e.spec, style));
}

/** Registry/data parity checks for tests and architecture audit. */
export function validateAbilityRegistry(): string[] {
  const errors: string[] = [];
  errors.push(...validateEngineMap(ABILITY_REGISTRY.map((e) => e.engineId)));

  const basicsByStyle = new Map<CombatStyle, string[]>();
  const primaryRecords = new Map<string, string>();

  for (const e of ABILITY_REGISTRY) {
    if (isBasicAttack(e.spec)) {
      const list = basicsByStyle.get(e.style) ?? [];
      list.push(e.engineId);
      basicsByStyle.set(e.style, list);
    }
    if (e.recordId && e.linkKind === "canonical") {
      const prev = primaryRecords.get(e.recordId);
      if (prev && prev !== e.engineId) {
        errors.push(`duplicate canonical primary record ${e.recordId}: ${prev} and ${e.engineId}`);
      }
      primaryRecords.set(e.recordId, e.engineId);
    }
  }

  for (const [style, ids] of basicsByStyle) {
    if (ids.length > 1) {
      errors.push(`multiple Basic Attacks for style ${style}: ${ids.join(", ")}`);
    }
  }

  return errors;
}
