import { describe, expect, it } from "vitest";
import { createStochasticOracle, needsStochasticLanes, stochasticLaneCount } from "./stochastic";

describe("counter-based stochastic oracle", () => {
  it("stratifies each Bernoulli opportunity across the fixed lanes", () => {
    const outcomes = Array.from({ length: 64 }, (_, laneIndex) =>
      createStochasticOracle({ laneIndex, laneCount: 64, seed: 17 }).bernoulli(
        "avernic-rampage",
        0.05,
      ),
    );

    expect(outcomes.filter(Boolean)).toHaveLength(3);
  });

  it("keeps streams independent and cloned counters deterministic", () => {
    const oracle = createStochasticOracle({ laneIndex: 7, laneCount: 64, seed: 23 });
    oracle.uniform("impatient");
    const copy = oracle.clone();

    expect(copy.uniform("impatient")).toBe(oracle.uniform("impatient"));
    expect(copy.uniform("relentless")).toBe(oracle.uniform("relentless"));
  });

  it("samples bounded binomial and geometric counts", () => {
    for (let laneIndex = 0; laneIndex < 64; laneIndex++) {
      const oracle = createStochasticOracle({ laneIndex, laneCount: 64, seed: 31 });
      expect(oracle.binomial("applications", 7, 0.175)).toBeGreaterThanOrEqual(0);
      expect(oracle.binomial("applications", 7, 0.175)).toBeLessThanOrEqual(7);
      expect(oracle.geometricSuccesses("continuation", 0.175)).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses one lane when no RNG can change later state", () => {
    expect(needsStochasticLanes({}, ["attack", "aftershock"])).toBe(false);
    expect(stochasticLaneCount({}, ["attack", "aftershock"])).toBe(1);
    expect(stochasticLaneCount({}, ["magic_attack"])).toBe(1);
  });

  it("uses the fixed ensemble for every supported state-changing RNG source", () => {
    const poison = {
      potion: "weapon-plus-plus-plus" as const,
      potionUntilTick: 100,
      kwuarmPotency: 0 as const,
      cinderbane: true,
      blowpipe: false,
      laniakea: false,
    };

    expect(stochasticLaneCount({ adrenaline: { impatientRank: 4 } }, ["attack"])).toBe(128);
    expect(stochasticLaneCount({ adrenaline: { relentlessRank: 5 } }, ["attack"])).toBe(128);
    expect(stochasticLaneCount({ playerPoison: poison }, ["attack"])).toBe(128);
    expect(
      stochasticLaneCount({ playerPoison: poison, targetPoisonImmune: true }, ["attack"]),
    ).toBe(1);
    expect(stochasticLaneCount({}, ["icy_tempest"])).toBe(128);
    expect(stochasticLaneCount({}, ["spectral_scythe"])).toBe(128);
    expect(stochasticLaneCount({}, ["tsunami"])).toBe(128);
    expect(stochasticLaneCount({}, ["instability"])).toBe(1);
    expect(stochasticLaneCount({}, ["instability", "tsunami"])).toBe(128);
  });

  it("honors an explicit diagnostic lane count", () => {
    expect(stochasticLaneCount({ adrenaline: { impatientRank: 4 } }, ["attack"], 7)).toBe(7);
    expect(() => stochasticLaneCount({}, ["attack"], 0)).toThrow(/positive integer/);
  });
});
