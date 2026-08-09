import { describe, expect, it } from "vitest";
import { resolveLeagueRules } from "../../../league/ruleset";
import { MELEE_ABILITIES } from "../../../styles/melee/abilities";
import type { ScheduledEvent } from "../../runtime/events";
import { createRuntime, type SimulationRuntime } from "../../runtime/runtime";
import type { AttachedDamageComponent, EventResolution } from "../types";
import { applyBlessingDamage } from "./blessingDamage";
import { createStochasticOracle } from "../../runtime/stochastic";

function attached(id: "big-boned" | "abyssal-cinders", damage: number): AttachedDamageComponent {
  return {
    id,
    attached: true,
    hitCapPolicy: "shared",
    damage: { min: damage, max: damage, expected: damage },
    analysis: {
      kind: "league-blessing",
      blessingId: id,
      expectedActivations: 1,
    },
  };
}

describe("blessing damage event composition", () => {
  it("keeps attached terms on the host and schedules only the separate Inferno hit", () => {
    const laneIndex = Array.from({ length: 128 }, (_, value) => value).find((value) =>
      createStochasticOracle({ laneIndex: value, laneCount: 128 }).bernoulli(
        "blessing:cinders:0",
        0.05,
      ),
    );
    if (laneIndex === undefined) throw new Error("could not choose a Cinders-success lane");
    const rt = createRuntime(
      {
        base: 1_000,
        level: 99,
        accuracy: 1,
        crit: { chance: 0 },
        abilities: MELEE_ABILITIES,
        league: resolveLeagueRules(
          { ruleset: "equilibrium", blessingPicks: ["Balance", "Chaos"] },
          { maximumLife: 10_000 },
        ),
        context: { style: "melee", ruleset: "equilibrium" },
      },
      { laneIndex, laneCount: 128 },
    );
    const event: ScheduledEvent<SimulationRuntime> = {
      tick: 0,
      seq: 0,
      family: "hit",
      abilityId: "attack",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
    };
    const resolution: EventResolution = {
      damage: { min: 1_650, max: 1_650, expected: 1_650 },
      components: [attached("big-boned", 500), attached("abyssal-cinders", 150)],
    };

    const composed = applyBlessingDamage(rt, event, resolution);

    expect(composed).toEqual(resolution);
    expect(rt.queue.pending().map((pending) => pending.abilityId)).toEqual(["inferno-of-zamorak"]);
    const inferno = rt.queue.pending()[0]!;
    expect(inferno.expectedTriggerRolls).toBe(1);
    expect(inferno.expectedOccurrences).toBe(1);
    expect(inferno.expectedActivations).toBe(1);
    expect(inferno.expectedSeparateHits).toBe(1);
    expect(inferno.occurrenceModel).toBeUndefined();
    const infernoResolution = inferno.resolve(rt, inferno.tick);
    expect(infernoResolution.components?.map((component) => component.id)).toEqual(["big-boned"]);
  });
});
