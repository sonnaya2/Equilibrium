import { afterEach, describe, expect, it } from "vitest";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { withStrengthCape99Dismember } from "../styles/melee/abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "../shared/perks";
import {
  resetAllocationCounters,
  setAllocationProfiling,
  snapshotAllocationCounters,
} from "../profiling/allocation";
import { buildCandidatePool } from "./candidatePool";
import {
  compileEvaluationContext,
  compileEvaluationContextFromEvalRequest,
} from "./compiledContext";
import { evaluateRevolutionBar } from "./evaluate";

function basic(id: string, name: string, minPct: number, maxPct: number): AbilitySpec {
  return {
    id,
    name,
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct, maxPct } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 5.4,
  };
}

const auto: AbilitySpec = {
  id: "attack",
  name: "Attack",
  style: "melee",
  category: "basic",
  autoAttack: true,
  hits: [{ band: { minPct: 110, maxPct: 130 } }],
  adrenaline: { gain: 9 },
};

const dismember: AbilitySpec = {
  id: "dismember",
  name: "Dismember",
  style: "melee",
  category: "enhanced",
  hits: Array.from({ length: 8 }, (_, i) => ({
    band: { minPct: 20, maxPct: 40 },
    tickOffset: 2 + i * 2,
  })),
  adrenaline: { gain: 0 },
  cooldownSeconds: 15,
};

const alpha = basic("alpha", "Alpha", 100, 100);
const catalogue = [auto, alpha, dismember];

describe("compileEvaluationContext", () => {
  afterEach(() => {
    resetAllocationCounters();
    setAllocationProfiling(false);
  });

  it("builds catalogue + byId once and records a single allocation rebuild", () => {
    setAllocationProfiling(true);
    resetAllocationCounters();
    const pool = buildCandidatePool(catalogue, "melee");
    const compiled = compileEvaluationContext({
      style: "melee",
      pool,
      catalogue,
      strengthCape99: false,
    });
    expect(compiled.catalogue.some((a) => a.id === "attack")).toBe(true);
    expect(compiled.byId.get("alpha")).toBeDefined();
    expect(compiled.basicByStyle.get("melee")?.id).toBe("attack");
    expect(compiled.strengthCape99).toBe(false);
    expect(snapshotAllocationCounters().abilityMapRebuilds).toBe(1);
    expect(snapshotAllocationCounters().catalogueArrayRebuilds).toBe(1);
  });

  it("applies Strength Cape Dismember once so bar lookups are pre-patched", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    const oracle = withStrengthCape99Dismember(catalogue, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS).find(
      (a) => a.id === "dismember",
    )!;
    const compiled = compileEvaluationContext({
      style: "melee",
      pool,
      catalogue,
      strengthCape99: true,
    });
    expect(compiled.strengthCape99).toBe(true);
    const patched = compiled.byId.get("dismember");
    expect(patched?.hits).toHaveLength(oracle.hits.length);
    expect(patched?.hits.map((h) => h.tickOffset)).toEqual(oracle.hits.map((h) => h.tickOffset));
  });

  it("shared compiled across evals keeps abilityMapRebuilds at one", () => {
    setAllocationProfiling(true);
    resetAllocationCounters();
    const pool = buildCandidatePool(catalogue, "melee");
    const compiled = compileEvaluationContext({
      style: "melee",
      pool,
      catalogue,
      strengthCape99: false,
    });
    const sim = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: compiled.catalogue,
    };
    const a = evaluateRevolutionBar({
      bar: ["alpha"],
      style: "melee",
      durationTicks: 30,
      pool,
      sim,
      compiled,
      profileId: "balanced",
    });
    const b = evaluateRevolutionBar({
      bar: ["alpha", "dismember"],
      style: "melee",
      durationTicks: 30,
      pool,
      sim,
      compiled,
      profileId: "balanced",
    });
    const c = evaluateRevolutionBar({
      bar: ["dismember"],
      style: "melee",
      durationTicks: 30,
      pool,
      sim,
      compiled,
      profileId: "balanced",
    });
    expect(a.ok && b.ok && c.ok).toBe(true);
    expect(snapshotAllocationCounters().abilityMapRebuilds).toBe(1);
    expect(snapshotAllocationCounters().catalogueArrayRebuilds).toBe(1);
  });

  it("scores match one-shot compile vs explicit compiled path", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    const sim = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: catalogue,
      strengthCape99: true as const,
    };
    const standalone = evaluateRevolutionBar({
      bar: ["alpha", "dismember"],
      style: "melee",
      durationTicks: 50,
      pool,
      sim,
      profileId: "balanced",
    });
    const compiled = compileEvaluationContextFromEvalRequest({
      style: "melee",
      pool,
      sim,
    });
    const shared = evaluateRevolutionBar({
      bar: ["alpha", "dismember"],
      style: "melee",
      durationTicks: 50,
      pool,
      sim: { ...sim, abilities: compiled.catalogue },
      compiled,
      profileId: "balanced",
    });
    expect(standalone.ok).toBe(true);
    expect(shared.ok).toBe(true);
    expect(shared.score).toBeCloseTo(standalone.score, 10);
    expect(shared.summary?.totalExpected).toBeCloseTo(standalone.summary!.totalExpected!, 10);
  });
});
