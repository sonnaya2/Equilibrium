import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { activeEquipmentEffects } from "../../shared/equipment";
import {
  createStochasticOracle,
  hasDeathMarkApplicationOpportunity,
  hasRevolutionDeathMarkApplicationOpportunity,
  needsStochasticLanes,
  stochasticLaneCount,
} from "./stochastic";

const necromancyDirect: AbilitySpec = {
  id: "necro_direct",
  name: "Necromancy direct",
  style: "necromancy",
  category: "basic",
  hits: [{ band: { minPct: 90, maxPct: 110 } }],
};
const necromancyBounce: AbilitySpec = {
  id: "necro_bounce",
  name: "Necromancy bounce",
  style: "necromancy",
  category: "basic",
  hits: [{ band: { minPct: 90, maxPct: 110 }, dot: true }],
  derivedHits: { count: 1, intervalTicks: 1, firstOffset: 1, fractionPct: 50, dot: false },
};
const necromancyBasic: AbilitySpec = {
  id: "necro_basic",
  name: "Necromancy basic",
  style: "necromancy",
  category: "basic",
  basicAttack: true,
  hits: [{ band: { minPct: 90, maxPct: 110 } }],
};
const magicDirect: AbilitySpec = { ...necromancyDirect, id: "magic_direct", style: "magic" };
const deathdealer = {
  ...activeEquipmentEffects({ style: "necromancy" }),
  deathdealer: { physicalPieces: 5, effectivePieces: 5, applicationChance: 0.5 },
};

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

  it("requires a real active Necromancy application opportunity for Deathdealer", () => {
    expect(
      stochasticLaneCount({ abilities: [necromancyDirect], equipmentEffects: deathdealer }, []),
    ).toBe(1);
    expect(
      stochasticLaneCount({ abilities: [magicDirect], equipmentEffects: deathdealer }, [
        "magic_direct",
      ]),
    ).toBe(1);
    expect(
      stochasticLaneCount({ abilities: [necromancyDirect], equipmentEffects: deathdealer }, [
        "necro_direct",
      ]),
    ).toBe(128);
    expect(
      stochasticLaneCount({ abilities: [necromancyBounce], equipmentEffects: deathdealer }, [
        "necro_bounce",
      ]),
    ).toBe(128);
    expect(
      hasDeathMarkApplicationOpportunity({ abilities: [necromancyBasic], style: "necromancy" }, []),
    ).toBe(false);
    expect(
      hasRevolutionDeathMarkApplicationOpportunity(
        { abilities: [necromancyBasic], style: "necromancy" },
        [],
      ),
    ).toBe(true);
    expect(
      stochasticLaneCount(
        { abilities: [necromancyBasic], style: "necromancy", equipmentEffects: deathdealer },
        [],
      ),
    ).toBe(128);
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
