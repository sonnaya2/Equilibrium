import { describe, expect, it, vi } from "vitest";
import { packSolverRequest } from "@/combat/solver";
import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";
import { loadoutStats } from "@/components/combat/loadoutStats";
import { emptyBuild } from "@/league";
import {
  barBoundsFromPreset,
  clampedBarBoundsFromPreset,
  formatNumber,
  formatProofLabel,
  formatTime,
  isLiveSolverSession,
  mayPublishStoppedPreview,
  mayWriteVerifiedSolveArtifacts,
  previewCategory,
  productBarSizeFloor,
  progressFillFromState,
  settlementActionForCatch,
  settlementActionForSolve,
  solverPhaseLabel,
  stoppedPreviewFromProgress,
  trackLiveClassName,
  workerRecipeGroupLabel,
} from "./revoPanelFormat";
import { pickBarForLoadout, revoManagedModelled, SUPPORTED_BARS } from "./revoBarResolve";
import { solverSnapshotFromUi } from "./solverSnapshot";
import { packSolverRequestFromUi } from "./useRevolutionSolver";

describe("revoPanelFormat", () => {
  it("labels solver phases for status chrome", () => {
    expect(solverPhaseLabel("seed")).toBe("Seeding");
    expect(solverPhaseLabel("finalize")).toBe("Scoring");
    expect(solverPhaseLabel("explore", { stopping: true })).toBe("Stopping");
  });

  it("maps proof labels to short human text", () => {
    expect(formatProofLabel("heuristic-best-found")).toBe("Best found");
    expect(formatProofLabel("full-objective-global-optimum")).toBe("Global optimum");
    expect(formatProofLabel("search-objective-exhaustive")).toBe("Exhaustive");
    expect(formatProofLabel("full-shortlist-best")).toBe("Shortlist best");
    expect(formatProofLabel("degraded-exploratory-fallback")).toBe("Exploratory");
    expect(formatProofLabel("failed")).toBe("Failed");
    expect(formatProofLabel("stopped-early")).toBe("Stopped early");
    expect(formatProofLabel("heuristic-complete")).toBe("Heuristic complete");
    expect(formatProofLabel("budget-not-exhausted")).toBe("Budget not exhausted");
    expect(formatProofLabel(undefined)).toBe("Best found");
    expect(formatProofLabel(null)).toBe("Best found");
    expect(formatProofLabel("some-future-proof")).toBe("Some Future Proof");
  });

  it("maps ability categories for preview slots", () => {
    expect(previewCategory("enhanced")).toBe("threshold");
    expect(previewCategory("basic")).toBe("basic");
    expect(previewCategory(undefined)).toBeUndefined();
  });

  it("builds a stopped preview from live progress without invented fields", () => {
    const preview = stoppedPreviewFromProgress(
      {
        phase: "explore",
        evaluations: 12,
        uniqueCandidates: 4,
        bestScore: 100,
        bestExploratoryScore: 100,
        bestFullScore: 200,
        windowDpms: 0,
        topBarPreview: ["a", "b"],
        noImprovementCount: 0,
      },
      "balanced",
      "thorough",
      "stopped-early",
    );
    expect(preview).not.toBeNull();
    expect(preview!.bar).toEqual(["a", "b"]);
    expect(preview!.bestExploratoryScore).toBe(100);
    expect(preview!.bestFullScore).toBe(200);
    expect(preview!.reason).toBe("stopped-early");
    expect(preview!.evaluations).toBe(12);
    // Must not look like a SolverResultDTO (no invented seed/duration/window/proof).
    expect(preview).not.toHaveProperty("seed");
    expect(preview).not.toHaveProperty("durationTicks");
    expect(preview).not.toHaveProperty("windowDpms");
    expect(preview).not.toHaveProperty("proofLabel");
    expect(preview).not.toHaveProperty("score");
  });

  it("returns null stopped preview when no bar is known", () => {
    expect(
      stoppedPreviewFromProgress(
        {
          phase: "seed",
          evaluations: 0,
          uniqueCandidates: 0,
          bestScore: 0,
          windowDpms: 0,
          topBarPreview: [],
          noImprovementCount: 0,
        },
        "balanced",
        "thorough",
        "stopped-early",
      ),
    ).toBeNull();
  });

  it("rejects stale sessions and cancelled finals", () => {
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: "a",
        currentIdentity: "a",
      }),
    ).toBe(true);
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 2,
        sessionIdentity: "a",
        currentIdentity: "a",
      }),
    ).toBe(false);
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: "a",
        currentIdentity: "b",
      }),
    ).toBe(false);
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: "a",
        currentIdentity: "a",
        cancelled: true,
      }),
    ).toBe(false);
  });

  it("cancellation creates no final result and no verified cache writes", () => {
    const action = settlementActionForSolve({
      sessionGen: 3,
      currentGen: 3,
      sessionIdentity: "ctx",
      currentIdentity: "ctx",
      cancelled: true,
      hasFinalDto: true,
    });
    expect(action).toBe("stopped-preview");
    expect(mayWriteVerifiedSolveArtifacts(action)).toBe(false);
  });

  it("stale completion after equipment/perk/target/bounds change is ignored", () => {
    const action = settlementActionForSolve({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "equip-v1",
      currentIdentity: "equip-v2",
      cancelled: false,
      hasFinalDto: true,
    });
    expect(action).toBe("ignore");
    expect(mayWriteVerifiedSolveArtifacts(action)).toBe(false);
  });

  it("completed live session may publish a final DTO and verified artifacts", () => {
    const action = settlementActionForSolve({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "ok",
      currentIdentity: "ok",
      cancelled: false,
      hasFinalDto: true,
    });
    expect(action).toBe("apply-final");
    expect(mayWriteVerifiedSolveArtifacts(action)).toBe(true);
  });

  it("formats numbers and tick times", () => {
    expect(formatNumber(1234.6)).toBe("1,235");
    expect(formatTime(6)).toMatch(/s$/);
  });

  it("derives progress fill and track classes", () => {
    expect(progressFillFromState(false, null, 2400)).toBe(0);
    expect(
      progressFillFromState(
        true,
        {
          phase: "explore",
          evaluations: 0,
          uniqueCandidates: 0,
          bestScore: 0,
          windowDpms: 0,
          topBarPreview: [],
          noImprovementCount: 0,
          progressRatio: 0.5,
        },
        2400,
      ),
    ).toBe(0.5);
    expect(trackLiveClassName(true, true, null)).toContain("stopping");
    expect(workerRecipeGroupLabel("evolutionary")).toBe("Evo");
  });
});

describe("settlementActionForCatch identity gate", () => {
  it("identity-mismatched abort ignores like the hook catch path", () => {
    const action = settlementActionForCatch({
      sessionGen: 1,
      currentGen: 1,
      sessionIdentity: "a",
      currentIdentity: "b",
      aborted: true,
    });
    expect(action).toBe("ignore");
    expect(mayPublishStoppedPreview(action)).toBe(false);
  });
});

describe("bar size presets → packer", () => {
  it("fixed four-slot UI request reaches packSolverRequest", () => {
    const spy = vi.fn(packSolverRequest);
    const loadout = { ...DEFAULT_LOADOUT };
    const stats = loadoutStats(loadout);
    const build = emptyBuild();
    const raw = barBoundsFromPreset("fixed4");
    expect(raw).toEqual({ minBarSize: 4, maxBarSize: 4 });

    const req = spy({
      snapshot: solverSnapshotFromUi(stats, loadout),
      style: loadout.style,
      build,
      tier: "thorough",
      profileId: "balanced",
      minBarSize: raw.minBarSize,
      maxBarSize: raw.maxBarSize,
      now: 1_700_000_000_000,
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ minBarSize: 4, maxBarSize: 4 }),
    );
    expect(req.minBarSize).toBe(4);
    expect(req.maxBarSize).toBe(4);
    expect(clampedBarBoundsFromPreset("fixed4").minBarSize).toBe(4);
    expect(productBarSizeFloor()).toBe(4);
  });

  it("packSolverRequestFromUi passes fixed4 bounds into the packer", () => {
    const loadout = { ...DEFAULT_LOADOUT };
    const stats = loadoutStats(loadout);
    const req = packSolverRequestFromUi({
      stats,
      loadout,
      build: emptyBuild(),
      modelled: [],
      solverTier: "thorough",
      solverProfile: "balanced",
      limitToRegions: false,
      barSizePreset: "fixed4",
      now: 1_700_000_000_000,
    });
    expect(req.minBarSize).toBe(4);
    expect(req.maxBarSize).toBe(4);
    expect(barBoundsFromPreset("fixed4").minBarSize).toBe(4);
  });

  it("range and fixed length presets clamp into product window", () => {
    expect(barBoundsFromPreset("range4_6")).toEqual({ minBarSize: 4, maxBarSize: 6 });
    expect(barBoundsFromPreset("fixed6")).toEqual({ minBarSize: 6, maxBarSize: 6 });
    expect(barBoundsFromPreset("range4_10")).toEqual({ minBarSize: 4, maxBarSize: 10 });
    expect(barBoundsFromPreset("fixed7")).toEqual({ minBarSize: 7, maxBarSize: 7 });
    expect(barBoundsFromPreset("fixed8")).toEqual({ minBarSize: 8, maxBarSize: 8 });
    expect(barBoundsFromPreset("fixed9")).toEqual({ minBarSize: 9, maxBarSize: 9 });
    expect(barBoundsFromPreset("fixed10")).toEqual({ minBarSize: 10, maxBarSize: 10 });
    expect(barBoundsFromPreset("fixed11")).toEqual({ minBarSize: 11, maxBarSize: 11 });
    expect(barBoundsFromPreset("range4_11")).toEqual({ minBarSize: 4, maxBarSize: 11 });
    const floor = productBarSizeFloor();
    expect(clampedBarBoundsFromPreset("range4_6").minBarSize).toBe(floor);
    expect(clampedBarBoundsFromPreset("range4_6").maxBarSize).toBe(6);
    expect(clampedBarBoundsFromPreset("fixed6")).toEqual({ minBarSize: 6, maxBarSize: 6 });
    expect(clampedBarBoundsFromPreset("fixed11")).toEqual({ minBarSize: 11, maxBarSize: 11 });
  });
});

describe("revoBarResolve", () => {
  it("ships single-target supported bars only", () => {
    expect(SUPPORTED_BARS.length).toBeGreaterThan(0);
    expect(SUPPORTED_BARS.every((b) => b.supported)).toBe(true);
  });

  it("picks a melee dual-shaped reference for dual wield", () => {
    const bar = pickBarForLoadout("melee", "dualwield") ?? pickBarForLoadout("melee");
    expect(bar).toBeDefined();
    expect(bar!.style).toBe("melee");
    const modelled = revoManagedModelled(bar!);
    expect(Array.isArray(modelled)).toBe(true);
  });
});
