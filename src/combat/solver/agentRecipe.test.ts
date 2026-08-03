import { describe, expect, it } from "vitest";
import { agentSearchRecipe, configForTier, configPatchForRecipe } from "./solve";

describe("agentSearchRecipe", () => {
  it("thorough stays ensemble-only across agent indices", () => {
    for (let i = 0; i < 8; i++) {
      expect(agentSearchRecipe(i, "thorough")).toBe("default");
    }
  });

  it("extreme cycles default and evolutionary", () => {
    expect(agentSearchRecipe(0, "extreme")).toBe("default");
    expect(agentSearchRecipe(1, "extreme")).toBe("evolutionary");
    expect(agentSearchRecipe(2, "extreme")).toBe("default");
  });

  it("unhinged cycles default, evolutionary, anneal_local", () => {
    expect(agentSearchRecipe(0, "unhinged")).toBe("default");
    expect(agentSearchRecipe(1, "unhinged")).toBe("evolutionary");
    expect(agentSearchRecipe(2, "unhinged")).toBe("anneal_local");
    expect(agentSearchRecipe(3, "unhinged")).toBe("default");
  });
});

describe("configPatchForRecipe", () => {
  it("default patch is empty", () => {
    expect(configPatchForRecipe("extreme", "default")).toEqual({});
  });

  it("evolutionary enables evo even on thorough and kills LNS/anneal", () => {
    const patch = configPatchForRecipe("thorough", "evolutionary");
    expect(patch.evoPopulation).toBeGreaterThan(0);
    expect(patch.evoGenerations).toBeGreaterThan(0);
    expect(patch.lnsRounds).toBe(0);
    expect(patch.annealSteps).toBe(0);
    const base = configForTier("thorough");
    expect(base.evoPopulation).toBe(0);
  });

  it("anneal_local kills evo/LNS and boosts anneal + local", () => {
    const base = configForTier("unhinged");
    const patch = configPatchForRecipe("unhinged", "anneal_local");
    expect(patch.evoPopulation).toBe(0);
    expect(patch.lnsRounds).toBe(0);
    expect(patch.annealSteps!).toBeGreaterThanOrEqual(base.annealSteps);
    expect(patch.localIterations!).toBeGreaterThanOrEqual(base.localIterations);
  });
});
