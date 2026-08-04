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
  | "unhinged-300s";

export interface BenchCaseDef {
  id: BenchCaseId;
  /** Include in quick suite (4-slot / tiny-budget only). */
  quick: boolean;
  /** Stable seed for determinism. */
  seed: number;
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
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  crit?: SerializableRevolutionSimBase["crit"];
  league?: SerializableRevolutionSimBase["league"];
  context?: SerializableRevolutionSimBase["context"];
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
      targetTiles: 1,
    },
    context: opts.context ?? { style: opts.style, ruleset, targetTiles: 1 },
    equipmentIds: [...(opts.equipmentIds ?? [])],
    weaponConfiguration: opts.weaponConfiguration,
    startingAdrenaline: 100,
    adrenaline: opts.adrenaline,
    procs: opts.procs,
    plantedFeet: opts.plantedFeet,
    preciseRank: opts.preciseRank,
    conjureBasicDamageMult: opts.conjureBasicDamageMult,
    conjureDurationMult: opts.conjureDurationMult,
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
  conjureBasicDamageMult?: number;
  conjureDurationMult?: number;
  crit?: SerializableRevolutionSimBase["crit"];
  league?: SerializableRevolutionSimBase["league"];
  context?: SerializableRevolutionSimBase["context"];
  ruleset?: "base" | "equilibrium";
  blessingPicks?: readonly BlessingPath[];
  tier?: SearchTier;
  authoredSeedBars?: readonly AuthoredSeedBar[];
  /** Include partially-modeled catalogue abilities (e.g. necromancy conjures). */
  includePartial?: boolean;
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
    unlockedRegions: ["misthalin", "havenhythe", "karamja", "asgarnia"],
    includeUnknownAvailability: true,
    includePartial: opts.includePartial === true,
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
      conjureBasicDamageMult: opts.conjureBasicDamageMult,
      conjureDurationMult: opts.conjureDurationMult,
      crit: opts.crit,
      league: opts.league,
      context: opts.context,
      ruleset,
    }),
  });
}

/** Equilibrium league payload for blessing-context fixtures (deterministic picks). */
function equilibriumLeague(picks: readonly BlessingPath[]) {
  const live = resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: picks },
    {
      totalArmour: 2_000,
      maximumLife: 12_000,
      powerburstUntilTick: 0,
      targetTiles: 1,
    },
  );
  return serializeLeague(live);
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

  // --- Phase 0 representative fixtures ------------------------------------

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
   * Conjures are partially-modeled in the catalogue; includePartial unlocks them.
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
        includePartial: true,
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

  /**
   * 7. League blessings - Equilibrium ruleset with deterministic path picks.
   * Picks Balance→Chaos→Chaos grant big-boned / abyssal-cinders / avernic-rampage
   * (same pattern as solveFromRequest complicated fixture).
   */
  {
    id: "league-blessings",
    quick: false,
    seed: 207,
    build: () => {
      const blessingPicks = [
        "Balance",
        "Chaos",
        "Chaos",
        "Order",
        "Order",
        "Chaos",
        "Balance",
        "Order",
      ] as const satisfies readonly BlessingPath[];
      const league = equilibriumLeague(blessingPicks);
      return makeRequest({
        style: "melee",
        seed: 207,
        minBarSize: 6,
        maxBarSize: 6,
        weaponConfiguration: "dualwield",
        ruleset: "equilibrium",
        blessingPicks,
        league,
        context: { style: "melee", ruleset: "equilibrium", targetTiles: 1 },
        durationTicks: 80,
        exploreDurationTicks: 30,
      });
    },
  },

  /**
   * 8. Long 300s unhinged - full mode only. Canonical research horizon (500 ticks).
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
