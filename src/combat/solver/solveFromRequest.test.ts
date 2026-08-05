import { describe, expect, it } from "vitest";
import { EQUIPMENT_SET_ACTIVATION, type ActiveEquipmentEffects } from "../shared/equipment";
import { resolveLeagueRules } from "../league/ruleset";
import { REGION_IDS } from "@/league";
import {
  emptyModifierSources,
  defaultSerializableRequest,
  type SerializableRevolutionSimBase,
} from "./worker/serializable";
import { reviveLeague, reviveModifiers, serializeLeague } from "./worker/revive";
import { solveFromRequest } from "./solveFromRequest";
import { evaluateRevolutionBar } from "./evaluate";
import { buildCandidatePool } from "./candidatePool";
import { allEngineSpecs } from "../abilities/registry";
import { fingerprintSolveContext, solveContextPayload } from "./solutionStore";

const emptyEffects: ActiveEquipmentEffects = {
  activation: EQUIPMENT_SET_ACTIVATION,
  passiveIds: [],
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
};

/** Naked base-ruleset request - the path that already greened in CI. */
function nakedRequest() {
  return defaultSerializableRequest({
    style: "melee",
    durationTicks: 500,
    exploreDurationTicks: 40,
    tier: "thorough",
    profileId: "balanced",
    seed: 7,
    minBarSize: 3,
    maxBarSize: 6,
    unlockedRegions: ["misthalin", "havenhythe", "karamja"],
    loadout: {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      equipmentEffects: emptyEffects,
      league: {
        ruleset: "base",
        blessings: [],
        blessingIds: [],
        totalArmour: 0,
        maximumLife: 10_000,
        powerburstUntilTick: 0,
        targetTiles: 1,
      },
      equipmentIds: [],
      weaponConfiguration: "dualwield",
      startingAdrenaline: 100,
      modifierSources: emptyModifierSources(),
    },
  });
}

/**
 * UI-shaped equilibrium loadout: blessings, vulnerability, curse, perks, multi-region
 * pool, product min bar size. This is the path that freezes/fails when naked still works.
 */
function complicatedRequest() {
  // Balance→Chaos→Chaos grants big-boned, abyssal-cinders, avernic-rampage (state-branching).
  const blessingPicks = [
    "Balance",
    "Chaos",
    "Chaos",
    "Order",
    "Order",
    "Chaos",
    "Balance",
    "Order",
  ] as const;

  const leagueLive = resolveLeagueRules(
    {
      ruleset: "equilibrium",
      blessingPicks,
    },
    {
      totalArmour: 2_400,
      maximumLife: 15_000,
      powerburstUntilTick: 50,
      targetTiles: 3,
    },
  );

  return defaultSerializableRequest({
    style: "melee",
    durationTicks: 500,
    exploreDurationTicks: 40,
    tier: "thorough",
    profileId: "balanced",
    seed: 11,
    minBarSize: 6,
    maxBarSize: 7,
    ruleset: "equilibrium",
    blessingPicks,
    unlockedRegions: [...REGION_IDS],
    loadout: {
      base: 2_450,
      level: 120,
      accuracy: 0.92,
      crit: { chance: 0.18, damageBonus: 0.05 },
      equipmentEffects: {
        ...emptyEffects,
        passiveIds: [],
        vestments: {
          pieces: 4,
          heraldOfChaos: true,
          berserkExtension: false,
          increasedAdrenalineCap: true,
        },
      },
      league: serializeLeague(leagueLive),
      context: { style: "melee", ruleset: "equilibrium", targetTiles: 3 },
      targetHpPercent: 100,
      cap: { cap: 30_000, bypass: false },
      equipmentIds: ["item:vestments", "item:mainhand", "item:offhand"],
      weaponConfiguration: "dualwield",
      startingAdrenaline: 100,
      // Impatient + Relentless force state-changing RNG branches - the freeze/OOM path.
      adrenaline: {
        abilityGainMultiplier: 1.1,
        basicGainMultiplier: 1,
        impatientRank: 4,
        impatientLevel20: true,
        relentlessRank: 4,
        relentlessLevel20: true,
      },
      procs: { cracklingRank: 4, aftershockRank: 0 },
      plantedFeet: true,
      preciseRank: 5,
      modifierSources: {
        ...emptyModifierSources(),
        vulnerability: true,
        styleCurseId: "turmoil",
        ultimatums: 2,
        lunging: 1,
        slayer: { demon: 1, dragon: 0, undead: 0 },
        target: { demon: true },
        setCounts: [["vestments-of-havoc", 4]],
      },
    },
  });
}

function assertLegalResult(
  result: Awaited<ReturnType<typeof solveFromRequest>>,
  size: { min: number; max: number },
) {
  expect(result.bar.length).toBeGreaterThanOrEqual(size.min);
  expect(result.bar.length).toBeLessThanOrEqual(size.max);
  expect(new Set(result.bar).size).toBe(result.bar.length);
  expect(Number.isFinite(result.score)).toBe(true);
  expect(result.evaluations).toBeGreaterThan(0);
  // Phase 4: successful DTO is validated full-horizon only (builder throws otherwise).
  const applyableProofs = new Set([
    "full-objective-global-optimum",
    "full-shortlist-best",
    "heuristic-best-found",
  ]);
  expect(result.proofLabel && applyableProofs.has(result.proofLabel)).toBe(true);
  expect(result.proofLabel).not.toBe("degraded-exploratory-fallback");
  expect(result.proofLabel).not.toBe("failed");
  expect(result.proofLabel).not.toBe("globally-optimal" as never);
  expect(result.proofLabel).not.toBe("converged" as never);
  expect(result.bar).not.toContain("attack");
  expect(result.bar).not.toContain("runic_charge");
  // Every slot must be a real engine ability id (no blanks).
  for (const id of result.bar) {
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  }
}

describe("solveFromRequest", () => {
  it("returns a legal bar under naked base rules (simple path)", async () => {
    const result = await solveFromRequest(nakedRequest());
    assertLegalResult(result, { min: 3, max: 6 });
  }, 120_000);

  it("structuredClone round-trips a blessing-heavy request (worker wire)", () => {
    const request = complicatedRequest();
    const loadout = request.loadout as SerializableRevolutionSimBase;
    expect(loadout.league.blessingIds.length).toBeGreaterThan(0);
    expect(loadout.league.blessingIds).toContain("big-boned");
    expect(loadout.league.blessingIds).toContain("avernic-rampage");
    expect(loadout.league.ruleset).toBe("equilibrium");

    const cloned = structuredClone(request);
    const clonedLoadout = cloned.loadout as SerializableRevolutionSimBase;
    expect(clonedLoadout.league.blessingIds).toEqual(loadout.league.blessingIds);
    expect(clonedLoadout.league.powerburstUntilTick).toBe(50);
    expect(clonedLoadout.modifierSources.vulnerability).toBe(true);
    expect(clonedLoadout.modifierSources.styleCurseId).toBe("turmoil");
    // No functions / Maps leaked onto the wire shape.
    expect(typeof (clonedLoadout.league.blessingIds as unknown as { has?: unknown }).has).toBe(
      "undefined",
    );
  });

  function buildComplicatedBarAndSim(request: ReturnType<typeof complicatedRequest>) {
    const simBase = request.loadout as SerializableRevolutionSimBase;
    const pool = buildCandidatePool(allEngineSpecs(), "melee", {
      deny: [],
      weaponConfiguration: simBase.weaponConfiguration,
      equipmentIds: simBase.equipmentIds,
    });
    const bar: string[] = [];
    for (const id of pool.ids) {
      if (bar.length >= 6) break;
      if (bar.includes(id)) continue;
      bar.push(id);
    }
    const league = reviveLeague(simBase.league);
    const sim = {
      base: simBase.base,
      level: simBase.level,
      accuracy: simBase.accuracy,
      crit: simBase.crit,
      abilities: allEngineSpecs(),
      equipmentIds: simBase.equipmentIds,
      weaponConfiguration: simBase.weaponConfiguration,
      startingAdrenaline: simBase.startingAdrenaline,
      adrenaline: simBase.adrenaline,
      procs: simBase.procs,
      plantedFeet: simBase.plantedFeet,
      preciseRank: simBase.preciseRank,
      equipmentEffects: simBase.equipmentEffects,
      league,
      context: simBase.context,
      targetHpPercent: simBase.targetHpPercent,
      cap: simBase.cap,
      modifiers: reviveModifiers(simBase.modifierSources, league),
    };
    return { simBase, pool, bar, league, sim };
  }

  it("evaluates explore + full horizons under complicated league without NaN/hang", () => {
    const request = complicatedRequest();
    const { pool, bar, league, sim } = buildComplicatedBarAndSim(request);
    expect(bar.length).toBe(6);
    expect(league.blessingIds).toBeInstanceOf(Set);
    expect(league.blessingIds.has("big-boned")).toBe(true);
    expect(league.blessingIds.has("avernic-rampage")).toBe(true);

    const explore = evaluateRevolutionBar({
      bar,
      style: "melee",
      durationTicks: 50,
      pool,
      sim,
      profileId: "balanced",
      size: { min: 6, max: 7 },
    });
    // Prefer ok; exclusive groups may reject an arbitrary 6-pack - still must not hang/NaN.
    if (explore.ok) {
      expect(Number.isFinite(explore.score)).toBe(true);
    } else {
      expect(explore.reasons.length).toBeGreaterThan(0);
    }

    // Full-horizon unit (branch cap must keep Avernic/Impatient/Relentless bounded).
    const full = evaluateRevolutionBar({
      bar,
      style: "melee",
      durationTicks: 500,
      pool,
      sim,
      profileId: "balanced",
      size: { min: 6, max: 7 },
    });
    if (full.ok) {
      expect(Number.isFinite(full.score)).toBe(true);
      expect(full.score).not.toBe(Number.POSITIVE_INFINITY);
    } else {
      expect(full.reasons.length).toBeGreaterThan(0);
    }
  }, 60_000);

  it("hashes complicated wire payloads stably for the solve cache", async () => {
    const a = complicatedRequest();
    const b = structuredClone(a);
    const ha = await fingerprintSolveContext(a);
    const hb = await fingerprintSolveContext(b);
    expect(ha).toBe(hb);
    expect(ha).toMatch(/^[0-9a-f]{64}$/);
    // Exact frozen remaining ticks are part of identity (boolean collapse removed).
    const payload = solveContextPayload(a);
    expect(payload.includes("powerburstUntilTick")).toBe(true);
    expect(payload.includes("powerburstActive")).toBe(false);
  });
});
