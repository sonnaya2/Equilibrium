import { describe, expect, it, vi } from "vitest";
import {
  isLiveSolverSession,
  mayWriteVerifiedSolveArtifacts,
  settlementActionForSolve,
  stoppedPreviewFromProgress,
} from "./revoPanelFormat";

/**
 * Hook ownership stays in useRevolutionSolver; settlement policy is pure so
 * cancel / stale / verified-write rules can be unit-tested without a React host.
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
    // New optimize bumped generation.
    expect(
      isLiveSolverSession({
        sessionGen: 1,
        currentGen: 2,
        sessionIdentity: "gear-a",
        currentIdentity: "gear-a",
      }),
    ).toBe(false);
    // Same gen, equipment/perks/target/bounds identity drifted.
    expect(
      isLiveSolverSession({
        sessionGen: 4,
        currentGen: 4,
        sessionIdentity: "before-perk-change",
        currentIdentity: "after-perk-change",
      }),
    ).toBe(false);
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

    apply(
      settlementActionForSolve({
        sessionGen: 1,
        currentGen: 1,
        sessionIdentity: "x",
        currentIdentity: "y",
        cancelled: false,
        hasFinalDto: true,
      }),
    );
    expect(remember).not.toHaveBeenCalled();
    expect(setFinal).not.toHaveBeenCalled();
    expect(setStopped).not.toHaveBeenCalled();
  });
});
