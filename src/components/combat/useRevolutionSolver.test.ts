import { describe, expect, it, vi } from "vitest";
import { planWorkers, solveContextPayload } from "@/combat/solver";
import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";
import { emptyBuild } from "@/league";
import {
  APPLY_FINAL_STAMP_REJECT_MESSAGE,
  isCompletedResultStale,
  isLiveSolverSession,
  isNoValidatedUpgradeError,
  mayApplyFinalDtoStamp,
  mayApplySolverResultBar,
  mayPublishStoppedPreview,
  maySaveVerified,
  recentLibraryVerifiedFields,
  settlementActionForCatch,
  settlementActionForSolve,
  stoppedPreviewFromProgress,
} from "./revoPanelFormat";
import {
  createProgressRafGate,
  packSolverRequestFromUi,
  seedProgressFromPlan,
} from "./useRevolutionSolver";
import { toResolvedCombatModel } from "./toResolvedCombatModel";

/**
 * Hook ownership stays in useRevolutionSolver; settlement + seed-plan policy are pure
 * so cancel / stale / verified-write / agent-strip rules can be unit-tested without React.
 */
describe("useRevolutionSolver session settlement policy", () => {
  it("cancellation creates no final result", () => {
    const action = settlementActionForSolve({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "s",
      currentIdentity: "s",
      cancelled: true,
      hasFinalDto: true,
    });
    expect(action).toBe("stopped-preview");
    expect(action).not.toBe("apply-final");
  });

  it("cancellation does not allow verified cache writes", () => {
    const action = settlementActionForSolve({
      sessionGen: 2,
      currentGen: 2,
      sessionIdentity: "s",
      currentIdentity: "s",
      cancelled: true,
      hasFinalDto: true,
    });
    expect(action).toBe("stopped-preview");
    expect(action).not.toBe("apply-final");
  });

  it("stopped previews carry only known progress facts", () => {
    const preview = stoppedPreviewFromProgress(
      {
        phase: "exploit",
        evaluations: 40,
        uniqueCandidates: 9,
        bestScore: 12,
        bestExploratoryScore: 12,
        windowDpms: 999,
        topBarPreview: ["slice", "fury", "assault", "destroy", "pulverise"],
        noImprovementCount: 2,
      },
      "burst",
      "extreme",
      "stopped-early",
    );
    expect(preview).toMatchObject({
      bar: ["slice", "fury", "assault", "destroy", "pulverise"],
      evaluations: 40,
      uniqueCandidates: 9,
      bestExploratoryScore: 12,
      reason: "stopped-early",
      profileId: "burst",
      tier: "extreme",
    });
    expect(preview).not.toHaveProperty("windowDpms");
    expect(preview).not.toHaveProperty("seed");
    expect(preview).not.toHaveProperty("durationTicks");
    expect(preview).not.toHaveProperty("proofLabel");
  });

  it("ignores progress when generation is stale or inputs changed", () => {
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: "gear-a",
        currentIdentity: "gear-a",
      }),
    ).toBe(true);
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 2,
        sessionIdentity: "gear-a",
        currentIdentity: "gear-a",
      }),
    ).toBe(false);
    expect(
      isLiveSolverSession({
        sessionGen: 4,
        currentGen: 4,
        sessionIdentity: "before-perk-change",
        currentIdentity: "after-perk-change",
      }),
    ).toBe(false);
  });

  it("identity mismatch mid-run does not apply verified final", () => {
    const remember = vi.fn();
    const setFinal = vi.fn();
    const action = settlementActionForSolve({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "session-at-start",
      currentIdentity: "live-after-gear-change",
      cancelled: false,
      hasFinalDto: true,
    });
    expect(action).toBe("ignore");
    expect(action).not.toBe("apply-final");
    if (action === "apply-final") {
      remember();
      setFinal();
    }
    expect(remember).not.toHaveBeenCalled();
    expect(setFinal).not.toHaveBeenCalled();
  });

  it("identity-mismatched abort does not publish stoppedPreview or onActiveBar", () => {
    const setStopped = vi.fn();
    const onActiveBar = vi.fn();
    const setError = vi.fn();

    // Real catch path: AbortError after equipment/bounds change.
    const action = settlementActionForCatch({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "session-before-gear",
      currentIdentity: "session-after-gear",
      aborted: true,
    });
    expect(action).toBe("ignore");
    expect(mayPublishStoppedPreview(action)).toBe(false);

    // Host applies only when mayPublishStoppedPreview - same as catch in the hook.
    if (mayPublishStoppedPreview(action)) {
      setStopped();
      onActiveBar(["stale", "bar"]);
    }
    expect(setStopped).not.toHaveBeenCalled();
    expect(onActiveBar).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it("identity-mismatched hard error does not publish stoppedPreview or error UI", () => {
    const setStopped = vi.fn();
    const setError = vi.fn();
    const action = settlementActionForCatch({
      sessionGen: 3,
      currentGen: 3,
      sessionIdentity: "bounds-4",
      currentIdentity: "bounds-4-10",
      aborted: false,
    });
    expect(action).toBe("ignore");
    if (mayPublishStoppedPreview(action)) {
      setStopped();
      setError("Failed");
    }
    expect(setStopped).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it("live-session abort may publish stopped-preview only (never verified)", () => {
    const action = settlementActionForCatch({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "live",
      currentIdentity: "live",
      aborted: true,
    });
    expect(action).toBe("stopped-preview");
    expect(mayPublishStoppedPreview(action)).toBe(true);
    expect(action).not.toBe("apply-final");
  });

  it("Phase 4: no-validated-upgrade failure never onActiveBar or stoppedPreview", () => {
    const onActiveBar = vi.fn();
    const setStopped = vi.fn();
    const setError = vi.fn();
    const setResult = vi.fn();
    const message =
      "solver failed: no validated full-horizon upgrade; status=failed; proof=failed";
    const action = settlementActionForCatch({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "live",
      currentIdentity: "live",
      aborted: false,
    });
    // Catch mayPublish would allow stopped-preview, but Phase 4 short-circuits.
    expect(mayPublishStoppedPreview(action)).toBe(true);
    expect(isNoValidatedUpgradeError(message)).toBe(true);
    if (isNoValidatedUpgradeError(message)) {
      setResult(null);
      setStopped(null);
      setError(message);
    } else if (mayPublishStoppedPreview(action)) {
      setStopped();
      onActiveBar(["exploratory", "bar"]);
      setError(message);
    }
    expect(onActiveBar).not.toHaveBeenCalled();
    expect(setStopped).toHaveBeenCalledWith(null);
    expect(setError).toHaveBeenCalledWith(message);
    expect(setResult).toHaveBeenCalledWith(null);
  });

  it("Phase 4: Apply disabled for degraded/failed DTO proofs", () => {
    const base = {
      bar: ["a", "b", "c", "d"],
      score: 9_000,
      windowDpms: 0,
      evaluations: 10,
      uniqueCandidates: 3,
      seed: 1,
      profileId: "balanced" as const,
      tier: "thorough" as const,
      durationTicks: 500,
      solveIdentity: "ctx",
    };
    expect(
      mayApplySolverResultBar({ ...base, proofLabel: "heuristic-best-found" }),
    ).toBe(true);
    expect(
      mayApplySolverResultBar({
        ...base,
        proofLabel: "degraded-exploratory-fallback",
      }),
    ).toBe(false);
    expect(mayApplySolverResultBar({ ...base, proofLabel: "failed" })).toBe(false);
  });

  it("maps settlement outcomes the way the hook applies them", () => {
    const remember = vi.fn();
    const setFinal = vi.fn();
    const setStopped = vi.fn();

    const apply = (action: ReturnType<typeof settlementActionForSolve>) => {
      if (action === "apply-final") {
        remember();
        setFinal();
      } else if (action === "stopped-preview") {
        setStopped();
      }
    };

    apply(
      settlementActionForSolve({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: "x",
        currentIdentity: "x",
        cancelled: true,
        hasFinalDto: true,
      }),
    );
    expect(remember).not.toHaveBeenCalled();
    expect(setFinal).not.toHaveBeenCalled();
    expect(setStopped).toHaveBeenCalledOnce();

    remember.mockClear();
    setFinal.mockClear();
    setStopped.mockClear();

    // Cancelled but identity drifted -> ignore (no stopped publish).
    apply(
      settlementActionForSolve({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: "x",
        currentIdentity: "y",
        cancelled: true,
        hasFinalDto: true,
      }),
    );
    expect(remember).not.toHaveBeenCalled();
    expect(setFinal).not.toHaveBeenCalled();
    expect(setStopped).not.toHaveBeenCalled();
  });

  it("apply-final empty or mismatched DTO stamp fails closed with error (no verified)", () => {
    const remember = vi.fn();
    const setFinal = vi.fn();
    const setError = vi.fn();
    const setStopped = vi.fn();

    // Same policy as useRevolutionSolver optimize resolve path.
    const settleFinal = (opts: {
      dtoSolveIdentity: string;
      liveIdentity: string;
      sessionIdentity?: string;
    }) => {
      const action = settlementActionForSolve({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: opts.sessionIdentity ?? opts.liveIdentity,
        currentIdentity: opts.liveIdentity,
        cancelled: false,
        hasFinalDto: true,
      });
      if (action === "ignore") return;
      if (action === "stopped-preview") {
        setStopped();
        return;
      }
      if (
        !mayApplyFinalDtoStamp({
          dtoSolveIdentity: opts.dtoSolveIdentity,
          liveIdentity: opts.liveIdentity,
        })
      ) {
        setError(APPLY_FINAL_STAMP_REJECT_MESSAGE);
        return;
      }
      if (action === "apply-final") {
        remember();
        setFinal();
      }
    };

    settleFinal({ dtoSolveIdentity: "", liveIdentity: "live-ctx" });
    expect(remember).not.toHaveBeenCalled();
    expect(setFinal).not.toHaveBeenCalled();
    expect(setStopped).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(APPLY_FINAL_STAMP_REJECT_MESSAGE);
    expect(mayApplyFinalDtoStamp({ dtoSolveIdentity: "", liveIdentity: "live-ctx" })).toBe(
      false,
    );

    remember.mockClear();
    setFinal.mockClear();
    setError.mockClear();
    setStopped.mockClear();

    settleFinal({ dtoSolveIdentity: "stale-stamp", liveIdentity: "live-ctx" });
    expect(remember).not.toHaveBeenCalled();
    expect(setFinal).not.toHaveBeenCalled();
    expect(setStopped).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(APPLY_FINAL_STAMP_REJECT_MESSAGE);
    expect(
      mayApplyFinalDtoStamp({ dtoSolveIdentity: "stale-stamp", liveIdentity: "live-ctx" }),
    ).toBe(false);

    remember.mockClear();
    setFinal.mockClear();
    setError.mockClear();

    settleFinal({ dtoSolveIdentity: "live-ctx", liveIdentity: "live-ctx" });
    expect(setError).not.toHaveBeenCalled();
    expect(setFinal).toHaveBeenCalledOnce();
    expect(remember).toHaveBeenCalledOnce();
  });
});

describe("live identity (pack+payload; progress is string compare)", () => {
  const material = (overrides: {
    limitToRegions?: boolean;
    barSizePreset?: "fixed4" | "range4_11" | "range4_6";
    style?: "melee" | "ranged" | "magic" | "necromancy";
  } = {}) => {
    const loadout = { ...DEFAULT_LOADOUT, style: overrides.style ?? DEFAULT_LOADOUT.style };
    return {
      combatModel: toResolvedCombatModel(loadout),
      loadout,
      build: emptyBuild(),
      modelled: [] as never[],
      solverTier: "thorough" as const,
      solverProfile: "balanced" as const,
      limitToRegions: overrides.limitToRegions ?? false,
      barSizePreset: overrides.barSizePreset ?? ("range4_11" as const),
    };
  };

  it("identity is pack+solveContextPayload of material inputs", () => {
    const m = material();
    const packed = packSolverRequestFromUi({ ...m, now: 1_700_000_000_000 });
    const identity = solveContextPayload(packed);
    // Same material + seed family yields the same token (now is not in identity).
    expect(solveContextPayload(packSolverRequestFromUi({ ...m, now: 1_700_000_000_001 }))).toBe(
      identity,
    );
    expect(solveContextPayload(packSolverRequestFromUi(m))).toBe(identity);
  });

  it("material drift changes identity; progress path only needs string equality", () => {
    const a = solveContextPayload(packSolverRequestFromUi(material({ barSizePreset: "fixed4" })));
    const b = solveContextPayload(
      packSolverRequestFromUi(material({ barSizePreset: "range4_11" })),
    );
    expect(a).not.toBe(b);
    // Progress gate: same string => live session; different => ignore.
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: a,
        currentIdentity: a,
      }),
    ).toBe(true);
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: a,
        currentIdentity: b,
      }),
    ).toBe(false);
  });
});

describe("progress rAF gate", () => {
  it("coalesces pushes into one frame and flushes latest on settle", () => {
    const frames: Array<() => void> = [];
    const published: number[] = [];
    const gate = createProgressRafGate(
      (p) => {
        published.push(p.evaluations);
      },
      {
        raf: (cb) => {
          frames.push(cb as () => void);
          return frames.length;
        },
        caf: () => {
          frames.length = 0;
        },
      },
    );

    gate.push({
      phase: "explore",
      evaluations: 1,
      uniqueCandidates: 0,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
    });
    gate.push({
      phase: "explore",
      evaluations: 2,
      uniqueCandidates: 0,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
    });
    gate.push({
      phase: "explore",
      evaluations: 3,
      uniqueCandidates: 0,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
    });
    expect(published).toEqual([]);
    expect(frames).toHaveLength(1);
    frames[0]!();
    expect(published).toEqual([3]);

    gate.push({
      phase: "exploit",
      evaluations: 10,
      uniqueCandidates: 1,
      bestScore: 1,
      windowDpms: 0,
      topBarPreview: ["a"],
      noImprovementCount: 0,
    });
    gate.push({
      phase: "exploit",
      evaluations: 99,
      uniqueCandidates: 2,
      bestScore: 2,
      windowDpms: 0,
      topBarPreview: ["a", "b"],
      noImprovementCount: 0,
    });
    gate.flush();
    expect(published).toEqual([3, 99]);
  });
});

describe("save gate + completed-result stale", () => {
  const bar = ["slice", "fury", "assault", "destroy"];

  it("allows verified save only when live identity and bar match the DTO", () => {
    const cacheable = "heuristic-best-found" as const;
    expect(
      maySaveVerified({
        liveIdentity: "ctx-a",
        resultSolveIdentity: "ctx-a",
        finalBar: bar,
        currentBar: bar,
        proofLabel: cacheable,
      }),
    ).toBe(true);
    expect(
      maySaveVerified({
        liveIdentity: "ctx-a",
        resultSolveIdentity: "ctx-b",
        finalBar: bar,
        currentBar: bar,
        proofLabel: cacheable,
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "ctx-a",
        resultSolveIdentity: "ctx-a",
        finalBar: bar,
        currentBar: [...bar, "extra"],
        proofLabel: cacheable,
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "ctx-a",
        resultSolveIdentity: "ctx-a",
        finalBar: bar,
        currentBar: bar,
        proofLabel: cacheable,
        solving: true,
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "",
        resultSolveIdentity: "ctx-a",
        finalBar: bar,
        currentBar: bar,
        proofLabel: cacheable,
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "ctx-a",
        resultSolveIdentity: "ctx-a",
        finalBar: bar,
        currentBar: bar,
        proofLabel: "stopped-early",
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "ctx-a",
        resultSolveIdentity: "ctx-a",
        finalBar: bar,
        currentBar: bar,
        proofLabel: "degraded-exploratory-fallback",
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "ctx-a",
        resultSolveIdentity: "ctx-a",
        finalBar: bar,
        currentBar: bar,
      }),
    ).toBe(false);
  });

  it("degraded final cannot write verified recent; cacheable can", () => {
    const request = packSolverRequestFromUi({
      combatModel: toResolvedCombatModel(DEFAULT_LOADOUT),
      loadout: DEFAULT_LOADOUT,
      build: emptyBuild(),
      modelled: [],
      solverTier: "thorough",
      solverProfile: "balanced",
      limitToRegions: false,
      barSizePreset: "range4_11",
      now: 1_700_000_000_000,
    });
    const identity = solveContextPayload(request);
    const longBar = ["a", "b", "c", "d", "e", "f"];
    const base = {
      bar: longBar,
      score: 9_000,
      windowDpms: 0,
      evaluations: 50,
      uniqueCandidates: 10,
      seed: 1,
      profileId: "balanced" as const,
      tier: "thorough" as const,
      durationTicks: 500,
      solveIdentity: identity,
      bestFullScore: 9_000,
      top: [] as never[],
    };
    expect(
      recentLibraryVerifiedFields(request, {
        ...base,
        proofLabel: "degraded-exploratory-fallback",
        proof: { label: "degraded-exploratory-fallback" },
        bestFullScore: undefined,
      }),
    ).toEqual({ verified: false, scoreContext: null });
    expect(
      recentLibraryVerifiedFields(request, {
        ...base,
        proofLabel: "heuristic-best-found",
        proof: { label: "heuristic-best-found" },
      }),
    ).toEqual({ verified: true, scoreContext: identity });
  });

  it("marks completed results stale when stamp drifts or is empty", () => {
    expect(
      isCompletedResultStale({
        liveIdentity: "live",
        resultSolveIdentity: "old",
      }),
    ).toBe(true);
    expect(
      isCompletedResultStale({
        liveIdentity: "live",
        resultSolveIdentity: "live",
      }),
    ).toBe(false);
    expect(
      isCompletedResultStale({
        liveIdentity: "live",
        resultSolveIdentity: "",
      }),
    ).toBe(true);
  });
});

describe("seedProgressFromPlan (real planWorkers path)", () => {
  it("fixed4 seed agents stay at length 4 - never invents full 4..10 ladder", () => {
    const plan = planWorkers({
      minBarSize: 4,
      maxBarSize: 4,
      tier: "thorough",
      baseSeed: 1,
      hardwareCores: 8,
    });
    const progress = seedProgressFromPlan(plan, "thorough");
    expect(progress.agentCount).toBe(plan.agentCount);
    expect(progress.agents?.length).toBe(plan.agentCount);
    // Reported count equals plan launches - not tier ceiling alone when cores lower it.
    expect(progress.agentCount).toBeLessThanOrEqual(4);
    for (const a of progress.agents ?? []) {
      expect(a.barLength).toBe(4);
    }
    expect((progress.agents ?? []).some((a) => (a.barLength ?? 0) > 4)).toBe(false);
  });

  it("ranged 4..6 seed lengths stay inside request bounds", () => {
    const plan = planWorkers({
      minBarSize: 4,
      maxBarSize: 6,
      tier: "extreme",
      baseSeed: 7,
      hardwareCores: 16,
    });
    const progress = seedProgressFromPlan(plan, "extreme");
    expect(progress.agentCount).toBe(plan.agentCount);
    for (const a of progress.agents ?? []) {
      expect(a.barLength).toBeGreaterThanOrEqual(4);
      expect(a.barLength).toBeLessThanOrEqual(6);
    }
  });
});
