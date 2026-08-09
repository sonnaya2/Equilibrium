import { describe, expect, it } from "vitest";
import {
  RESERVES_UI_CORE,
  SAFE_GLOBAL_AGENT_CEILING,
  TIER_MAX_AGENTS,
  planWorkers,
  preferredAgentCount,
  recipesForTier,
  shouldReserveUiCore,
} from "./workerPlan";

describe("workerPlan", () => {
  it("tier ceilings are Thorough 4 · Extreme 6 · Unhinged 6", () => {
    expect(TIER_MAX_AGENTS.thorough).toBe(4);
    expect(TIER_MAX_AGENTS.extreme).toBe(6);
    expect(TIER_MAX_AGENTS.unhinged).toBe(6);
    expect(SAFE_GLOBAL_AGENT_CEILING).toBe(6);
  });

  it("low-core hardware lowers agent count below tier ceiling", () => {
    expect(preferredAgentCount("thorough", 2)).toBe(2);
    expect(preferredAgentCount("extreme", 2)).toBe(2);
    expect(preferredAgentCount("unhinged", 2)).toBe(2);
  });

  it("high-core hardware is still capped by tier ceilings", () => {
    expect(preferredAgentCount("thorough", 32)).toBe(4);
    expect(preferredAgentCount("extreme", 32)).toBe(6);
    expect(preferredAgentCount("unhinged", 32)).toBe(6);
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
      expect(plan.agentCount).toBe(6);
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
    expect([...recipesForTier("unhinged")]).toEqual(["default", "evolutionary", "anneal_local"]);

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

describe("RESERVES_UI_CORE capacity guard", () => {
  it("is true but only reserves when hardwareCores > tierMax + 1", () => {
    expect(RESERVES_UI_CORE).toBe(true);
    // cores=4 thorough (tierMax 4): naive cores-1 would drop to 3 and lower capacity.
    expect(shouldReserveUiCore(4, 4)).toBe(false);
    expect(preferredAgentCount("thorough", 4)).toBe(4);
    // cores=5 thorough: still no reserve (need > tierMax+1 = 5).
    expect(shouldReserveUiCore(4, 5)).toBe(false);
    expect(preferredAgentCount("thorough", 5)).toBe(4);
    // cores=6 thorough: reserve allowed; usable 5 still yields 4 agents.
    expect(shouldReserveUiCore(4, 6)).toBe(true);
    expect(preferredAgentCount("thorough", 6)).toBe(4);
    // low cores still limited by hardware, never by a forced reserve.
    expect(preferredAgentCount("thorough", 2)).toBe(2);
    expect(preferredAgentCount("unhinged", 6)).toBe(6);
    expect(shouldReserveUiCore(6, 6)).toBe(false);
    expect(shouldReserveUiCore(6, 8)).toBe(true);
    expect(preferredAgentCount("unhinged", 8)).toBe(6);
    expect(preferredAgentCount("unhinged", 10)).toBe(6);
  });
});
