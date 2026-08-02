import { describe, expect, it } from "vitest";
import {
  agentSearchRecipe,
  configForTier,
  configPatchForRecipe,
} from "./solve";

describe("agentSearchRecipe", () => {
  it("blocks of 6: ensemble then evo then anneal", () => {
    for (let i = 0; i < 6; i++) {
      expect(agentSearchRecipe(i, "thorough")).toBe("default");
    }
    for (let i = 6; i < 12; i++) {
      expect(agentSearchRecipe(i, "extreme")).toBe("evolutionary");
    }
    for (let i = 12; i < 18; i++) {
      expect(agentSearchRecipe(i, "unhinged")).toBe("anneal_local");
    }
  });

  it("thorough only fills the ensemble block", () => {
    expect(agentSearchRecipe(5, "thorough")).toBe("default");
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
