import { afterEach, describe, expect, it } from "vitest";
import { calculateHit, type HitInput } from "../pipeline/calculateHit";
import {
  isHitPipelineProfilingEnabled,
  resetHitPipelineCounters,
  setHitPipelineProfiling,
  snapshotHitPipelineCounters,
} from "./hitPipeline";

const baseInput: HitInput = {
  base: 1000,
  band: { minPct: 110, maxPct: 130 },
  level: 90,
  accuracy: 1,
  crit: { chance: 0 },
};

describe("hitPipeline profiling counters", () => {
  afterEach(() => {
    resetHitPipelineCounters();
    setHitPipelineProfiling(false);
  });

  it("stays zero while disabled", () => {
    setHitPipelineProfiling(false);
    resetHitPipelineCounters();
    calculateHit(baseInput);
    expect(snapshotHitPipelineCounters()).toEqual({
      modifierSorts: 0,
      integerBandPoints: 0,
      hitExpectationCalls: 0,
      endpointPasses: 0,
    });
  });

  it("records sort-per-roll: one modifier sort per runPass", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    expect(isHitPipelineProfilingEnabled()).toBe(true);

    // Inclusive band 1100..1300 = 201 points. No crit, no cap clip.
    // Endpoints: min, max, uncappedMax noncrit, uncappedMax crit-null => 4.
    // Band walk: 1 exactMean x 201. Sorts = 4 + 201.
    const r = calculateHit(baseInput);
    expect(r.expected).toBe(1200);

    const snap = snapshotHitPipelineCounters();
    expect(snap.hitExpectationCalls).toBe(1);
    expect(snap.integerBandPoints).toBe(201);
    expect(snap.endpointPasses).toBe(4);
    expect(snap.modifierSorts).toBe(snap.endpointPasses + snap.integerBandPoints);
  });

  it("doubles band walk when crit expectation runs a second pass", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();

    calculateHit({ ...baseInput, crit: { chance: 0.5 } });
    const snap = snapshotHitPipelineCounters();
    // Endpoints: min, max, critMin, critMax, +2 uncapped max probes = 6.
    // Band: noncrit + crit exactMean = 402.
    expect(snap.hitExpectationCalls).toBe(1);
    expect(snap.integerBandPoints).toBe(402);
    expect(snap.endpointPasses).toBe(6);
    expect(snap.modifierSorts).toBe(408);
  });
});
