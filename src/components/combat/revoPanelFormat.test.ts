import { describe, expect, it, vi } from "vitest";
import { packSolverRequest, solveContextPayload, type SolverResultDTO } from "@/combat/solver";
import { DEFAULT_LOADOUT } from "@/components/combat/useLoadout";
import { emptyBuild } from "@/league";
import {
  barBoundsFromPreset,
  barsMatch,
  clampedBarBoundsFromPreset,
  formatAdrenalineTimeline,
  formatCritContext,
  formatNumber,
  formatProofLabel,
  formatTime,
  APPLY_FINAL_STAMP_REJECT_MESSAGE,
  CURRENT_BAR_REMAINS_BEST,
  formatSolverUpgradeChrome,
  isCompletedResultStale,
  isLiveSolverSession,
  isNoValidatedUpgradeError,
  mayApplyFinalDtoStamp,
  mayApplySolverResultBar,
  mayApplySolverResultRow,
  mayApplyStoppedPreview,
  mayPublishStoppedPreview,
  maySaveVerified,
  previewCategory,
  productBarSizeFloor,
  progressFillFromState,
  recentLibraryVerifiedFields,
  settlementActionForCatch,
  settlementActionForSolve,
  shouldAdoptSolverResultBar,
  solverPhaseLabel,
  stoppedPreviewFromProgress,
  trackLiveClassName,
  workerRecipeGroupLabel,
} from "./revoPanelFormat";
import {
  ensureNecroConjuresOnBarIds,
  pickBarForLoadout,
  revoManagedModelled,
  SUPPORTED_BARS,
} from "./revoBarResolve";
import { toResolvedCombatModel } from "./toResolvedCombatModel";
import { packSolverRequestFromUi } from "./useRevolutionSolver";

describe("revoPanelFormat", () => {
  it("labels ability resources separately from end-of-occupancy adrenaline", () => {
    expect(
      formatAdrenalineTimeline({
        adrenalineBefore: 5,
        adrenalineAfterResources: 12,
        adrenalineAfter: 18,
      }),
    ).toBe("5% → 12% → 18%");
    expect(
      formatAdrenalineTimeline({
        adrenalineBefore: 50,
        adrenalineAfterResources: 70,
        adrenalineAfter: 70,
        adrenalineTransaction: { spendPreventedBy: "deathspore" },
      }),
    ).toBe("50% → 70% (Deathspore free cast)");
    expect(formatAdrenalineTimeline({ adrenalineBefore: 18, adrenalineAfter: 18 })).toBe(
      "18% → 18%",
    );
  });

  it("shows effective crit rate and Critual conversion from resolved stats", () => {
    expect(
      formatCritContext({
        critChance: 0.5,
        uncappedCritChance: 0.55,
        convertedCritChance: 0.05,
        critualActive: true,
      }),
    ).toBe("50.0% · +5.0% Critual dmg");
    expect(
      formatCritContext({
        critChance: 0.2,
        uncappedCritChance: 0.2,
        convertedCritChance: 0,
        critualActive: false,
      }),
    ).toBe("20.0%");
  });

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

  it("never shows exact-claim proof chrome when approximated", () => {
    expect(formatProofLabel("full-objective-global-optimum", { approximated: true })).toBe(
      "Approximated",
    );
    expect(formatProofLabel("globally-optimal", { approximated: true })).toBe("Approximated");
    expect(formatProofLabel("search-objective-exhaustive", { approximated: true })).toBe(
      "Approximated",
    );
    expect(formatProofLabel("full-shortlist-best", { approximated: true })).toBe("Shortlist best");
  });

  it("never shows Global optimum when residualWeight or non-exact exactness is present", () => {
    expect(formatProofLabel("full-objective-global-optimum", { residualWeight: 0.05 })).toBe(
      "Approximated",
    );
    expect(
      formatProofLabel("full-objective-global-optimum", {
        exactness: "estimated",
      }),
    ).toBe("Approximated");
    expect(formatProofLabel("search-objective-exhaustive", { exactness: "estimated" })).toBe(
      "Approximated",
    );
    expect(formatProofLabel("full-objective-global-optimum", { residualWeight: 0 })).toBe(
      "Global optimum",
    );
    expect(formatProofLabel("heuristic-best-found", { residualWeight: 0.2 })).toBe("Best found");
  });

  it("maps ability categories for preview slots", () => {
    expect(previewCategory("enhanced")).toBe("enhanced");
    expect(previewCategory("threshold")).toBe("threshold");
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
    expect(action).not.toBe("apply-final");
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
    expect(action).not.toBe("apply-final");
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
  });

  it("mayApplyFinalDtoStamp fails closed on empty or mismatched stamp", () => {
    expect(mayApplyFinalDtoStamp({ dtoSolveIdentity: "live", liveIdentity: "live" })).toBe(true);
    expect(mayApplyFinalDtoStamp({ dtoSolveIdentity: "", liveIdentity: "live" })).toBe(false);
    expect(mayApplyFinalDtoStamp({ dtoSolveIdentity: null, liveIdentity: "live" })).toBe(false);
    expect(mayApplyFinalDtoStamp({ dtoSolveIdentity: undefined, liveIdentity: "live" })).toBe(
      false,
    );
    expect(mayApplyFinalDtoStamp({ dtoSolveIdentity: "other", liveIdentity: "live" })).toBe(false);
    expect(APPLY_FINAL_STAMP_REJECT_MESSAGE.length).toBeGreaterThan(0);
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

describe("Phase 4 apply / validation failure gates", () => {
  it("isNoValidatedUpgradeError matches resultBuilder throw text", () => {
    expect(
      isNoValidatedUpgradeError("solver failed: no validated full-horizon upgrade; status=failed"),
    ).toBe(true);
    expect(isNoValidatedUpgradeError("no valid candidate")).toBe(true);
    expect(isNoValidatedUpgradeError("worker crashed")).toBe(false);
  });

  it("mayApplySolverResultBar only for verified-cacheable proofs", () => {
    const base = {
      bar: ["a", "b", "c", "d"],
      score: 1000,
      windowDpms: 0,
      evaluations: 10,
      uniqueCandidates: 4,
      seed: 1,
      profileId: "balanced" as const,
      tier: "thorough" as const,
      durationTicks: 500,
      solveIdentity: "id",
    };
    expect(
      mayApplySolverResultBar({
        ...base,
        proofLabel: "heuristic-best-found",
      }),
    ).toBe(true);
    expect(
      mayApplySolverResultBar({
        ...base,
        proofLabel: "full-shortlist-best",
      }),
    ).toBe(true);
    expect(
      mayApplySolverResultBar({
        ...base,
        proofLabel: "degraded-exploratory-fallback",
      }),
    ).toBe(false);
    expect(
      mayApplySolverResultBar({
        ...base,
        proofLabel: "failed",
      }),
    ).toBe(false);
    expect(
      mayApplySolverResultBar({
        ...base,
        bar: [],
        proofLabel: "heuristic-best-found",
      }),
    ).toBe(false);
    expect(mayApplySolverResultBar(null)).toBe(false);
  });

  it("Phase 5: mayApply false when isUpgrade or validForApply is false", () => {
    const base = {
      bar: ["a", "b", "c", "d"],
      score: 1000,
      windowDpms: 0,
      evaluations: 10,
      uniqueCandidates: 4,
      seed: 1,
      profileId: "balanced" as const,
      tier: "thorough" as const,
      durationTicks: 500,
      solveIdentity: "id",
      proofLabel: "heuristic-best-found" as const,
    };
    // Legacy DTOs (flags undefined): proof gates only.
    expect(mayApplySolverResultBar(base)).toBe(true);
    expect(shouldAdoptSolverResultBar(base)).toBe(true);

    expect(mayApplySolverResultBar({ ...base, isUpgrade: false, validForApply: false })).toBe(
      false,
    );
    expect(shouldAdoptSolverResultBar({ ...base, isUpgrade: false, validForApply: false })).toBe(
      false,
    );

    expect(mayApplySolverResultBar({ ...base, isUpgrade: false })).toBe(false);
    expect(mayApplySolverResultBar({ ...base, validForApply: false })).toBe(false);

    expect(
      mayApplySolverResultBar({
        ...base,
        isUpgrade: true,
        validForApply: true,
        scoreImprovement: 120,
        percentImprovement: 5.5,
      }),
    ).toBe(true);
    expect(
      shouldAdoptSolverResultBar({
        ...base,
        isUpgrade: true,
        validForApply: true,
      }),
    ).toBe(true);

    // Residual mass hard-disables Apply even with cacheable proof + upgrade flags.
    expect(
      mayApplySolverResultBar({
        ...base,
        isUpgrade: true,
        validForApply: true,
        honesty: {
          status: "ok",
          fullyValidated: false,
          beatsBar: true,
          stochasticExactness: "approximated",
          residualMass: 0.66,
          currentBarScore: 100,
          proposedBarScore: 1000,
          improvement: 900,
          applyAllowed: false,
        },
      }),
    ).toBe(false);
    expect(
      mayApplySolverResultBar({
        ...base,
        isUpgrade: true,
        validForApply: true,
        rng: { residualWeight: 0.2, exactness: "approximated" },
      }),
    ).toBe(false);
    // Winner-row Apply only.
    const upgrade = {
      ...base,
      isUpgrade: true as const,
      validForApply: true as const,
      proofLabel: "heuristic-best-found" as const,
    };
    expect(mayApplySolverResultRow(upgrade, upgrade.bar)).toBe(true);
    expect(mayApplySolverResultRow(upgrade, ["other", "bar"])).toBe(false);
    expect(mayApplyStoppedPreview()).toBe(false);
    expect(
      formatSolverUpgradeChrome({
        isUpgrade: true,
        scoreImprovement: 100,
        honesty: { residualMass: 0.5, beatsBar: true, applyAllowed: false },
      }),
    ).toBe("residual blocks apply");
  });

  it("Phase 5: formatSolverUpgradeChrome remains-best and improvement", () => {
    expect(formatSolverUpgradeChrome({ isUpgrade: false })).toBe(CURRENT_BAR_REMAINS_BEST);
    expect(formatSolverUpgradeChrome({})).toBeNull();
    expect(
      formatSolverUpgradeChrome({
        isUpgrade: true,
        scoreImprovement: 1500,
        percentImprovement: 12.5,
      }),
    ).toBe("+1,500 (+12.5%)");
    expect(
      formatSolverUpgradeChrome({
        isUpgrade: true,
        scoreImprovement: 80,
      }),
    ).toBe("+80");
    expect(
      formatSolverUpgradeChrome({
        isUpgrade: true,
        scoreImprovement: 0,
      }),
    ).toBeNull();
  });
});

describe("verified save + identity helpers", () => {
  it("barsMatch requires same ordered ids", () => {
    expect(barsMatch(["a", "b"], ["a", "b"])).toBe(true);
    expect(barsMatch(["a", "b"], ["b", "a"])).toBe(false);
    expect(barsMatch([], ["a"])).toBe(false);
    expect(barsMatch(null, ["a"])).toBe(false);
  });

  it("maySaveVerified requires identity, bar agreement, and cacheable proof", () => {
    expect(
      maySaveVerified({
        liveIdentity: "x",
        resultSolveIdentity: "x",
        finalBar: ["a"],
        currentBar: ["a"],
        proofLabel: "heuristic-best-found",
      }),
    ).toBe(true);
    expect(
      maySaveVerified({
        liveIdentity: "x",
        resultSolveIdentity: "y",
        finalBar: ["a"],
        currentBar: ["a"],
        proofLabel: "heuristic-best-found",
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "x",
        resultSolveIdentity: "x",
        finalBar: ["a"],
        currentBar: ["a"],
      }),
    ).toBe(false);
    expect(
      maySaveVerified({
        liveIdentity: "x",
        resultSolveIdentity: "x",
        finalBar: ["a"],
        currentBar: ["a"],
        proofLabel: "degraded-exploratory-fallback",
      }),
    ).toBe(false);
  });

  it("recentLibraryVerifiedFields: degraded cannot verified recent; cacheable can", async () => {
    const loadout = { ...DEFAULT_LOADOUT };
    const { toResolvedCombatModel } = await import("./toResolvedCombatModel");
    const request = packSolverRequestFromUi({
      combatModel: toResolvedCombatModel(loadout),
      loadout,
      build: emptyBuild(),
      modelled: [],
      solverTier: "thorough",
      solverProfile: "balanced",
      limitToRegions: false,
      barSizePreset: "range4_11",
      now: 1_700_000_000_000,
    });
    const identity = solveContextPayload(request);
    const bar = ["a", "b", "c", "d", "e", "f"];
    const baseDto = {
      bar,
      score: 12_000,
      windowDpms: 0,
      evaluations: 100,
      uniqueCandidates: 40,
      seed: 1,
      profileId: "balanced" as const,
      tier: "thorough" as const,
      durationTicks: 500,
      solveIdentity: identity,
      bestFullScore: 12_000,
      top: [] as SolverResultDTO["top"],
    };

    expect(
      recentLibraryVerifiedFields(request, {
        ...baseDto,
        proofLabel: "heuristic-best-found",
        proof: { label: "heuristic-best-found" },
      }),
    ).toEqual({ verified: true, scoreContext: identity });

    expect(
      recentLibraryVerifiedFields(request, {
        ...baseDto,
        proofLabel: "degraded-exploratory-fallback",
        proof: { label: "degraded-exploratory-fallback" },
        bestFullScore: undefined,
      }),
    ).toEqual({ verified: false, scoreContext: null });
  });

  it("isCompletedResultStale when stamp diverges or is empty/missing", () => {
    expect(isCompletedResultStale({ liveIdentity: "a", resultSolveIdentity: "b" })).toBe(true);
    expect(isCompletedResultStale({ liveIdentity: "a", resultSolveIdentity: "a" })).toBe(false);
    expect(isCompletedResultStale({ liveIdentity: "a", resultSolveIdentity: "" })).toBe(true);
    expect(isCompletedResultStale({ liveIdentity: "a", resultSolveIdentity: null })).toBe(true);
    expect(isCompletedResultStale({ liveIdentity: "a", resultSolveIdentity: undefined })).toBe(
      true,
    );
  });

  it("keeps a completed result after its verified winner becomes the live bar", () => {
    expect(
      isCompletedResultStale({
        liveIdentity: "winner-bar-identity",
        resultSolveIdentity: "incumbent-bar-identity",
        sessionEnvironmentIdentity: "same-environment",
        liveEnvironmentIdentity: "same-environment",
        resultBar: ["a", "b"],
        currentBar: ["a", "b"],
      }),
    ).toBe(false);
    expect(
      isCompletedResultStale({
        liveIdentity: "winner-bar-identity",
        resultSolveIdentity: "incumbent-bar-identity",
        sessionEnvironmentIdentity: "before-loadout-change",
        liveEnvironmentIdentity: "after-loadout-change",
        resultBar: ["a", "b"],
        currentBar: ["a", "b"],
      }),
    ).toBe(true);
    expect(
      isCompletedResultStale({
        liveIdentity: "other-bar-identity",
        resultSolveIdentity: "incumbent-bar-identity",
        sessionEnvironmentIdentity: "same-environment",
        liveEnvironmentIdentity: "same-environment",
        resultBar: ["a", "b"],
        currentBar: ["b", "a"],
      }),
    ).toBe(true);
  });
});

describe("bar size presets → packer", () => {
  it("fixed four-slot UI request reaches packSolverRequest", () => {
    const spy = vi.fn(packSolverRequest);
    const loadout = { ...DEFAULT_LOADOUT };
    const model = toResolvedCombatModel(loadout, { now: 1_700_000_000_000 });
    const build = emptyBuild();
    const raw = barBoundsFromPreset("fixed4");
    expect(raw).toEqual({ minBarSize: 4, maxBarSize: 4 });

    const req = spy({
      model,
      style: model.style,
      build,
      tier: "thorough",
      profileId: "balanced",
      minBarSize: raw.minBarSize,
      maxBarSize: raw.maxBarSize,
      now: 1_700_000_000_000,
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ minBarSize: 4, maxBarSize: 4 }));
    expect(req.minBarSize).toBe(4);
    expect(req.maxBarSize).toBe(4);
    expect(clampedBarBoundsFromPreset("fixed4").minBarSize).toBe(4);
    expect(productBarSizeFloor()).toBe(4);
  });

  it("packSolverRequestFromUi passes fixed4 bounds into the packer", async () => {
    const loadout = { ...DEFAULT_LOADOUT };
    const { toResolvedCombatModel } = await import("./toResolvedCombatModel");
    const req = packSolverRequestFromUi({
      combatModel: toResolvedCombatModel(loadout),
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
    const modelled = revoManagedModelled(bar!, "dualwield");
    expect(Array.isArray(modelled)).toBe(true);
    expect(modelled.some((s) => s.id === "adaptive_strike_dw")).toBe(true);
  });

  it("mainhand loadout selects Adaptive MH even when dual reference bar is picked", () => {
    const bar = pickBarForLoadout("melee", "mainhand");
    expect(bar).toBeDefined();
    const modelled = revoManagedModelled(bar!, "mainhand");
    const adaptive = modelled.filter((s) => s.replacementGroup === "adaptive_strike");
    expect(adaptive.map((s) => s.id)).toEqual(["adaptive_strike_mh"]);
  });

  it("shield loadout models Adaptive as main-hand form", () => {
    const bar = pickBarForLoadout("melee", "shield");
    expect(bar).toBeDefined();
    const modelled = revoManagedModelled(bar!, "shield");
    const adaptive = modelled.filter((s) => s.replacementGroup === "adaptive_strike");
    expect(adaptive.map((s) => s.id)).toEqual(["adaptive_strike_mh"]);
  });

  it("ensureNecroConjuresOnBarIds injects wiki conjures when necro bar has none", () => {
    const raw = ["soul_sap", "touch_of_death"];
    const fixed = ensureNecroConjuresOnBarIds(raw, "necromancy", "necromancy");
    expect(fixed.some((id) => id.startsWith("conjure_"))).toBe(true);
    expect(fixed.slice(-2)).toEqual(raw);
    expect(ensureNecroConjuresOnBarIds(raw, "melee", "dualwield")).toEqual(raw);
    const withArmy = ensureNecroConjuresOnBarIds(
      ["conjure_undead_army", "soul_sap"],
      "necromancy",
      "necromancy",
    );
    expect(withArmy).toEqual(["conjure_undead_army", "soul_sap"]);
  });
});
