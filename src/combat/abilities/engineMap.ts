/**
 * Single authority: data-record id <-> engine AbilitySpec id + link metadata.
 *
 * Registry builds AbilityRegistryEntry from this map + style AbilitySpec lists.
 * specs.ts resolveBarSlot reads engineIdForRecord from here - never a second map.
 */

export type AbilityLinkKind =
  "canonical" | "record-alias" | "setup-variant" | "equipment-variant" | "cast-stage" | "factory";

export interface EngineLinkOverride {
  linkKind: AbilityLinkKind;
  /** Canonical primary record when not inferred from RECORD_TO_ENGINE. */
  recordId?: string | null;
  parentRecordId?: string;
  castStage?: number;
  forceSolver?: boolean;
}

/**
 * Record id -> engine AbilitySpec id for every calculable entry.
 * adaptive-strike resolves by weapon setup (see resolveBarSlot / ENGINE_LINK_OVERRIDES).
 * Never include prose-only effect note ids.
 */
export const RECORD_TO_ENGINE: Readonly<Record<string, string>> = {
  // Melee
  "melee:attack": "attack",
  "melee:rend": "rend",
  "melee:fury": "fury",
  "melee:greater-fury": "greater_fury",
  "melee:backhand": "backhand",
  "melee:punish": "punish",
  "melee:barge": "barge",
  "melee:greater-barge": "greater_barge",
  "melee:dismember": "dismember",
  "melee:slaughter": "slaughter",
  "melee:massacre": "massacre",
  "melee:assault": "assault",
  "melee:flurry": "flurry",
  "melee:greater-flurry": "greater_flurry",
  "melee:hurricane": "hurricane",
  "melee:overpower": "overpower",
  "melee:pulverise": "pulverise",
  "melee:berserk": "berserk",
  "melee:meteor-strike": "meteor_strike",
  "melee:chaos-roar": "chaos_roar",
  "melee:igneous-showdown": "igneous_showdown",
  // Ranged
  "ranged:balance-by-force": "balance_by_force",
  "ranged:descent-of-darkness": "descent_of_darkness",
  "ranged:descent-of-dragons": "descent_of_darkness",
  "ranged:attack": "ranged_attack",
  "ranged:piercing-shot": "piercing_shot",
  "ranged:binding-shot": "binding_shot",
  "ranged:galeshot": "galeshot",
  "ranged:ricochet": "ricochet",
  "ranged:greater-ricochet": "greater_ricochet",
  "ranged:snap-shot": "snap_shot",
  "ranged:snipe": "snipe",
  "ranged:bombardment": "bombardment",
  "ranged:rapid-fire": "rapid_fire",
  "ranged:corruption-shot": "corruption_shot",
  "ranged:shadow-tendrils": "shadow_tendrils",
  "ranged:imbue-shadows": "imbue_shadows",
  "ranged:deadshot": "deadshot",
  "ranged:deadshot-igneous": "deadshot_igneous",
  "ranged:deaths-swiftness": "deaths_swiftness",
  "ranged:greater-deaths-swiftness": "greater_deaths_swiftness",
  // Magic
  "magic:magic-attack": "magic_attack",
  "magic:sonic-wave": "sonic_wave",
  "magic:greater-sonic-wave": "greater_sonic_wave",
  "magic:dragon-breath": "dragon_breath",
  "magic:impact": "impact",
  "magic:combust": "combust",
  "magic:chain": "chain",
  "magic:greater-chain": "greater_chain",
  "magic:concentrated-blast": "concentrated_blast",
  "magic:greater-concentrated-blast": "greater_concentrated_blast",
  "magic:wild-magic": "wild_magic",
  "magic:asphyxiate": "asphyxiate",
  "magic:asphyxiate-resplendence": "asphyxiate",
  "magic:omnipower-igneous": "omnipower_igneous",
  "magic:dragon-breath-empowered": "dragon_breath",
  "magic:corruption-blast": "corruption_blast",
  "magic:smoke-tendrils": "smoke_tendrils",
  "magic:magma-tempest": "magma_tempest",
  "magic:omnipower": "omnipower",
  "magic:sunshine": "sunshine",
  "magic:greater-sunshine": "greater_sunshine",
  "magic:tsunami": "tsunami",
  "magic:runic-charge": "runic_charge",
  "magic:instability": "instability",
  "magic:claws-of-guthix": "claws_of_guthix",
  // Necromancy
  "necromancy:necromancy": "necromancy_basic",
  "necromancy:soul-sap": "soul_sap",
  "necromancy:touch-of-death": "touch_of_death",
  "necromancy:finger-of-death": "finger_of_death",
  "necromancy:death-skulls": "death_skulls",
  "necromancy:soul-strike": "soul_strike",
  "necromancy:spectral-scythe": "spectral_scythe",
  "necromancy:bloat": "bloat",
  "necromancy:living-death": "living_death",
  "necromancy:volley-of-souls": "volley_of_souls",
  "necromancy:blood-siphon": "blood_siphon",
  "necromancy:conjure-skeleton-warrior": "conjure_skeleton_warrior",
  "necromancy:conjure-vengeful-ghost": "conjure_vengeful_ghost",
  "necromancy:conjure-putrid-zombie": "conjure_putrid_zombie",
  "necromancy:conjure-phantom-guardian": "conjure_phantom_guardian",
  "necromancy:conjure-undead-army": "conjure_undead_army",
  "necromancy:command-skeleton-warrior": "command_skeleton_warrior",
  "necromancy:command-putrid-zombie": "command_putrid_zombie",
  "necromancy:command-phantom-guardian": "command_phantom_guardian",
  "necromancy:command-vengeful-ghost": "command_vengeful_ghost",
  "necromancy:death-grasp": "death_grasp",
  // Shared (Constitution) - usable on every style bar
  "shared:sacrifice": "sacrifice",
  "shared:tuskas-wrath": "tuskas_wrath",
};

/** Per-engine-id link overrides (setup / equipment variants, cast stages, factories). */
export const ENGINE_LINK_OVERRIDES: Readonly<Record<string, EngineLinkOverride>> = {
  adaptive_strike_2h: {
    linkKind: "setup-variant",
    recordId: "melee:adaptive-strike",
    parentRecordId: "melee:adaptive-strike",
  },
  adaptive_strike_mh: {
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
  // Manual-only weapon specials: cast in Manual rotations, not Revo++ solver pool.
  instability: {
    linkKind: "canonical",
    forceSolver: false,
  },
  claws_of_guthix: {
    linkKind: "canonical",
    forceSolver: false,
  },
  igneous_showdown: {
    linkKind: "canonical",
    forceSolver: false,
  },
  soulfire: {
    linkKind: "canonical",
    forceSolver: false,
  },
  balance_by_force: {
    linkKind: "canonical",
    forceSolver: false,
  },
  descent_of_darkness: {
    linkKind: "canonical",
    forceSolver: false,
  },
};

/** Record id -> engine id when mapped, else undefined. */
export function engineIdForRecord(recordId: string): string | undefined {
  return RECORD_TO_ENGINE[recordId];
}

/** Engine id -> all record ids that map to it (aliases included). */
export function recordsForEngineId(engineId: string): readonly string[] {
  const out: string[] = [];
  for (const [recordId, eng] of Object.entries(RECORD_TO_ENGINE)) {
    if (eng === engineId) out.push(recordId);
  }
  return out;
}

/**
 * Prefer the record whose kebab id matches engine snake id (e.g. greater_fury).
 * Source-order fallback only when no name match - still deterministic.
 */
export function pickPrimaryRecord(engineId: string, ids: readonly string[]): string {
  if (ids.length === 0) throw new Error(`pickPrimaryRecord: empty ids for ${engineId}`);
  const expected = engineId.replace(/_/g, "-");
  const stylePrefixed = ids.find((id) => id.endsWith(`:${expected}`));
  if (stylePrefixed) return stylePrefixed;
  return ids[0]!;
}

/** Validate map integrity; returns error strings (empty = ok). */
export function validateEngineMap(engineSpecIds: readonly string[]): string[] {
  const errors: string[] = [];
  const engineSet = new Set(engineSpecIds);
  const seenRecords = new Map<string, string>();

  for (const [recordId, engineId] of Object.entries(RECORD_TO_ENGINE)) {
    if (seenRecords.has(recordId)) {
      errors.push(`duplicate record mapping: ${recordId}`);
    }
    seenRecords.set(recordId, engineId);
    // volley_of_souls is factory-only; usually present via volleyOfSouls(3)
    if (!engineSet.has(engineId)) {
      errors.push(`record ${recordId} maps to missing engine id ${engineId}`);
    }
  }

  for (const [engineId] of Object.entries(ENGINE_LINK_OVERRIDES)) {
    if (!engineSet.has(engineId)) {
      errors.push(`link override for unknown engine id ${engineId}`);
    }
  }

  return errors;
}
