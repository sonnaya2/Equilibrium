import { describe, expect, it } from "vitest";
import {
  formatNumber,
  formatTime,
  partialDtoFromProgress,
  previewCategory,
  progressFillFromState,
  solverPhaseLabel,
  trackLiveClassName,
  workerRecipeGroupLabel,
} from "./revoPanelFormat";
import { pickBarForLoadout, revoManagedModelled, SUPPORTED_BARS } from "./revoBarResolve";

describe("revoPanelFormat", () => {
  it("labels solver phases for status chrome", () => {
    expect(solverPhaseLabel("seed")).toBe("Seeding");
    expect(solverPhaseLabel("finalize")).toBe("Scoring");
    expect(solverPhaseLabel("explore", { stopping: true })).toBe("Stopping");
  });

  it("maps ability categories for preview slots", () => {
    expect(previewCategory("enhanced")).toBe("threshold");
    expect(previewCategory("basic")).toBe("basic");
    expect(previewCategory(undefined)).toBeUndefined();
  });

  it("builds a partial DTO from live progress", () => {
    const dto = partialDtoFromProgress(
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
    expect(dto.bar).toEqual(["a", "b"]);
    expect(dto.score).toBe(200);
    expect(dto.bestExploratoryScore).toBe(100);
    expect(dto.proofLabel).toBe("stopped-early");
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
