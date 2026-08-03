import { describe, expect, it, vi } from "vitest";
import { planWorkers } from "@/combat/solver";
import {
  isLiveSolverSession,
  mayPublishStoppedPreview,
  mayWriteVerifiedSolveArtifacts,
  settlementActionForCatch,
  settlementActionForSolve,
  stoppedPreviewFromProgress,
} from "./revoPanelFormat";
import { seedProgressFromPlan } from "./useRevolutionSolver";

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
    expect(
      mayWriteVerifiedSolveArtifacts(
        settlementActionForSolve({
          sessionGen: 2,
          currentGen: 2,
          sessionIdentity: "s",
          currentIdentity: "s",
          cancelled: true,
          hasFinalDto: true,
        }),
      ),
    ).toBe(false);
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

    // Host applies only when mayPublishStoppedPreview — same as catch in the hook.
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
    expect(mayWriteVerifiedSolveArtifacts(action)).toBe(false);
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

    // Cancelled but identity drifted → ignore (no stopped publish).
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
});

describe("seedProgressFromPlan (real planWorkers path)", () => {
  it("fixed4 seed agents stay at length 4 — never invents full 4..10 ladder", () => {
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
    // Reported count equals plan launches — not tier ceiling alone when cores lower it.
    expect(progress.agentCount).toBeLessThanOrEqual(4);
    for (const a of progress.agents ?? []) {
      expect(a.barLength).toBe(4);
    }
    // No phantom longer bars from agentBarLength(i) product window.
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
