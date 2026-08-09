import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPoolMetrics,
  collectProgressBarKeys,
  mergeProgress,
  mergeResults,
  resolveMergedUnique,
  SolverAgentPool,
  solverPoolSize,
} from "./pool";
import type { SolverProgress } from "./protocol";
import {
  isVerifiedCacheableResult,
  resultMatchesRequestIdentity,
  solveIdentityFromRequest,
} from "../identity";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./serializable";
import type { ActiveEquipmentEffects } from "../../shared/equipment";

afterEach(() => {
  vi.unstubAllGlobals();
});

function progress(
  partial: Partial<SolverProgress> & Pick<SolverProgress, "bestScore">,
): SolverProgress {
  return {
    evaluations: 10,
    uniqueCandidates: 5,
    windowDpms: 0,
    phase: "explore",
    noImprovementCount: 0,
    topBarPreview: ["a"],
    ...partial,
  };
}

describe("mergeProgress dual scores", () => {
  it("takes max exploratory and max full across agents; sums dual evals", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 100,
          bestExploratoryScore: 100,
          bestFullScore: 40,
          searchEvaluations: 8,
          fullEvaluations: 2,
          evaluations: 10,
        }),
        progress({
          bestScore: 80,
          bestExploratoryScore: 80,
          bestFullScore: 55,
          searchEvaluations: 12,
          fullEvaluations: 3,
          evaluations: 15,
          phase: "finalize",
          evaluationMode: "finalize",
        }),
      ],
      2,
      100,
    );
    expect(merged.bestScore).toBe(100);
    expect(merged.bestExploratoryScore).toBe(100);
    expect(merged.bestFullScore).toBe(55);
    expect(merged.searchEvaluations).toBe(20);
    expect(merged.fullEvaluations).toBe(5);
    expect(merged.evaluations).toBe(25);
    // One agent still exploring - do not promote merged phase to finalize.
    expect(merged.phase).toBe("explore");
    // bestScore stays exploratory - never the full robust max.
    expect(merged.bestScore).not.toBe(merged.bestFullScore);
  });

  it("promotes finalize only after every live agent leaves search", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 90,
          phase: "finalize",
          finalizeStep: 2,
          finalizeTotal: 4,
          scoringLabel: "Full-horizon score 2/4",
          scoringBarPreview: ["x"],
          progressRatio: 0.9,
        }),
        progress({
          bestScore: 70,
          phase: "finalize",
          finalizeStep: 1,
          finalizeTotal: 4,
          progressRatio: 0.85,
        }),
      ],
      2,
      100,
    );
    expect(merged.phase).toBe("finalize");
    // Furthest shortlist step wins, not exploratory-score leader.
    expect(merged.finalizeStep).toBe(2);
    expect(merged.finalizeTotal).toBe(4);
    expect(merged.scoringLabel).toBe("Full-horizon score 2/4");
    expect(merged.scoringBarPreview).toEqual(["x"]);
  });

  it("keeps search phase while a peer is still exploring", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 50,
          phase: "finalize",
          finalizeStep: 3,
          finalizeTotal: 4,
          scoringLabel: "should not surface yet",
          progressRatio: 0.95,
        }),
        progress({
          bestScore: 120,
          phase: "explore",
          progressRatio: 0.4,
        }),
      ],
      2,
      100,
    );
    expect(merged.phase).toBe("explore");
    expect(merged.finalizeStep).toBeUndefined();
    expect(merged.scoringLabel).toBeUndefined();
    expect(merged.progressRatio).toBeLessThanOrEqual(0.82);
  });

  it("surfaces the busiest unfinished agent’s active bar for the cycling strip", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 100,
          topBarPreview: ["best-a", "best-b"],
          activeBarPreview: ["old-try"],
          evaluations: 10,
          progressRatio: 0.3,
        }),
        progress({
          bestScore: 40,
          topBarPreview: ["other"],
          activeBarPreview: ["live-1", "live-2"],
          evaluations: 40,
          progressRatio: 0.5,
        }),
      ],
      2,
      100,
    );
    // Best strip stays with the score leader; active follows the busier agent.
    expect(merged.topBarPreview).toEqual(["best-a", "best-b"]);
    expect(merged.activeBarPreview).toEqual(["live-1", "live-2"]);
  });

  it("keeps bestScore exploratory when only bestScore is present", () => {
    const merged = mergeProgress([progress({ bestScore: 12 }), progress({ bestScore: 9 })], 2, 50);
    expect(merged.bestScore).toBe(12);
    expect(merged.bestExploratoryScore).toBe(12);
    expect(merged.bestFullScore).toBeUndefined();
  });

  it("emits one agent snapshot per slot, including empty warmers", () => {
    const merged = mergeProgress(
      [
        progress({
          bestScore: 20,
          bestExploratoryScore: 20,
          evaluations: 5,
          phase: "explore",
          progressRatio: 0.4,
        }),
        undefined,
        progress({
          bestScore: 15,
          evaluations: 3,
          phase: "finalize",
          progressRatio: 1,
        }),
      ],
      3,
      100,
    );
    expect(merged.agents).toHaveLength(3);
    expect(merged.agents?.[0]).toMatchObject({
      index: 0,
      phase: "explore",
      evaluations: 5,
      bestScore: 20,
      finished: false,
    });
    expect(merged.agents?.[1]).toMatchObject({
      index: 1,
      phase: "seed",
      evaluations: 0,
      finished: false,
    });
    expect(merged.agents?.[2]).toMatchObject({
      index: 2,
      phase: "idle",
      finished: true,
    });
  });
});

describe("solverPoolSize", () => {
  it("returns safe global ceiling (6) matching Unhinged max", () => {
    expect(solverPoolSize()).toBe(6);
    vi.stubGlobal("navigator", { hardwareConcurrency: 4 });
    expect(solverPoolSize()).toBe(6);
    vi.stubGlobal("navigator", undefined);
    expect(solverPoolSize()).toBe(6);
  });
});

describe("SolverAgentPool.ensure shrinks", () => {
  it("drops extra workers when a later run asks for fewer agents", () => {
    const terminated: number[] = [];
    const fakeWorker = (): Worker =>
      ({
        terminate: () => {
          terminated.push(1);
        },
        postMessage: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as Worker;

    const pool = new SolverAgentPool();
    const internal = pool as unknown as {
      slots: { worker: Worker; requestId: number }[];
    };
    // Simulate a prior Extreme run that left 12 workers warm.
    for (let i = 0; i < 12; i++) {
      internal.slots.push({ worker: fakeWorker(), requestId: 0 });
    }
    expect(pool.size()).toBe(12);
    // Thorough only wants 6 - must shrink or second runs stay slow.
    expect(pool.ensure(6)).toBe(6);
    expect(pool.size()).toBe(6);
    expect(terminated.length).toBe(6);
    pool.dispose();
  });
});

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

function hostSessionRequest(
  overrides: Partial<SerializableSolverRequest> = {},
): SerializableSolverRequest {
  return defaultSerializableRequest({
    style: "melee",
    durationTicks: 500,
    minBarSize: 4,
    maxBarSize: 11,
    seed: 1,
    tier: "thorough",
    profileId: "balanced",
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
        targetSize: 1,
        occupiedTiles: 1,
      },
      equipmentIds: ["abyssal_whip"],
      weaponConfiguration: "dualwield",
      startingAdrenaline: 100,
      modifierSources: emptyModifierSources(),
    },
    ...overrides,
  });
}

function agentDto(
  agentRequest: SerializableSolverRequest,
  partial: Partial<SolverResultDTO> & Pick<SolverResultDTO, "bar" | "score">,
): SolverResultDTO {
  return {
    windowDpms: 0,
    evaluations: 10,
    uniqueCandidates: 5,
    seed: agentRequest.seed ?? 1,
    profileId: agentRequest.profileId,
    tier: agentRequest.tier,
    durationTicks: agentRequest.durationTicks,
    solveIdentity: solveIdentityFromRequest(agentRequest),
    proofLabel: "heuristic-best-found",
    bestFullScore: partial.score,
    proof: { label: "heuristic-best-found" },
    top: [],
    ...partial,
  };
}

describe("mergeResults host solveIdentity", () => {
  it("re-stamps host session identity over agent-local seed/bar-band stamps", () => {
    const hostRequest = hostSessionRequest({ minBarSize: 4, maxBarSize: 11, seed: 1 });
    const agentA = { ...hostRequest, seed: 7, minBarSize: 4, maxBarSize: 4 };
    const agentB = { ...hostRequest, seed: 99, minBarSize: 4, maxBarSize: 4 };

    const hostIdentity = solveIdentityFromRequest(hostRequest);
    const agentAIdentity = solveIdentityFromRequest(agentA);
    const agentBIdentity = solveIdentityFromRequest(agentB);
    expect(agentAIdentity).not.toBe(hostIdentity);
    expect(agentBIdentity).not.toBe(hostIdentity);
    expect(agentAIdentity).not.toBe(agentBIdentity);

    const low = agentDto(agentA, {
      bar: ["a", "b", "c", "d"],
      score: 8_000,
      seed: 7,
    });
    const high = agentDto(agentB, {
      bar: ["w", "x", "y", "z"],
      score: 15_000,
      seed: 99,
    });
    expect(low.solveIdentity).toBe(agentAIdentity);
    expect(high.solveIdentity).toBe(agentBIdentity);

    // Without host re-stamp, winner keeps agent identity and fails session match.
    const raw = mergeResults([low, high]);
    expect(raw.solveIdentity).toBe(agentBIdentity);
    expect(resultMatchesRequestIdentity(hostRequest, raw)).toBe(false);
    expect(isVerifiedCacheableResult(hostRequest, raw)).toBe(false);

    const merged = mergeResults([low, high], hostRequest);
    expect(merged.solveIdentity).toBe(hostIdentity);
    expect(merged.solveIdentity).toBe(solveIdentityFromRequest(hostRequest));
    expect(merged.bar).toEqual(["w", "x", "y", "z"]);
    expect(merged.score).toBe(15_000);
    expect(resultMatchesRequestIdentity(hostRequest, merged)).toBe(true);
    expect(isVerifiedCacheableResult(hostRequest, merged)).toBe(true);
  });
});

describe("Phase-0 pool metrics", () => {
  it("reports per-agent budget vs global sum and known-wrong unique sum", () => {
    const parts = [
      progress({ bestScore: 10, evaluations: 100, uniqueCandidates: 40 }),
      progress({ bestScore: 12, evaluations: 90, uniqueCandidates: 35 }),
    ];
    const merged = mergeProgress(parts, 2, 2400);
    expect(merged.evaluationBudget).toBe(4800);
    expect(merged.poolMetrics).toMatchObject({
      agentCount: 2,
      perAgentBudget: 2400,
      globalBudget: 4800,
      globalBudgetSum: 4800,
      uniqueCandidatesSum: 75,
      uniqueCandidatesSumKnownWrong: true,
      agentEvaluations: [100, 90],
    });
    // Without host uniqueCandidates, progress uses naive sum fallback.
    expect(merged.uniqueCandidates).toBe(75);
    expect(merged.poolMetrics?.uniqueCandidatesEstimate).toBeGreaterThan(0);
  });

  it("records first/last finished and straggler wait from live timing", () => {
    const parts = [
      progress({
        bestScore: 10,
        evaluations: 50,
        uniqueCandidates: 10,
        progressRatio: 1,
        phase: "idle",
      }),
      progress({
        bestScore: 8,
        evaluations: 80,
        uniqueCandidates: 20,
        progressRatio: 1,
        phase: "idle",
      }),
    ];
    const live = {
      startedAtMs: 1_000,
      agentFinishedAtMs: [120, 400] as const,
      finishOrder: [0, 1] as const,
      hardwareCores: 8,
      reservedCore: false,
    };
    const metrics = buildPoolMetrics(parts, 2, 2400, live);
    expect(metrics.firstFinishedMs).toBe(120);
    expect(metrics.lastFinishedMs).toBe(400);
    expect(metrics.stragglerWaitMs).toBe(280);
    expect(metrics.finishOrder).toEqual([0, 1]);
    expect(metrics.hardwareCores).toBe(8);
    expect(metrics.agentEvaluations).toEqual([50, 80]);

    const merged = mergeProgress(
      parts,
      2,
      2400,
      [
        { finishRank: 0, evaluationBudget: 2400 },
        { finishRank: 1, evaluationBudget: 2400 },
      ],
      live,
    );
    expect(merged.agents?.[0]?.finishRank).toBe(0);
    expect(merged.agents?.[1]?.finishRank).toBe(1);
    expect(merged.agents?.[0]?.evaluationBudget).toBe(2400);
    expect(merged.poolMetrics?.stragglerWaitMs).toBe(280);
  });

  it("attaches poolMetrics on mergeResults without changing winner pick", () => {
    const hostRequest = hostSessionRequest({ seed: 1 });
    const a = agentDto(
      { ...hostRequest, seed: 7 },
      {
        bar: ["a", "b", "c", "d"],
        score: 8_000,
        seed: 7,
        evaluations: 40,
        uniqueCandidates: 15,
      },
    );
    const b = agentDto(
      { ...hostRequest, seed: 99 },
      {
        bar: ["w", "x", "y", "z"],
        score: 15_000,
        seed: 99,
        evaluations: 60,
        uniqueCandidates: 25,
      },
    );
    const metrics = buildPoolMetrics(
      [
        progress({ bestScore: 1, evaluations: 40, uniqueCandidates: 15 }),
        progress({ bestScore: 2, evaluations: 60, uniqueCandidates: 25 }),
      ],
      2,
      2400,
      {
        startedAtMs: 0,
        agentFinishedAtMs: [50, 200],
        finishOrder: [0, 1],
        hardwareCores: 4,
        reservedCore: false,
      },
    );
    const merged = mergeResults([a, b], hostRequest, metrics);
    expect(merged.score).toBe(15_000);
    expect(merged.uniqueCandidates).toBe(40);
    expect(merged.poolMetrics).toMatchObject({
      agentCount: 2,
      perAgentBudget: 2400,
      globalBudgetSum: 4800,
      uniqueCandidatesSum: 40,
      uniqueCandidatesSumKnownWrong: true,
      firstFinishedMs: 50,
      lastFinishedMs: 200,
      stragglerWaitMs: 150,
      reservedCore: false,
    });
  });
});

describe("Phase-2 host uniqueCandidates", () => {
  it("uses host uniqueCandidates as set cardinality, not naive sum", () => {
    // Same bars reported by both agents: naive sum would be 80; host set is 40.
    const parts = [
      progress({
        bestScore: 10,
        evaluations: 100,
        uniqueCandidates: 40,
        seenKeys: ["a\0b", "c\0d"],
      }),
      progress({
        bestScore: 12,
        evaluations: 90,
        uniqueCandidates: 40,
        seenKeys: ["a\0b", "c\0d"], // full overlap
      }),
    ];
    const live = {
      startedAtMs: 0,
      agentFinishedAtMs: [undefined, undefined] as const,
      finishOrder: [] as const,
      hardwareCores: 8,
      reservedCore: false,
      uniqueCandidates: 40, // host globalVisited.size
      globalEvaluations: 190,
    };
    const merged = mergeProgress(parts, 2, 2400, undefined, live);
    expect(merged.uniqueCandidates).toBe(40);
    expect(merged.poolMetrics).toMatchObject({
      agentCount: 2,
      perAgentBudget: 2400,
      globalBudget: 4800,
      globalBudgetSum: 4800,
      uniqueCandidates: 40,
      // Measure-only naive sum still double-counts (80); display uses host set.
      uniqueCandidatesSum: 80,
      uniqueCandidatesSumKnownWrong: false,
      globalEvaluations: 190,
    });
    // Display uniqueCandidates is host set size, not naive sum.
    expect(merged.uniqueCandidates).toBe(40);
    expect(merged.uniqueCandidates).not.toBe(80);
  });

  it("buildPoolMetrics falls back to naive sum only without host unique", () => {
    const parts = [
      progress({ bestScore: 1, evaluations: 10, uniqueCandidates: 15 }),
      progress({ bestScore: 2, evaluations: 20, uniqueCandidates: 25 }),
    ];
    const noHost = buildPoolMetrics(parts, 2, 100);
    expect(noHost.uniqueCandidates).toBe(40);
    expect(noHost.uniqueCandidatesSumKnownWrong).toBe(true);

    const withHost = buildPoolMetrics(parts, 2, 100, {
      startedAtMs: 0,
      agentFinishedAtMs: [],
      finishOrder: [],
      hardwareCores: 4,
      reservedCore: false,
      uniqueCandidates: 28,
    });
    expect(withHost.uniqueCandidates).toBe(28);
    // uniqueCandidatesSum always naive sum of agent counters.
    expect(withHost.uniqueCandidatesSum).toBe(40);
    expect(withHost.uniqueCandidatesSumKnownWrong).toBe(false);
  });

  it("mergeResults prefers host-set unique over sum of result uniqueCandidates", () => {
    const hostRequest = hostSessionRequest({ seed: 1 });
    const a = agentDto(
      { ...hostRequest, seed: 7 },
      {
        bar: ["a", "b", "c", "d"],
        score: 8_000,
        seed: 7,
        evaluations: 40,
        uniqueCandidates: 30,
      },
    );
    const b = agentDto(
      { ...hostRequest, seed: 99 },
      {
        bar: ["a", "b", "c", "d"], // same bar as a
        score: 15_000,
        seed: 99,
        evaluations: 60,
        uniqueCandidates: 30,
      },
    );
    const metrics = buildPoolMetrics(
      [
        progress({ bestScore: 1, evaluations: 40, uniqueCandidates: 30 }),
        progress({ bestScore: 2, evaluations: 60, uniqueCandidates: 30 }),
      ],
      2,
      2400,
      {
        startedAtMs: 0,
        agentFinishedAtMs: [50, 200],
        finishOrder: [0, 1],
        hardwareCores: 4,
        reservedCore: false,
        uniqueCandidates: 30, // shared set size, not 60
        globalEvaluations: 100,
      },
    );
    const merged = mergeResults([a, b], hostRequest, metrics);
    expect(merged.score).toBe(15_000);
    expect(merged.uniqueCandidates).toBe(30);
    expect(merged.evaluations).toBe(100);
    expect(merged.poolMetrics?.uniqueCandidatesSumKnownWrong).toBe(false);
  });

  it("collectProgressBarKeys unions seenKeys and preview bars", () => {
    const keys = collectProgressBarKeys([
      progress({
        bestScore: 1,
        seenKeys: ["x\0y", "z"],
        topBarPreview: ["p", "q"],
        activeBarPreview: ["r"],
      }),
      progress({
        bestScore: 2,
        seenKeys: ["x\0y"],
        topBarPreview: ["p", "q"],
      }),
    ]);
    expect(keys.has("x\0y")).toBe(true);
    expect(keys.has("z")).toBe(true);
    expect(keys.has(["p", "q"].join("\0"))).toBe(true);
    expect(keys.has("r")).toBe(true);
    expect(keys.size).toBe(4);
  });

  it("resolveMergedUnique single agent is not known-wrong", () => {
    const r = resolveMergedUnique([progress({ bestScore: 1, uniqueCandidates: 12 })], 1);
    expect(r.uniqueCandidatesSumKnownWrong).toBe(false);
    expect(r.uniqueCandidates).toBe(12);
  });

  it("resolveMergedUnique multi-agent without host is known-wrong sum", () => {
    const r = resolveMergedUnique(
      [
        progress({ bestScore: 1, uniqueCandidates: 10 }),
        progress({ bestScore: 2, uniqueCandidates: 20 }),
      ],
      2,
    );
    expect(r).toMatchObject({
      uniqueCandidates: 30,
      uniqueCandidatesSum: 30,
      uniqueCandidatesSumKnownWrong: true,
    });
  });
});
