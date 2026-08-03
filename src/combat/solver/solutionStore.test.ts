import { describe, expect, it } from "vitest";
import {
  agentBarLength,
  agentBarSizeBounds,
  clampSolverBarSizes,
  fingerprintSolveContext,
  MIN_SOLVER_BAR_SIZE,
  normalizeSolveCache,
  solveContextPayload,
  sha256Hex,
  upsertSolveEntry,
  type CachedSolveEntry,
  type SolveCacheStore,
} from "./solutionStore";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  isSerializableSimBase,
} from "./worker/serializable";
import type { ActiveEquipmentEffects } from "../shared/equipment";

const emptyEffects: ActiveEquipmentEffects = {
  activation: "pre-activated-static-loadout",
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

function sampleRequest(overrides: { equipmentIds?: string[]; style?: "melee" | "magic" } = {}) {
  return defaultSerializableRequest({
    style: overrides.style ?? "melee",
    durationTicks: 500,
    minBarSize: 6,
    maxBarSize: 10,
    tier: "thorough",
    profileId: "balanced",
    unlockedRegions: ["misthalin", "karamja"],
    loadout: {
      base: 1200,
      level: 99,
      accuracy: 0.85,
      crit: { chance: 0.12 },
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
      equipmentIds: overrides.equipmentIds ?? ["abyssal_whip"],
      weaponConfiguration: "dualwield",
      startingAdrenaline: 100,
      modifierSources: emptyModifierSources(),
    },
  });
}

describe("solutionStore", () => {
  it("clamps bar sizes to the product floor (4) and 11-slot hard cap", () => {
    expect(MIN_SOLVER_BAR_SIZE).toBe(4);
    expect(clampSolverBarSizes(3, 10)).toEqual({ minBarSize: 4, maxBarSize: 10 });
    expect(clampSolverBarSizes(8, 7)).toEqual({ minBarSize: 8, maxBarSize: 8 });
    expect(clampSolverBarSizes(undefined, undefined).minBarSize).toBe(MIN_SOLVER_BAR_SIZE);
    expect(clampSolverBarSizes(5, 99)).toEqual({ minBarSize: 5, maxBarSize: 11 });
    expect(clampSolverBarSizes(4, 6)).toEqual({ minBarSize: 4, maxBarSize: 6 });
    expect(clampSolverBarSizes(11, 11)).toEqual({ minBarSize: 11, maxBarSize: 11 });
  });

  it("agent bands honor request min/max (cycle target lengths inside window)", () => {
    expect(agentBarLength(0)).toBe(4);
    expect(agentBarLength(1)).toBe(5);
    expect(agentBarLength(7)).toBe(11);
    expect(agentBarLength(8)).toBe(4); // wraps full product window
    // Fixed 4..4
    expect(agentBarSizeBounds(4, 4, 0, 4)).toEqual({ minBarSize: 4, maxBarSize: 4 });
    expect(agentBarSizeBounds(4, 4, 3, 4)).toEqual({ minBarSize: 4, maxBarSize: 4 });
    // Ranged 5..8
    expect(agentBarSizeBounds(5, 8, 0, 4)).toEqual({ minBarSize: 5, maxBarSize: 5 });
    expect(agentBarSizeBounds(5, 8, 1, 4)).toEqual({ minBarSize: 6, maxBarSize: 6 });
    expect(agentBarSizeBounds(5, 8, 3, 4)).toEqual({ minBarSize: 8, maxBarSize: 8 });
    // Invalid zeros clamp to product defaults then cycle
    expect(agentBarSizeBounds(0, 0, 0, 6).minBarSize).toBeGreaterThanOrEqual(MIN_SOLVER_BAR_SIZE);
  });

  it("fingerprints loadout changes and is stable for the same request", async () => {
    const a = sampleRequest();
    const b = sampleRequest();
    expect(await fingerprintSolveContext(a)).toBe(await fingerprintSolveContext(b));
    const c = sampleRequest({ equipmentIds: ["different_weapon"] });
    expect(await fingerprintSolveContext(c)).not.toBe(await fingerprintSolveContext(a));
    // Compact SHA-256 hex (64 chars).
    expect(await fingerprintSolveContext(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("includes exact powerburst remaining ticks so different durations do not collide", async () => {
    const a = sampleRequest();
    if (!isSerializableSimBase(a.loadout)) throw new Error("expected sim base");
    const b = structuredClone(a);
    if (!isSerializableSimBase(b.loadout)) throw new Error("expected sim base");
    a.loadout = {
      ...a.loadout,
      league: { ...a.loadout.league, powerburstUntilTick: 10 },
    };
    b.loadout = {
      ...b.loadout,
      league: { ...b.loadout.league, powerburstUntilTick: 3 },
    };
    // Exact remaining ticks are part of identity (not collapsed to a boolean).
    expect(await fingerprintSolveContext(a)).not.toBe(await fingerprintSolveContext(b));
    const off = structuredClone(a);
    if (!isSerializableSimBase(off.loadout)) throw new Error("expected sim base");
    off.loadout = {
      ...off.loadout,
      league: { ...off.loadout.league, powerburstUntilTick: 0 },
    };
    expect(await fingerprintSolveContext(off)).not.toBe(await fingerprintSolveContext(a));
  });

  it("sha256Hex is deterministic and compact", async () => {
    const h = await sha256Hex("equilibrium");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex("equilibrium")).toBe(h);
    expect(await sha256Hex("other")).not.toBe(h);
  });

  it("canonical payload is compact and includes exact powerburst remaining ticks", () => {
    const req = sampleRequest();
    const payload = solveContextPayload(req);
    // Payload is stable JSON; the key is only its hash (64 chars), not this string.
    expect(payload.length).toBeLessThan(8_000);
    expect(payload.includes("powerburstUntilTick")).toBe(true);
    expect(payload.includes("powerburstActive")).toBe(false);
  });

  it("normalizes corrupt cache payloads", () => {
    expect(normalizeSolveCache(null).entries).toEqual([]);
    expect(normalizeSolveCache({ version: 2, entries: [{ key: "x" }] }).entries).toEqual([]);
    const ok = normalizeSolveCache({
      version: 2,
      entries: [
        {
          key: "a".repeat(64),
          style: "melee",
          bar: ["a", "b", "c", "d", "e", "f"],
          score: 12_000,
          top: [{ bar: ["a", "b", "c", "d", "e", "g"], score: 11_000 }],
          savedAt: 1,
        },
      ],
    });
    expect(ok.entries).toHaveLength(1);
    expect(ok.entries[0]!.bar).toHaveLength(6);
    expect(ok.entries[0]!.top).toHaveLength(1);
  });

  it("upserts most-recent first", () => {
    const entry = (key: string, style: string, bar: string[]): CachedSolveEntry => ({
      key,
      style,
      profileId: "balanced",
      tier: "thorough",
      minBarSize: 6,
      maxBarSize: 10,
      bar,
      score: 1,
      top: [],
      savedAt: 1,
    });
    let store: SolveCacheStore = { version: 2, entries: [] };
    store = upsertSolveEntry(store, entry("old", "melee", ["1", "2", "3", "4", "5", "6"]));
    store = upsertSolveEntry(store, entry("new", "melee", ["a", "b", "c", "d", "e", "f"]));
    expect(store.entries[0]!.key).toBe("new");
    expect(store.entries.map((e) => e.key)).toEqual(["new", "old"]);
  });
});
