/**
 * Deterministic solver benchmark cases.
 * Minimal serializable requests using engine loadout packing shapes (not UI loadouts).
 */
import { EQUIPMENT_SET_ACTIVATION, type ActiveEquipmentEffects } from "../../shared/equipment";
import type { AdrenalineRules, ProcRules } from "../../engine/simulation/contracts";
import type { SearchTier } from "../contracts";
import { resolveLeagueRules } from "../../league/ruleset";
import { serializeLeague } from "../worker/revive";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  type AuthoredSeedBar,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
} from "../worker/serializable";
import type { BlessingPath } from "@/league/blessings";
import type { CombatStyle } from "../../types";
import { OBJECTIVE_HORIZON_TICKS } from "../objective";
import type { PlayerPoisonProfile } from "../../poison/mechanics";
import type { ResolveLeagueRulesDerived } from "../../league/ruleset";

export type BenchCaseId =
  | "melee-2h-4slot"
  | "melee-dw-4to6"
  | "ranged-6slot"
  | "magic-6slot"
  | "necro-6slot"
  | "leng-icy-context"
  | "igneous-context"
  | "four-slot-fixed"
  | "six-slot-fixed"
  | "eight-slot-search"
  | "ten-slot-search"
  // Phase 0 representative fixtures (performance baseline)
  | "melee-norng-4slot"
  | "sunshine-magic"
  | "deaths-swiftness-ranged"
  | "necro-conjures"
  | "impatient-relentless"
  | "equipment-procs"
  | "league-blessings"
  | "league-blessings-control"
  | "league-poison-melee"
  | "league-poison-melee-aftershock"
  | "league-poison-melee-control"
  | "league-avernic-delta"
  | "league-avernic-delta-control"
  | "league-necro-conjures"
  | "league-necro-conjures-control"
  | "league-light-ranged"
  | "league-light-ranged-control"
  | "league-aoe-magic"
  | "league-aoe-magic-control"
  | "unhinged-300s";

export interface BenchCaseDef {
  id: BenchCaseId;
  /** Include in quick suite (4-slot / tiny-budget only). */
  quick: boolean;
  /** Stable seed for determinism. */
  seed: number;
  expectedFullError?: string;
  build: () => SerializableSolverRequest;
}

const emptyEffects = (passiveIds: readonly string[] = []): ActiveEquipmentEffects => ({
  activation: EQUIPMENT_SET_ACTIVATION,
  passiveIds: passiveIds as ActiveEquipmentEffects["passiveIds"],
  enchantments: [],
  weaponClass: null,
  defenderEquipped: false,
  passage: { active: false, agonyActive: false },
  amZiFlatDamage: 0,
  amHejDamageBonus: 0,
  vestments: {
    pieces: 0,
    heraldOfChaos: false,
    berserkExtension: false,
    increasedAdrenalineCap: false,
  },
});

type WeaponConfig = SerializableRevolutionSimBase["weaponConfiguration"];

function baseLoadout(opts: {
  style: CombatStyle;
  weaponConfiguration: WeaponConfig;
  equipmentIds?: readonly string[];
  passiveIds?: readonly string[];
  adrenaline?: AdrenalineRules;
  procs?: ProcRules;
  plantedFeet?: boolean;
  preciseRank?: number;
  ammo?: SerializableRevolutionSimBase["ammo"];
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  tumekensPieces?: number;
  tumekensCritEnabled?: boolean;
  crit?: SerializableRevolutionSimBase["crit"];
  league?: SerializableRevolutionSimBase["league"];
  context?: SerializableRevolutionSimBase["context"];
  playerPoison?: PlayerPoisonProfile;
  ruleset?: "base" | "equilibrium";
}): SerializableRevolutionSimBase {
  const ruleset = opts.ruleset ?? "base";
  return {
    base: 1200,
    level: 99,
    accuracy: 1,
    crit: opts.crit ?? { chance: 0.1, damageBonus: 0 },
    equipmentEffects: emptyEffects(opts.passiveIds ?? []),
    league: opts.league ?? {
      ruleset,
      blessings: [],
      blessingIds: [],
      totalArmour: 0,
      maximumLife: 10_000,
      powerburstUntilTick: 0,
      targetSize: 1,
      occupiedTiles: 1,
    },
    context: opts.context ?? { style: opts.style, ruleset, targetSize: 1, occupiedTiles: 1 },
    equipmentIds: [...(opts.equipmentIds ?? [])],
    weaponConfiguration: opts.weaponConfiguration,
    startingAdrenaline: 100,
    adrenaline: opts.adrenaline,
    procs: opts.procs,
    playerPoison: opts.playerPoison,
    plantedFeet: opts.plantedFeet,
    preciseRank: opts.preciseRank,
    ammo: opts.ammo,
    conjureBasicDamageMult: opts.conjureBasicDamageMult,
    conjureDurationMult: opts.conjureDurationMult,
    tumekensPieces: opts.tumekensPieces,
    tumekensCritEnabled: opts.tumekensCritEnabled,
    modifierSources: emptyModifierSources(),
  };
}

function seedBar(id: string, abilityIds: readonly string[]): AuthoredSeedBar {
  return { id, abilityIds, baseline: true };
}

/**
 * Bench requests always use thorough tier on the wire unless a case opts into
 * extreme/unhinged (only real SearchTier values). Quick mode overrides
 * evaluationBudget in the runner - not the request tier field.
 */
function makeRequest(opts: {
  style: CombatStyle;
  seed: number;
  minBarSize: number;
  maxBarSize: number;
  weaponConfiguration: WeaponConfig;
  equipmentIds?: readonly string[];
  passiveIds?: readonly string[];
  adrenaline?: AdrenalineRules;
  procs?: ProcRules;
  plantedFeet?: boolean;
  preciseRank?: number;
  ammo?: SerializableRevolutionSimBase["ammo"];
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  tumekensPieces?: number;
  tumekensCritEnabled?: boolean;
  crit?: SerializableRevolutionSimBase["crit"];
  league?: SerializableRevolutionSimBase["league"];
  context?: SerializableRevolutionSimBase["context"];
  ruleset?: "base" | "equilibrium";
  blessingPicks?: readonly BlessingPath[];
  tier?: SearchTier;
  authoredSeedBars?: readonly AuthoredSeedBar[];
  /** Include partially-modeled catalogue abilities (e.g. necromancy conjures). */
  includePartial?: boolean;
  permittedCategories?: SerializableSolverRequest["permittedCategories"];
  unlockedRegions?: SerializableSolverRequest["unlockedRegions"];
  playerPoison?: PlayerPoisonProfile;
  /** Short horizons keep real evals cheap in CI. */
  durationTicks?: number;
  exploreDurationTicks?: number;
}): SerializableSolverRequest {
  const ruleset = opts.ruleset ?? "base";
  return defaultSerializableRequest({
    style: opts.style,
    seed: opts.seed,
    tier: opts.tier ?? "thorough",
    profileId: "balanced",
    minBarSize: opts.minBarSize,
    maxBarSize: opts.maxBarSize,
    durationTicks: opts.durationTicks ?? 50,
    exploreDurationTicks: opts.exploreDurationTicks ?? 24,
    unlockedRegions: opts.unlockedRegions ?? ["misthalin", "havenhythe", "karamja", "asgarnia"],
    includeUnknownAvailability: true,
    includePartial: opts.includePartial === true,
    permittedCategories: opts.permittedCategories ?? ["basic", "enhanced", "ultimate"],
    ruleset,
    blessingPicks: opts.blessingPicks ? [...opts.blessingPicks] : [],
    authoredSeedBars: opts.authoredSeedBars ? [...opts.authoredSeedBars] : [],
    loadout: baseLoadout({
      style: opts.style,
      weaponConfiguration: opts.weaponConfiguration,
      equipmentIds: opts.equipmentIds,
      passiveIds: opts.passiveIds,
      adrenaline: opts.adrenaline,
      procs: opts.procs,
      plantedFeet: opts.plantedFeet,
      preciseRank: opts.preciseRank,
      ammo: opts.ammo,
      conjureBasicDamageMult: opts.conjureBasicDamageMult,
      conjureDurationMult: opts.conjureDurationMult,
      tumekensPieces: opts.tumekensPieces,
      tumekensCritEnabled: opts.tumekensCritEnabled,
      crit: opts.crit,
      league: opts.league,
      context: opts.context,
      playerPoison: opts.playerPoison,
      ruleset,
    }),
  });
}

/** Equilibrium league payload for blessing-context fixtures (deterministic picks). */
function equilibriumLeague(
  picks: readonly BlessingPath[],
  derived: ResolveLeagueRulesDerived = {},
) {
  const live = resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: picks },
    {
      totalArmour: 2_000,
      maximumLife: 12_000,
      powerburstUntilTick: 0,
      targetSize: 1,
      occupiedTiles: 1,
      ...derived,
    },
  );
  return serializeLeague(live);
}

const LEAGUE_LENG_PICKS = [
  "Balance",
  "Chaos",
  "Chaos",
  "Chaos",
  "Order",
  "Balance",
  "Balance",
  "Order",
] as const satisfies readonly BlessingPath[];

const LEAGUE_POISON_PICKS = [
  "Balance",
  "Chaos",
  "Chaos",
  "Chaos",
  "Chaos",
  "Balance",
  "Balance",
  "Balance",
] as const satisfies readonly BlessingPath[];

const LEAGUE_NECRO_PICKS = [
  "Balance",
  "Chaos",
  "Chaos",
  "Balance",
  "Balance",
  "Order",
  "Chaos",
  "Balance",
] as const satisfies readonly BlessingPath[];

const LEAGUE_LIGHT_PICKS = [
  "Balance",
  "Order",
  "Order",
  "Order",
  "Order",
  "Order",
  "Chaos",
  "Order",
] as const satisfies readonly BlessingPath[];

const LEAGUE_AOE_PICKS = [
  "Balance",
  "Balance",
  "Balance",
  "Balance",
  "Chaos",
  "Balance",
  "Balance",
  "Balance",
] as const satisfies readonly BlessingPath[];

const LEAGUE_AVERNIC_PICKS = [
  "Chaos",
  "Chaos",
  "Chaos",
  "Order",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
] as const satisfies readonly BlessingPath[];

const LEAGUE_AVERNIC_CONTROL_PICKS = [
  "Chaos",
  "Chaos",
  "Balance",
  "Order",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
] as const satisfies readonly BlessingPath[];

function leagueLengRequest(seed: number, leagueEnabled: boolean): SerializableSolverRequest {
  const league = leagueEnabled ? equilibriumLeague(LEAGUE_LENG_PICKS) : undefined;
  return makeRequest({
    style: "melee",
    seed,
    minBarSize: 6,
    maxBarSize: 6,
    weaponConfiguration: "dualwield",
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    passiveIds: ["leng-endless-frost", "leng-boundless-chill"],
    adrenaline: {
      impatientRank: 4,
      impatientLevel20: true,
      relentlessRank: 5,
      relentlessLevel20: true,
    },
    ...(leagueEnabled
      ? {
          ruleset: "equilibrium" as const,
          blessingPicks: LEAGUE_LENG_PICKS,
          league,
          context: {
            style: "melee" as const,
            ruleset: "equilibrium" as const,
            targetSize: 1,
            occupiedTiles: 1,
          },
        }
      : {}),
    durationTicks: 100,
    exploreDurationTicks: 30,
    permittedCategories: ["basic", "enhanced", "ultimate", "utility"],
    authoredSeedBars: [
      seedBar("league-leng", [
        "icy_tempest",
        "assault",
        "dismember",
        "greater_flurry",
        "fury",
        "adaptive_strike_dw",
      ]),
    ],
  });
}

function leaguePoisonRequest(
  seed: number,
  leagueEnabled: boolean,
  aftershock = false,
): SerializableSolverRequest {
  const playerPoison: PlayerPoisonProfile = {
    potion: "weapon-plus-plus-plus",
    potionUntilTick: 1_200,
    kwuarmPotency: 4,
    cinderbane: true,
    blowpipe: false,
    laniakea: true,
  };
  const league = leagueEnabled
    ? equilibriumLeague(LEAGUE_POISON_PICKS, {
        targetSize: 3,
        occupiedTiles: 9,
        areaTargets: 3,
        herbloreLevel: 120,
      })
    : undefined;
  return makeRequest({
    style: "melee",
    seed,
    minBarSize: 6,
    maxBarSize: 6,
    weaponConfiguration: "twohand",
    equipmentIds: ["item:laniakeas-spear", "item:cinderbane-gloves"],
    passiveIds: ["laniakea-weapon-poison", "cinderbane-weapon-poison"],
    procs: { cracklingRank: 4, ...(aftershock ? { aftershockRank: 4 } : {}) },
    playerPoison,
    unlockedRegions: ["misthalin", "havenhythe", "karamja", "asgarnia", "tirannwn", "anachronia"],
    adrenaline: {
      impatientRank: 4,
      impatientLevel20: true,
      relentlessRank: 5,
      relentlessLevel20: true,
    },
    ...(leagueEnabled
      ? {
          ruleset: "equilibrium" as const,
          blessingPicks: LEAGUE_POISON_PICKS,
          league,
          context: {
            style: "melee" as const,
            ruleset: "equilibrium" as const,
            targetSize: 3,
            occupiedTiles: 9,
          },
        }
      : {
          context: {
            style: "melee" as const,
            ruleset: "base" as const,
            targetSize: 3,
            occupiedTiles: 9,
          },
        }),
    durationTicks: 100,
    exploreDurationTicks: 30,
    authoredSeedBars: [
      seedBar("league-poison", [
        "assault",
        "dismember",
        "adaptive_strike_2h",
        "punish",
        "fury",
        "backhand",
      ]),
    ],
  });
}

function leagueAvernicRequest(seed: number, avernic: boolean): SerializableSolverRequest {
  const picks = avernic ? LEAGUE_AVERNIC_PICKS : LEAGUE_AVERNIC_CONTROL_PICKS;
  const league = equilibriumLeague(picks);
  return makeRequest({
    style: "melee",
    seed,
    minBarSize: 6,
    maxBarSize: 6,
    weaponConfiguration: "twohand",
    ruleset: "equilibrium",
    blessingPicks: picks,
    league,
    context: {
      style: "melee",
      ruleset: "equilibrium",
      targetSize: 1,
      occupiedTiles: 1,
    },
    durationTicks: 100,
    exploreDurationTicks: 30,
    authoredSeedBars: [
      seedBar("league-avernic", [
        "assault",
        "dismember",
        "adaptive_strike_2h",
        "punish",
        "fury",
        "backhand",
      ]),
    ],
  });
}

function leagueLightRequest(seed: number, leagueEnabled: boolean): SerializableSolverRequest {
  const playerPoison: PlayerPoisonProfile = {
    potion: "weapon-plus-plus-plus",
    potionUntilTick: 1_200,
    kwuarmPotency: 4,
    cinderbane: true,
    blowpipe: false,
    laniakea: false,
  };
  const league = leagueEnabled
    ? equilibriumLeague(LEAGUE_LIGHT_PICKS, {
        totalArmour: 2_400,
        maximumLife: 14_000,
        areaTargets: 8,
        prayerBonus: 60,
        herbloreLevel: 120,
      })
    : undefined;
  return makeRequest({
    style: "ranged",
    seed,
    minBarSize: 6,
    maxBarSize: 6,
    weaponConfiguration: "twohand",
    equipmentIds: ["item:bik-arrows", "item:cinderbane-gloves", "item:am-zi"],
    passiveIds: ["cinderbane-weapon-poison", "am-zi"],
    playerPoison,
    ammo: "bik",
    procs: { cracklingRank: 4 },
    adrenaline: {
      impatientRank: 4,
      impatientLevel20: true,
      relentlessRank: 5,
      relentlessLevel20: true,
    },
    ...(leagueEnabled
      ? {
          ruleset: "equilibrium" as const,
          blessingPicks: LEAGUE_LIGHT_PICKS,
          league,
          context: {
            style: "ranged" as const,
            ruleset: "equilibrium" as const,
            targetSize: 1,
            occupiedTiles: 1,
          },
        }
      : {}),
    durationTicks: 180,
    exploreDurationTicks: 45,
    authoredSeedBars: [
      seedBar("league-light", [
        "ranged_attack",
        "greater_ricochet",
        "piercing_shot",
        "corruption_shot",
        "rapid_fire",
        "snap_shot",
      ]),
    ],
  });
}

function leagueAoeRequest(seed: number, leagueEnabled: boolean): SerializableSolverRequest {
  const league = leagueEnabled
    ? equilibriumLeague(LEAGUE_AOE_PICKS, {
        totalArmour: 2_400,
        maximumLife: 14_000,
        targetSize: 5,
        occupiedTiles: 25,
        areaTargets: 9,
      })
    : undefined;
  return makeRequest({
    style: "magic",
    seed,
    minBarSize: 6,
    maxBarSize: 6,
    weaponConfiguration: "dualwield",
    equipmentIds: [
      "item:tumekens-resplendence-helm",
      "item:tumekens-resplendence-body",
      "item:tumekens-resplendence-legs",
      "item:tumekens-resplendence-gloves",
      "item:tumekens-resplendence-boots",
      "item:igneous-kal-mej",
    ],
    passiveIds: ["igneous-omnipower"],
    tumekensPieces: 5,
    tumekensCritEnabled: true,
    procs: { cracklingRank: 4 },
    ...(leagueEnabled
      ? {
          ruleset: "equilibrium" as const,
          blessingPicks: LEAGUE_AOE_PICKS,
          league,
          context: {
            style: "magic" as const,
            ruleset: "equilibrium" as const,
            targetSize: 5,
            occupiedTiles: 25,
          },
        }
      : {
          context: {
            style: "magic" as const,
            ruleset: "base" as const,
            targetSize: 5,
            occupiedTiles: 25,
          },
        }),
    durationTicks: 180,
    exploreDurationTicks: 45,
    includePartial: true,
    authoredSeedBars: [
      seedBar("league-aoe", [
        "dragon_breath",
        "greater_chain",
        "combust",
        "corruption_blast",
        "magma_tempest",
        "omnipower",
      ]),
    ],
  });
}

function leagueNecroRequest(seed: number, leagueEnabled: boolean): SerializableSolverRequest {
  const league = leagueEnabled
    ? equilibriumLeague(LEAGUE_NECRO_PICKS, { targetSize: 2, occupiedTiles: 4 })
    : undefined;
  return makeRequest({
    style: "necromancy",
    seed,
    minBarSize: 6,
    maxBarSize: 6,
    weaponConfiguration: "necromancy",
    equipmentIds: [
      "item:omni-guard",
      "item:soulbound-lantern",
      "item:first-necromancer-helm",
      "item:first-necromancer-body",
      "item:first-necromancer-legs",
      "item:first-necromancer-gloves",
      "item:first-necromancer-boots",
    ],
    conjureBasicDamageMult: 1.12,
    conjureDurationMult: 1.25,
    includePartial: true,
    adrenaline: {
      impatientRank: 4,
      impatientLevel20: true,
      relentlessRank: 5,
      relentlessLevel20: true,
    },
    ...(leagueEnabled
      ? {
          ruleset: "equilibrium" as const,
          blessingPicks: LEAGUE_NECRO_PICKS,
          league,
          context: {
            style: "necromancy" as const,
            ruleset: "equilibrium" as const,
            targetSize: 2,
            occupiedTiles: 4,
          },
        }
      : {
          context: {
            style: "necromancy" as const,
            ruleset: "base" as const,
            targetSize: 2,
            occupiedTiles: 4,
          },
        }),
    durationTicks: 100,
    exploreDurationTicks: 30,
    authoredSeedBars: [
      seedBar("league-necro", [
        "conjure_skeleton_warrior",
        "conjure_vengeful_ghost",
        "conjure_putrid_zombie",
        "touch_of_death",
        "soul_sap",
        "finger_of_death",
      ]),
    ],
  });
}

export const BENCH_CASES: readonly BenchCaseDef[] = [
  {
    id: "melee-2h-4slot",
    quick: true,
    seed: 101,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 101,
        minBarSize: 4,
        maxBarSize: 4,
        weaponConfiguration: "twohand",
      }),
  },
  {
    id: "melee-dw-4to6",
    quick: false,
    seed: 102,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 102,
        minBarSize: 4,
        maxBarSize: 6,
        weaponConfiguration: "dualwield",
      }),
  },
  {
    id: "ranged-6slot",
    quick: false,
    seed: 103,
    build: () =>
      makeRequest({
        style: "ranged",
        seed: 103,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "twohand",
      }),
  },
  {
    id: "magic-6slot",
    quick: false,
    seed: 104,
    build: () =>
      makeRequest({
        style: "magic",
        seed: 104,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "dualwield",
      }),
  },
  {
    id: "necro-6slot",
    quick: false,
    seed: 105,
    build: () =>
      makeRequest({
        style: "necromancy",
        seed: 105,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "necromancy",
      }),
  },
  {
    id: "leng-icy-context",
    quick: true,
    seed: 106,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 106,
        minBarSize: 4,
        maxBarSize: 4,
        weaponConfiguration: "dualwield",
        equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
        passiveIds: ["leng-endless-frost", "leng-boundless-chill"],
      }),
  },
  {
    id: "igneous-context",
    quick: true,
    seed: 107,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 107,
        minBarSize: 4,
        maxBarSize: 4,
        weaponConfiguration: "twohand",
        equipmentIds: ["item:igneous-kal-ket"],
        passiveIds: ["igneous-overpower"],
      }),
  },
  {
    id: "four-slot-fixed",
    quick: true,
    seed: 108,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 108,
        minBarSize: 4,
        maxBarSize: 4,
        weaponConfiguration: "dualwield",
      }),
  },
  {
    id: "six-slot-fixed",
    quick: false,
    seed: 109,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 109,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "dualwield",
      }),
  },
  {
    id: "eight-slot-search",
    quick: false,
    seed: 110,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 110,
        minBarSize: 5,
        maxBarSize: 8,
        weaponConfiguration: "dualwield",
        durationTicks: 80,
        exploreDurationTicks: 30,
      }),
  },
  {
    id: "ten-slot-search",
    quick: false,
    seed: 111,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 111,
        minBarSize: 5,
        maxBarSize: 10,
        weaponConfiguration: "dualwield",
        durationTicks: 80,
        exploreDurationTicks: 30,
      }),
  },

  /**
   * 1. Simple no-RNG melee (quick): crit disabled, no adren RNG perks, fixed 4.
   * Deterministic baseline for score fingerprints.
   */
  {
    id: "melee-norng-4slot",
    quick: true,
    seed: 201,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 201,
        minBarSize: 4,
        maxBarSize: 4,
        weaponConfiguration: "twohand",
        crit: { chance: 0, disabled: true, damageBonus: 0 },
      }),
  },

  /**
   * 2. Sunshine magic - engine id `sunshine` (Greater Sunshine is exclusive group peer).
   * Planted Feet extends base Sunshine window; seed steers search toward the ultimate.
   */
  {
    id: "sunshine-magic",
    quick: false,
    seed: 202,
    build: () =>
      makeRequest({
        style: "magic",
        seed: 202,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "dualwield",
        plantedFeet: true,
        durationTicks: 90,
        exploreDurationTicks: 30,
        authoredSeedBars: [
          seedBar("sunshine-core", [
            "sunshine",
            "concentrated_blast",
            "combust",
            "sonic_wave",
            "corruption_blast",
            "asphyxiate",
          ]),
        ],
      }),
  },

  /**
   * 3. Death's Swiftness ranged - engine id `deaths_swiftness`.
   */
  {
    id: "deaths-swiftness-ranged",
    quick: false,
    seed: 203,
    build: () =>
      makeRequest({
        style: "ranged",
        seed: 203,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "twohand",
        plantedFeet: true,
        durationTicks: 90,
        exploreDurationTicks: 30,
        authoredSeedBars: [
          seedBar("ds-core", [
            "deaths_swiftness",
            "rapid_fire",
            "ricochet",
            "corruption_shot",
            "snap_shot",
            "piercing_shot",
          ]),
        ],
      }),
  },

  /**
   * 4. Necromancy conjures - conduit shape + First Necro-style conjure mults.
   * Conjure summons are solver-eligible (Spirit Pact III notes only).
   * Seeds use real engine ids (`conjure_skeleton_warrior`, etc.).
   */
  {
    id: "necro-conjures",
    quick: false,
    seed: 204,
    build: () =>
      makeRequest({
        style: "necromancy",
        seed: 204,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "necromancy",
        conjureBasicDamageMult: 1.12,
        conjureDurationMult: 1.1,
        durationTicks: 90,
        exploreDurationTicks: 30,
        authoredSeedBars: [
          seedBar("conjure-core", [
            "conjure_skeleton_warrior",
            "conjure_vengeful_ghost",
            "conjure_putrid_zombie",
            "touch_of_death",
            "soul_sap",
            "finger_of_death",
          ]),
        ],
      }),
  },

  /**
   * 5. Impatient + Relentless - state-changing adren RNG (branched in sim).
   * Short horizon; full suite only (branch cost).
   */
  {
    id: "impatient-relentless",
    quick: false,
    seed: 205,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 205,
        minBarSize: 4,
        maxBarSize: 6,
        weaponConfiguration: "dualwield",
        adrenaline: {
          impatientRank: 4,
          impatientLevel20: true,
          relentlessRank: 5,
          relentlessLevel20: true,
        },
        durationTicks: 50,
        exploreDurationTicks: 24,
      }),
  },

  /**
   * 6. Equipment procs - Crackling / Aftershock invention procs (deterministic land path).
   */
  {
    id: "equipment-procs",
    quick: true,
    seed: 206,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 206,
        minBarSize: 4,
        maxBarSize: 4,
        weaponConfiguration: "dualwield",
        procs: { cracklingRank: 4, aftershockRank: 4 },
        preciseRank: 5,
      }),
  },

  /** League Leng build: valid path history plus global and Leng state RNG. */
  {
    id: "league-blessings",
    quick: false,
    seed: 207,
    build: () => leagueLengRequest(207, true),
  },
  {
    id: "league-blessings-control",
    quick: false,
    seed: 207,
    build: () => leagueLengRequest(207, false),
  },
  {
    id: "league-poison-melee",
    quick: false,
    seed: 218,
    build: () => leaguePoisonRequest(218, true),
  },
  {
    id: "league-poison-melee-control",
    quick: false,
    seed: 218,
    build: () => leaguePoisonRequest(218, false),
  },
  {
    id: "league-poison-melee-aftershock",
    quick: false,
    seed: 219,
    build: () => leaguePoisonRequest(219, true, true),
  },
  {
    id: "league-avernic-delta",
    quick: false,
    seed: 223,
    build: () => leagueAvernicRequest(223, true),
  },
  {
    id: "league-avernic-delta-control",
    quick: false,
    seed: 223,
    build: () => leagueAvernicRequest(223, false),
  },
  {
    id: "league-necro-conjures",
    quick: false,
    seed: 220,
    build: () => leagueNecroRequest(220, true),
  },
  {
    id: "league-necro-conjures-control",
    quick: false,
    seed: 220,
    build: () => leagueNecroRequest(220, false),
  },
  {
    id: "league-light-ranged",
    quick: false,
    seed: 221,
    build: () => leagueLightRequest(221, true),
  },
  {
    id: "league-light-ranged-control",
    quick: false,
    seed: 221,
    build: () => leagueLightRequest(221, false),
  },
  {
    id: "league-aoe-magic",
    quick: false,
    seed: 222,
    build: () => leagueAoeRequest(222, true),
  },
  {
    id: "league-aoe-magic-control",
    quick: false,
    seed: 222,
    build: () => leagueAoeRequest(222, false),
  },

  /**
   * Long 300s unhinged - full mode only. Canonical research horizon (500 ticks).
   * Production unhinged budgets apply via solveFromRequest; do not mark quick.
   */
  {
    id: "unhinged-300s",
    quick: false,
    seed: 208,
    build: () =>
      makeRequest({
        style: "melee",
        seed: 208,
        minBarSize: 6,
        maxBarSize: 8,
        weaponConfiguration: "dualwield",
        tier: "unhinged",
        durationTicks: OBJECTIVE_HORIZON_TICKS,
        exploreDurationTicks: 60,
      }),
  },
];

export function caseById(id: BenchCaseId): BenchCaseDef {
  const c = BENCH_CASES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown bench case: ${id}`);
  return c;
}

export function quickCases(): readonly BenchCaseDef[] {
  return BENCH_CASES.filter((c) => c.quick);
}

export function allCases(): readonly BenchCaseDef[] {
  return BENCH_CASES;
}
