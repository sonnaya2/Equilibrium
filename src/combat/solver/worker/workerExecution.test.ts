import { describe, expect, it } from "vitest";
import { caseById } from "../benchmarks/cases";
import { runSolverOnMainThread } from "./host";
import type { SerializableRevolutionSimBase } from "./serializable";
import { executeWorkerSolve } from "./workerExecution";

function parityRequest() {
  const request = caseById("four-slot-fixed").build();
  const loadout = request.loadout as SerializableRevolutionSimBase;
  return {
    ...request,
    minBarSize: 1,
    maxBarSize: 1,
    durationTicks: 18,
    exploreDurationTicks: 6,
    permittedCategories: ["basic" as const],
    authoredSeedBars: [{ id: "worker-parity", abilityIds: ["attack"], baseline: true }],
    userBar: ["attack"],
    loadout: { ...loadout, abilityIds: ["attack"] },
  };
}

describe("solver worker execution parity", () => {
  it("matches main-thread solving after structured-clone revival", async () => {
    const request = parityRequest();
    const main = await runSolverOnMainThread(structuredClone(request));
    const worker = await executeWorkerSolve(structuredClone(request), {
      isCancelled: () => false,
      isPaused: () => false,
      yieldSlice: () => new Promise((resolve) => setTimeout(resolve, 0)),
    });

    expect(structuredClone(worker.result)).toEqual(main);
  }, 30_000);
});
