import { describe, expect, it } from "vitest";
import {
  SAFE_GLOBAL_AGENT_CEILING,
  TIER_MAX_AGENTS,
  planWorkers,
  preferredAgentCount,
  recipesForTier,
} from "./workerPlan";

describe("workerPlan", () => {
  it("tier ceilings are Thorough 4 · Extreme 6 · Unhinged 8", () => {
    expect(TIER_MAX_AGENTS.thorough).toBe(4);
    expect(TIER_MAX_AGENTS.extreme).toBe(6);
    expect(TIER_MAX_AGENTS.unhinged).toBe(8);
    expect(SAFE_GLOBAL_AGENT_CEILING).toBe(8);
  });

  it("low-core hardware lowers agent count below tier ceiling", () => {
    expect(preferredAgentCount("thorough", 2)).toBe(2);
    expect(preferredAgentCount("extreme", 2)).toBe(2);
    expect(preferredAgentCount("unhinged", 2)).toBe(2);
  });

  it("high-core hardware is still capped by tier ceilings", () => {
    expect(preferredAgentCount("thorough", 32)).toBe(4);
    expect(preferredAgentCount("extreme", 32)).toBe(6);
    expect(preferredAgentCount("unhinged", 32)).toBe(8);
  });

  it("planWorkers keeps every assignment inside request bounds", () => {
    for (const range of [
      { minBarSize: 4, maxBarSize: 4 },
      { minBarSize: 4, maxBarSize: 6 },
      { minBarSize: 5, maxBarSize: 8 },
      { minBarSize: 8, maxBarSize: 10 },
      { minBarSize: 6, maxBarSize: 6 },
    ]) {
      const plan = planWorkers({
        ...range,
        tier: "unhinged",
        hardwareCores: 16,
        baseSeed: 7,
      });
      expect(plan.agentCount).toBe(8);
      for (const a of plan.assignments) {
        expect(a.minBarSize).toBeGreaterThanOrEqual(range.minBarSize);
        expect(a.maxBarSize).toBeLessThanOrEqual(range.maxBarSize);
        expect(a.minBarSize).toBe(a.maxBarSize);
        expect(a.targetLength).toBe(a.maxBarSize);
      }
    }
  });

  it("fixed 4..4 varies recipe/seed only — all lengths stay 4", () => {
    const plan = planWorkers({
      minBarSize: 4,
      maxBarSize: 4,
      tier: "extreme",
      hardwareCores: 16,
      baseSeed: 1,
    });
    expect(plan.agentCount).toBe(6);
    expect(plan.assignments.every((a) => a.minBarSize === 4 && a.maxBarSize === 4)).toBe(true);
  });

  it("assignments are unique by bounds + recipe + seed", () => {
    const plan = planWorkers({
      minBarSize: 4,
      maxBarSize: 4,
      tier: "unhinged",
      hardwareCores: 16,
      baseSeed: 42,
    });
    const keys = plan.assignments.map(
      (a) => `${a.minBarSize}:${a.maxBarSize}|${a.recipe}|${a.seed}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("thorough only uses default recipe; extreme adds evo; unhinged adds anneal", () => {
    expect([...recipesForTier("thorough")]).toEqual(["default"]);
    expect([...recipesForTier("extreme")]).toEqual(["default", "evolutionary"]);
    expect([...recipesForTier("unhinged")]).toEqual([
      "default",
      "evolutionary",
      "anneal_local",
    ]);

    const thorough = planWorkers({
      minBarSize: 4,
      maxBarSize: 10,
      tier: "thorough",
      hardwareCores: 16,
    });
    expect(thorough.assignments.every((a) => a.recipe === "default")).toBe(true);

    const extreme = planWorkers({
      minBarSize: 4,
      maxBarSize: 10,
      tier: "extreme",
      hardwareCores: 16,
    });
    expect(extreme.assignments.some((a) => a.recipe === "evolutionary")).toBe(true);
    expect(extreme.assignments.every((a) => a.recipe !== "anneal_local")).toBe(true);
  });

  it("respects explicit agents override but not above tier/global ceilings", () => {
    const plan = planWorkers({
      minBarSize: 5,
      maxBarSize: 8,
      tier: "thorough",
      hardwareCores: 16,
      agents: 99,
    });
    expect(plan.agentCount).toBe(4);
  });
});
