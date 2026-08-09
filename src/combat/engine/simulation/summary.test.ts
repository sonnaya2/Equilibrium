import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import { performCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { combineStochasticSummaries, type StochasticLane } from "./summary";

function lane(laneIndex: number, laneCount: number, weight = 1 / laneCount): StochasticLane {
  return {
    weight,
    rt: createRuntime(baseInput, { laneIndex, laneCount }),
  };
}

describe("stochastic summary", () => {
  it("keeps failed lanes and unit mass in the primary total", () => {
    const first = lane(0, 2);
    const second = lane(1, 2);
    first.rt.totalExpected = first.rt.totalMin = first.rt.totalMax = 100;
    second.rt.totalExpected = second.rt.totalMin = second.rt.totalMax = 200;
    first.rt.damageByTick[0] = 100;
    second.rt.damageByTick[0] = 200;
    second.error = "synthetic failure";

    const result = combineStochasticSummaries([first, second], 1, undefined);

    expect(result.ok).toBe(false);
    expect(result.totalExpected).toBe(150);
    expect(result.rng).toMatchObject({
      lanes: 2,
      successfulLanes: 1,
      failedLanes: 1,
      probabilityMass: 1,
      residualWeight: 0,
      failedWeight: 0.5,
    });
    expect(result.failure).toMatchObject({
      failedWeight: 0.5,
      successfulWeight: 0.5,
      totalsScope: "unconditional-all-mass",
    });
  });

  it("uses the most common sampled history without presenting it as an expectation", () => {
    const lanes = [lane(0, 3), lane(1, 3), lane(2, 3)];
    const attack = lanes[0]!.rt.byId.get("attack")!;
    const dismember = lanes[2]!.rt.byId.get("dismember")!;
    expect(performCast(lanes[0]!.rt, attack, 0, false).ok).toBe(true);
    expect(performCast(lanes[1]!.rt, attack, 0, false).ok).toBe(true);
    expect(performCast(lanes[2]!.rt, dismember, 0, false).ok).toBe(true);

    const result = combineStochasticSummaries(lanes, undefined, undefined);

    expect(result.casts[0]?.abilityId).toBe("attack");
    expect(result.history).toMatchObject({
      kind: "representative-sample-history",
      historyWeight: 2 / 3,
      selectionReason: "most-common-history",
      eventsReconcileWithWeightedTotals: false,
    });
    expect(result.rng).toMatchObject({ lanes: 3, probabilityMass: 1, residualWeight: 0 });
  });
});
