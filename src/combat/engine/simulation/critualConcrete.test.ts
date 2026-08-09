import { describe, expect, it } from "vitest";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { rotationOf, type SimulateInput } from "./contracts";
import { simulate } from "./simulate";
import { resolveLeagueRules } from "../../league/ruleset";
import { baseInput, necroInput, rangedInput } from "../../test/fixtures/inputs";

const unholy = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
});

function laneRun(
  input: Omit<SimulateInput, "rotation">,
  abilityId: string,
  laneIndex: number,
  style: "melee" | "ranged" | "necromancy",
) {
  const rt = createRuntime(
    {
      ...input,
      league: unholy,
      crit: { chance: 0.5 },
      startingAdrenaline: input.startingAdrenaline ?? 100,
      context: { style, ruleset: "equilibrium" },
    },
    { laneIndex, laneCount: 128 },
  );
  const ability = rt.byId.get(abilityId);
  if (!ability) throw new Error(`missing ability ${abilityId}`);
  const attempt = performCast(rt, ability, 0, false);
  if (!attempt.ok) throw new Error(attempt.error);
  advanceTo(rt, rt.endTick);
  return rt;
}

describe("concrete Unholy Critual runtime", () => {
  it("matches p/(1-q) across 128 concrete single-parent histories", () => {
    const lanes = Array.from({ length: 128 }, (_, laneIndex) =>
      laneRun(baseInput, "attack", laneIndex, "melee"),
    );
    const infernoCounts = lanes.map(
      (rt) => rt.events.filter((event) => event.abilityId === "inferno-of-zamorak").length,
    );
    expect(infernoCounts.some((count) => count === 0)).toBe(true);
    expect(infernoCounts.some((count) => count > 0)).toBe(true);
    expect(infernoCounts.reduce((sum, count) => sum + count, 0) / lanes.length).toBeCloseTo(1, 0);
    for (const rt of lanes) {
      for (const event of rt.events.filter((entry) => entry.abilityId === "inferno-of-zamorak")) {
        expect(event.expectedOccurrences).toBe(1);
        expect(event.expectedActivations).toBe(1);
        expect(event.expectedSeparateHits).toBe(1);
        expect(event.occurrenceModel).toBeUndefined();
      }
    }
  });

  it("rolls Critual once per eligible Greater Ricochet hitsplat and orders chains", () => {
    const rt = laneRun(rangedInput, "greater_ricochet", 37, "ranged");
    const parents = rt.events.filter(
      (event) => event.abilityId === "greater_ricochet" && event.family === "hit",
    );
    const infernos = rt.events.filter((event) => event.abilityId === "inferno-of-zamorak");
    expect(parents).toHaveLength(7);
    expect(parents.every((event) => event.damage.critical?.outcome !== undefined)).toBe(true);
    expect(infernos.filter((event) => event.expectedTriggerRolls === 1).length).toBe(
      parents.filter((event) => event.damage.critical?.outcome === true).length,
    );
    const chains = new Map<number, typeof infernos>();
    for (const event of infernos) {
      const chain = chains.get(event.derivedFrom ?? -1) ?? [];
      chain.push(event);
      chains.set(event.derivedFrom ?? -1, chain);
    }
    for (const chain of chains.values()) {
      expect(chain.at(-1)?.damage.critical?.outcome).toBe(false);
      expect(chain.slice(0, -1).every((event) => event.damage.critical?.outcome)).toBe(true);
    }
  });

  it("inherits one parent result across Death Skulls bounces", () => {
    const rt = laneRun(necroInput, "death_skulls", 37, "necromancy");
    const skulls = rt.events.filter((event) => event.abilityId === "death_skulls");
    expect(skulls.length).toBeGreaterThan(1);
    expect(
      skulls
        .slice(1)
        .every((event) => event.damage.critical?.outcome === skulls[0]?.damage.critical?.outcome),
    ).toBe(true);
  });

  it("keeps DoT and poison provenance out of Critual", () => {
    const result = simulate({
      ...rangedInput,
      league: unholy,
      crit: { chance: 0.5 },
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("ranged_attack", "corruption_shot"),
    });
    expect(
      result.events
        .filter((event) => event.abilityId === "corruption_shot" || event.family === "poison")
        .every((event) => (event.damage.critical?.mode ?? "none") === "none"),
    ).toBe(true);
    expect(
      result.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak")?.expectedActivations,
    ).toBeCloseTo(1, 0);
  });
});
