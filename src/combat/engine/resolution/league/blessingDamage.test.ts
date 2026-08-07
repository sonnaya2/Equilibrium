import { describe, expect, it } from "vitest";
import { resolveLeagueRules } from "../../../league/ruleset";
import {
  resetHitPipelineCounters,
  setHitPipelineProfiling,
  snapshotHitPipelineCounters,
} from "../../../profiling/hitPipeline";
import { MELEE_ABILITIES } from "../../../styles/melee/abilities";
import type { ScheduledEvent } from "../../runtime/events";
import { createRuntime, type SimulationRuntime } from "../../runtime/runtime";
import { scheduleBlessingDamage } from "./blessingDamage";

describe("blessing damage component reuse", () => {
  it("calculates identical land-time components once per simulation input", () => {
    const rt = createRuntime({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MELEE_ABILITIES,
      league: resolveLeagueRules({
        ruleset: "equilibrium",
        blessingPicks: ["Chaos", "Chaos"],
      }),
      context: { style: "melee", ruleset: "equilibrium" },
    });
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
      expectedActivations: 0.25,
      provenance: { kind: "player_direct" },
      resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
    };
    const damage = { min: 500, max: 1000, expected: 750 };

    setHitPipelineProfiling(true);
    try {
      resetHitPipelineCounters();
      scheduleBlessingDamage(rt, event, damage);
      expect(snapshotHitPipelineCounters().hitExpectationCalls).toBeGreaterThan(0);
      expect(
        rt.queue.pending().find((pending) => pending.abilityId === "inferno-of-zamorak")
          ?.expectedTriggerRolls,
      ).toBeCloseTo(0.25, 10);

      resetHitPipelineCounters();
      scheduleBlessingDamage(rt, event, damage);
      expect(snapshotHitPipelineCounters().hitExpectationCalls).toBe(0);
    } finally {
      setHitPipelineProfiling(false);
    }
  });
});
