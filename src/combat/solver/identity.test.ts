import { beforeEach, describe, expect, it } from "vitest";
import {
  canonicalEvaluationContext,
  canonicalNormalizedIdentity,
  canonicalSolveContext,
  isVerifiedCacheableResult,
  resultMatchesRequestIdentity,
  SEARCH_POLICY_VERSION,
  solveIdentityFromRequest,
} from "./identity";
import {
  fingerprintSolveContext,
  lookupSolvedBar,
  rememberSolvedBar,
  resetSolveCacheForTests,
  solveContextPayload,
} from "./solutionStore";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  isSerializableSimBase,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./worker/serializable";
import { activeEquipmentEffects, type ActiveEquipmentEffects } from "../shared/equipment";
import { stableStringify } from "./fingerprint";

/** Minimal localStorage so rememberSolvedBar / lookupSolvedBar work under node vitest. */
function installMemoryLocalStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { window?: { localStorage: typeof storage } }).window = {
    localStorage: storage,
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

installMemoryLocalStorage();

const emptyEffects: ActiveEquipmentEffects = {
  activation: "pre-activated-static-loadout",
  setCritChance: { unconditional: 0, conditional: {} },
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

function baseLoadout(
  overrides: Partial<SerializableRevolutionSimBase> = {},
): SerializableRevolutionSimBase {
  return {
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
      targetSize: 1,
      occupiedTiles: 1,
    },
    equipmentIds: ["abyssal_whip"],
    weaponConfiguration: "dualwield",
    startingAdrenaline: 100,
    modifierSources: emptyModifierSources(),
    ...overrides,
  };
}

function sampleRequest(
  overrides: Partial<SerializableSolverRequest> = {},
  loadoutOverrides: Partial<SerializableRevolutionSimBase> = {},
): SerializableSolverRequest {
  return defaultSerializableRequest({
    style: "melee",
    durationTicks: 500,
    minBarSize: 6,
    maxBarSize: 10,
    tier: "thorough",
    profileId: "balanced",
    seed: 1,
    unlockedRegions: ["misthalin", "karamja"],
    loadout: baseLoadout(loadoutOverrides),
    ...overrides,
  });
}

function withSim(
  request: SerializableSolverRequest,
  patch: (sim: SerializableRevolutionSimBase) => SerializableRevolutionSimBase,
): SerializableSolverRequest {
  if (!isSerializableSimBase(request.loadout)) throw new Error("expected sim base");
  return { ...request, loadout: patch(request.loadout) };
}

/** Cache-path DTO: stamps real solveIdentity from request unless overridden. */
function verifiedDto(
  request: SerializableSolverRequest,
  overrides: Partial<SolverResultDTO> = {},
): SolverResultDTO {
  return {
    bar: ["a", "b", "c", "d", "e", "f"],
    score: 12_000,
    windowDpms: 0,
    evaluations: 100,
    uniqueCandidates: 40,
    seed: 1,
    profileId: "balanced",
    tier: "thorough",
    durationTicks: 500,
    solveIdentity: solveIdentityFromRequest(request),
    proofLabel: "heuristic-best-found",
    bestFullScore: 12_000,
    proof: { label: "heuristic-best-found" },
    top: [],
    ...overrides,
  };
}

describe("canonical identity", () => {
  it("identical requests share the same solve fingerprint", async () => {
    const a = sampleRequest();
    const b = sampleRequest();
    expect(await fingerprintSolveContext(a)).toBe(await fingerprintSolveContext(b));
    expect(await fingerprintSolveContext(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("includes SEARCH_POLICY_VERSION and schema/objective versions in solve context", () => {
    const payload = solveContextPayload(sampleRequest());
    expect(payload).toContain(`"searchPolicyVersion":${SEARCH_POLICY_VERSION}`);
    expect(SEARCH_POLICY_VERSION).toBe(2);
    expect(payload).toContain('"searchPolicyVersion":2');
    expect(payload).toContain('"schema":');
    expect(payload).toContain('"objectiveVersion":');
  });

  it("canonicalSimulationIdentity includes normalized overrideBase and overrideLevel", () => {
    const withOverride = sampleRequest({}, { overrideBase: 2400.1234, overrideLevel: 255 });
    const without = sampleRequest();
    const simWith = canonicalNormalizedIdentity(withOverride).simulation as {
      overrideBase: number | null;
      overrideLevel: number | null;
    };
    const simWithout = canonicalNormalizedIdentity(without).simulation as {
      overrideBase: number | null;
      overrideLevel: number | null;
    };
    expect(simWith.overrideBase).toBe(2400.123);
    expect(simWith.overrideLevel).toBe(255);
    expect(simWithout.overrideBase).toBeNull();
    expect(simWithout.overrideLevel).toBeNull();
    expect(stableStringify(simWith)).not.toBe(stableStringify(simWithout));
  });

  it("evaluation identity omits seed/tier/search policy but includes simulation", () => {
    const req = sampleRequest({ seed: 99, tier: "extreme" });
    const evalCtx = stableStringify(canonicalEvaluationContext(req));
    const solveCtx = stableStringify(canonicalSolveContext(req));
    expect(evalCtx).not.toContain("searchPolicyVersion");
    expect(evalCtx).not.toContain('"seed"');
    expect(evalCtx).not.toContain('"tier"');
    expect(solveCtx).toContain("searchPolicyVersion");
    expect(solveCtx).toContain('"seed":99');
    expect(solveCtx).toContain('"tier":"extreme"');
    // Shared simulation fields present in both.
    expect(evalCtx).toContain("startingAdrenaline");
    expect(solveCtx).toContain("startingAdrenaline");
  });

  it("canonicalNormalizedIdentity exposes objective/simulation/solveJob/evaluation", () => {
    const id = canonicalNormalizedIdentity(sampleRequest());
    expect(id).toHaveProperty("objective");
    expect(id).toHaveProperty("simulation");
    expect(id).toHaveProperty("solveJob");
    expect(id).toHaveProperty("evaluation");
  });
});

describe("fingerprint changes one field at a time", () => {
  async function expectDiff(
    label: string,
    mutate: (r: SerializableSolverRequest) => SerializableSolverRequest,
  ) {
    const base = sampleRequest();
    const changed = mutate(structuredClone(base));
    const ha = await fingerprintSolveContext(base);
    const hb = await fingerprintSolveContext(changed);
    expect(ha, label).not.toBe(hb);
  }

  it("starting adrenaline", async () => {
    await expectDiff("startingAdrenaline", (r) =>
      withSim(r, (s) => ({ ...s, startingAdrenaline: 50 })),
    );
  });

  it("Dracolich resolved effects", async () => {
    await expectDiff("Dracolich", (r) =>
      withSim(r, (s) => ({
        ...s,
        equipmentIds: ["item:noxious-longbow", "item:dracolich-body"],
        equipmentEffects: activeEquipmentEffects({
          style: "ranged",
          equipmentSlots: {
            twohand: "item:noxious-longbow",
            body: "item:dracolich-body",
          },
          pieceContribution: { additionalPiecesPerItem: 2 },
        }),
      })),
    );
  });

  it.each([
    ["naturalInstinctUntilTick", { naturalInstinctUntilTick: 20 }],
    ["startingResidualSouls", { startingResidualSouls: 3 }],
    ["slayerOnTask", { slayerOnTask: true }],
    ["slayerLevel", { slayerLevel: 120 }],
  ] as const)("%s", async (label, field) => {
    await expectDiff(label, (r) => withSim(r, (s) => ({ ...s, ...field })));
  });

  it("Crackling", async () => {
    await expectDiff("crackling", (r) =>
      withSim(r, (s) => ({ ...s, procs: { ...(s.procs ?? {}), cracklingRank: 4 } })),
    );
  });

  it("Aftershock", async () => {
    await expectDiff("aftershock", (r) =>
      withSim(r, (s) => ({ ...s, procs: { ...(s.procs ?? {}), aftershockRank: 4 } })),
    );
  });

  it("Precise", async () => {
    await expectDiff("precise", (r) => withSim(r, (s) => ({ ...s, preciseRank: 5 })));
  });

  it("hit cap", async () => {
    await expectDiff("hitCap", (r) => withSim(r, (s) => ({ ...s, cap: { cap: 15_000 } })));
  });

  it("target HP", async () => {
    await expectDiff("targetHp", (r) => withSim(r, (s) => ({ ...s, targetHpPercent: 25 })));
  });

  it("Lord of Light scenario inputs", async () => {
    await expectDiff("areaTargets", (r) =>
      withSim(r, (s) => ({
        ...s,
        league: { ...s.league, areaTargets: (s.league.areaTargets ?? 1) + 1 },
      })),
    );
    await expectDiff("prayerBonus", (r) =>
      withSim(r, (s) => ({
        ...s,
        league: { ...s.league, prayerBonus: (s.league.prayerBonus ?? 0) + 1 },
      })),
    );
  });

  it("every player poison input", async () => {
    const off = {
      potion: "none" as const,
      potionUntilTick: 0,
      kwuarmPotency: 0 as const,
      cinderbane: false,
      blowpipe: false,
      laniakea: false,
    };
    const changes = [
      { potion: "weapon" as const },
      { potionUntilTick: 250 },
      { kwuarmPotency: 4 as const },
      { cinderbane: true },
      { blowpipe: true },
      { laniakea: true },
    ];
    for (const change of changes) {
      await expectDiff(Object.keys(change)[0]!, (request) =>
        withSim(request, (sim) => ({
          ...sim,
          playerPoison: { ...off, ...change },
        })),
      );
    }
    await expectDiff("bik", (request) => withSim(request, (sim) => ({ ...sim, ammo: "bik" })));
    await expectDiff("targetPoisonImmune", (request) =>
      withSim(request, (sim) => ({ ...sim, targetPoisonImmune: true })),
    );
  });

  it("Herblore level", async () => {
    await expectDiff("herbloreLevel", (request) =>
      withSim(request, (sim) => ({
        ...sim,
        league: { ...sim.league, herbloreLevel: 120 },
      })),
    );
  });

  it("absent target HP differs from explicit 100%", async () => {
    await expectDiff("targetHpAbsent", (r) => withSim(r, (s) => ({ ...s, targetHpPercent: 100 })));
  });

  it("target classification", async () => {
    await expectDiff("targetClass", (r) =>
      withSim(r, (s) => ({
        ...s,
        modifierSources: {
          ...s.modifierSources,
          target: { ...s.modifierSources.target, demon: true },
        },
      })),
    );
  });

  it("blessings", async () => {
    await expectDiff("blessings", (r) =>
      withSim(r, (s) => ({
        ...s,
        league: {
          ...s.league,
          blessingIds: ["big-boned"],
        },
      })),
    );
  });

  it("league relics", async () => {
    await expectDiff("relics", (r) =>
      withSim(r, (s) => ({
        ...s,
        league: { ...s.league, relics: ["Naragi Edict"] },
      })),
    );
  });

  it("ordered user bar", async () => {
    await expectDiff("userBar", (r) => ({ ...r, userBar: ["fury", "assault"] }));
    const a = sampleRequest({ userBar: ["fury", "assault"] });
    const b = sampleRequest({ userBar: ["assault", "fury"] });
    expect(await fingerprintSolveContext(a)).not.toBe(await fingerprintSolveContext(b));
    expect(stableStringify(canonicalEvaluationContext(a))).toBe(
      stableStringify(canonicalEvaluationContext(b)),
    );
  });

  it("Powerburst remaining ticks (exact — not boolean)", async () => {
    const a = withSim(sampleRequest(), (s) => ({
      ...s,
      league: { ...s.league, powerburstUntilTick: 10 },
    }));
    const b = withSim(sampleRequest(), (s) => ({
      ...s,
      league: { ...s.league, powerburstUntilTick: 3 },
    }));
    const off = withSim(sampleRequest(), (s) => ({
      ...s,
      league: { ...s.league, powerburstUntilTick: 0 },
    }));
    expect(await fingerprintSolveContext(a)).not.toBe(await fingerprintSolveContext(b));
    expect(await fingerprintSolveContext(a)).not.toBe(await fingerprintSolveContext(off));
    const payload = solveContextPayload(a);
    expect(payload).toContain('"powerburstUntilTick":10');
    expect(payload).not.toContain("powerburstActive");
  });

  it("conjure multipliers", async () => {
    await expectDiff("conjureBasic", (r) =>
      withSim(r, (s) => ({ ...s, conjureBasicDamageMult: 1.12 })),
    );
    await expectDiff("conjureDuration", (r) =>
      withSim(r, (s) => ({ ...s, conjureDurationMult: 1.2 })),
    );
  });

  it("custom objective weights", async () => {
    await expectDiff("customWeights", (r) => ({
      ...r,
      profileId: "custom",
      customWeights: {
        opening: 0.5,
        developed: 0.3,
        steady: 0.2,
        robustMean: 0.7,
        robustMin: 0.3,
      },
    }));
  });

  it("bounds", async () => {
    await expectDiff("bounds", (r) => ({ ...r, minBarSize: 5, maxBarSize: 8 }));
  });

  it("regions", async () => {
    await expectDiff("regions", (r) => ({
      ...r,
      unlockedRegions: ["misthalin", "asgarnia"] as typeof r.unlockedRegions,
    }));
  });

  it("disabled abilities", async () => {
    await expectDiff("disabled", (r) => ({
      ...r,
      disabledAbilityIds: ["slaughter"],
    }));
  });

  it("seed", async () => {
    await expectDiff("seed", (r) => ({ ...r, seed: 42 }));
  });

  it("strength cape", async () => {
    await expectDiff("strengthCape", (r) => withSim(r, (s) => ({ ...s, strengthCape99: true })));
  });

  it("equipment effects beyond vestments pieces", async () => {
    await expectDiff("enchantments", (r) =>
      withSim(r, (s) => ({
        ...s,
        equipmentEffects: {
          ...s.equipmentEffects,
          enchantments: ["agony"],
          passage: { active: true, agonyActive: true },
        },
      })),
    );
  });

  it("resolved set crit payload changes the solver identity", async () => {
    await expectDiff("setCritChance", (r) =>
      withSim(r, (s) => ({
        ...s,
        equipmentEffects: {
          ...s.equipmentEffects,
          setCritChance: { unconditional: 0.03, conditional: { sunshine: 0.045 } },
        },
      })),
    );
  });
});

describe("rememberSolvedBar validation", () => {
  beforeEach(() => {
    resetSolveCacheForTests();
  });

  it("caches verified rankable finals and lookup hits the same identity", async () => {
    const request = sampleRequest();
    const dto = verifiedDto(request);
    const entry = await rememberSolvedBar(request, dto);
    expect(entry).not.toBeNull();
    expect(entry!.bar).toEqual(dto.bar);
    const key = await fingerprintSolveContext(request);
    expect(lookupSolvedBar(key)?.score).toBe(12_000);
  });

  it("does not cache exploratory-only / stopped / failed results", async () => {
    const request = sampleRequest();
    for (const proof of [
      "degraded-exploratory-fallback",
      "stopped-early",
      "failed",
      "budget-not-exhausted",
      "search-objective-exhaustive",
    ] as const) {
      const entry = await rememberSolvedBar(
        request,
        verifiedDto(request, {
          proofLabel: proof,
          proof: { label: proof },
          bestFullScore: undefined,
        }),
      );
      expect(entry, proof).toBeNull();
    }
    expect(lookupSolvedBar(await fingerprintSolveContext(request))).toBeNull();
  });

  it("does not cache non-finite scores", async () => {
    const request = sampleRequest();
    expect(
      await rememberSolvedBar(request, verifiedDto(request, { score: Number.NaN })),
    ).toBeNull();
    expect(
      await rememberSolvedBar(request, verifiedDto(request, { score: Number.POSITIVE_INFINITY })),
    ).toBeNull();
  });

  it("does not cache bars outside exact request bounds", async () => {
    const request = sampleRequest({ minBarSize: 6, maxBarSize: 8 });
    // Too short for request min (even if >= product floor).
    expect(
      await rememberSolvedBar(request, verifiedDto(request, { bar: ["a", "b", "c", "d", "e"] })),
    ).toBeNull();
    // Too long for request max.
    expect(
      await rememberSolvedBar(
        request,
        verifiedDto(request, {
          bar: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
        }),
      ),
    ).toBeNull();
  });

  it("changed context does not false-hit a stored entry", async () => {
    const request = sampleRequest();
    await rememberSolvedBar(request, verifiedDto(request));
    const other = withSim(request, (s) => ({ ...s, startingAdrenaline: 0 }));
    const otherKey = await fingerprintSolveContext(other);
    expect(lookupSolvedBar(otherKey)).toBeNull();
    // Original still hits.
    expect(lookupSolvedBar(await fingerprintSolveContext(request))).not.toBeNull();
  });

  it("isVerifiedCacheableResult mirrors rememberSolvedBar gates", () => {
    const request = sampleRequest();
    expect(isVerifiedCacheableResult(request, verifiedDto(request))).toBe(true);
    expect(
      isVerifiedCacheableResult(
        request,
        verifiedDto(request, {
          proofLabel: "stopped-early",
          proof: { label: "stopped-early" },
        }),
      ),
    ).toBe(false);
    expect(isVerifiedCacheableResult(request, verifiedDto(request, { bar: ["a", "b"] }))).toBe(
      false,
    );
  });

  it("empty solveIdentity is not cacheable", async () => {
    const request = sampleRequest();
    const empty = verifiedDto(request, { solveIdentity: "" });
    expect(isVerifiedCacheableResult(request, empty)).toBe(false);
    expect(await rememberSolvedBar(request, empty)).toBeNull();
  });

  it("rejects stamped solveIdentity that does not match the request", async () => {
    const request = sampleRequest();
    const identity = solveIdentityFromRequest(request);
    expect(solveContextPayload(request)).toBe(identity);
    expect(isVerifiedCacheableResult(request, verifiedDto(request))).toBe(true);
    expect(
      isVerifiedCacheableResult(request, verifiedDto(request, { solveIdentity: identity + "x" })),
    ).toBe(false);
    expect(
      resultMatchesRequestIdentity(
        request,
        verifiedDto(request, { solveIdentity: identity + "x" }),
      ),
    ).toBe(false);
    expect(
      await rememberSolvedBar(request, verifiedDto(request, { solveIdentity: identity + "x" })),
    ).toBeNull();
    expect(await rememberSolvedBar(request, verifiedDto(request))).not.toBeNull();
  });
});

describe("solveIdentity stamp helpers", () => {
  it("solveIdentityFromRequest matches solveContextPayload", () => {
    const request = sampleRequest();
    expect(solveIdentityFromRequest(request)).toBe(solveContextPayload(request));
  });

  it("empty solveIdentity fails match and cache (fail-closed)", () => {
    const request = sampleRequest();
    const empty = verifiedDto(request, { solveIdentity: "" });
    expect(resultMatchesRequestIdentity(request, empty)).toBe(false);
    expect(isVerifiedCacheableResult(request, empty)).toBe(false);
  });
});
