/**
 * Deterministic solver benchmark cases.
 * Minimal serializable requests using engine loadout packing shapes (not UI loadouts).
 */
import { EQUIPMENT_SET_ACTIVATION, type ActiveEquipmentEffects } from "../../shared/equipment";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
} from "../worker/serializable";
import type { CombatStyle } from "../../types";

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
  | "ten-slot-search";

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
}): SerializableRevolutionSimBase {
  return {
    base: 1200,
    level: 99,
    accuracy: 1,
    crit: { chance: 0.1, damageBonus: 0 },
    equipmentEffects: emptyEffects(opts.passiveIds ?? []),
    league: {
      ruleset: "base",
      blessings: [],
      blessingIds: [],
      totalArmour: 0,
      maximumLife: 10_000,
      powerburstUntilTick: 0,
      targetTiles: 1,
    },
    context: { style: opts.style, ruleset: "base", targetTiles: 1 },
    equipmentIds: [...(opts.equipmentIds ?? [])],
    weaponConfiguration: opts.weaponConfiguration,
    startingAdrenaline: 100,
    modifierSources: emptyModifierSources(),
  };
}

/**
 * Bench requests always use thorough tier on the wire (only real SearchTier).
 * Quick mode overrides evaluationBudget in the runner — not the request tier field.
 */
function makeRequest(opts: {
  style: CombatStyle;
  seed: number;
  minBarSize: number;
  maxBarSize: number;
  weaponConfiguration: WeaponConfig;
  equipmentIds?: readonly string[];
  passiveIds?: readonly string[];
  /** Short horizons keep real evals cheap in CI. */
  durationTicks?: number;
  exploreDurationTicks?: number;
}): SerializableSolverRequest {
  return defaultSerializableRequest({
    style: opts.style,
    seed: opts.seed,
    tier: "thorough",
    profileId: "balanced",
    minBarSize: opts.minBarSize,
    maxBarSize: opts.maxBarSize,
    durationTicks: opts.durationTicks ?? 50,
    exploreDurationTicks: opts.exploreDurationTicks ?? 24,
    unlockedRegions: ["misthalin", "havenhythe", "karamja", "asgarnia"],
    includeUnknownAvailability: true,
    loadout: baseLoadout({
      style: opts.style,
      weaponConfiguration: opts.weaponConfiguration,
      equipmentIds: opts.equipmentIds,
      passiveIds: opts.passiveIds,
    }),
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
