import { describe, expect, it } from "vitest";
import { resolveLeagueRules } from "../../league/ruleset";
import { createRuntime } from "../runtime/runtime";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { baseInput } from "../../test/fixtures/inputs";

const unholy = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
});

const unholyWithBigBoned = resolveLeagueRules(
  { ruleset: "equilibrium", blessingPicks: ["Balance", "Order", "Order", "Order", "Chaos"] },
  { maximumLife: 10_000 },
);

/**
 * Unholy Critual Inferno: one Inferno per parent crit (no recursive chain).
 * Inferno crit chance stays at the Critual cap (0.5), never guaranteed.
 */
describe("Unholy Critual Inferno crit pin", () => {
  it("does not force every Inferno outcome true or chance >= 1", () => {
    const samples: {
      outcome: boolean | undefined;
      expected: number;
      critE: number | undefined;
      chance: number | undefined;
      mode: string | undefined;
    }[] = [];
    for (let lane = 0; lane < 128; lane++) {
      const rt = createRuntime(
        {
          ...baseInput,
          league: unholy,
          crit: { chance: 0.5 },
          context: { style: "melee", ruleset: "equilibrium" },
          startingAdrenaline: 100,
          detailLevel: "full-analysis",
        },
        { laneIndex: lane, laneCount: 128 },
      );
      expect(performCast(rt, rt.byId.get("attack")!, 0, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);
      for (const event of rt.events.filter((e) => e.abilityId === "inferno-of-zamorak")) {
        samples.push({
          outcome: event.damage.critical?.outcome,
          expected: event.damage.expected,
          critE: event.damage.critExpected,
          chance: event.damage.critical?.chance,
          mode: event.damage.critical?.mode,
        });
      }
    }
    expect(samples.length).toBeGreaterThan(0);
    const crits = samples.filter((s) => s.outcome === true);
    const nons = samples.filter((s) => s.outcome === false);
    expect(crits.length).toBeGreaterThan(0);
    expect(nons.length).toBeGreaterThan(0);
    expect(samples.every((s) => (s.chance ?? 0) < 1)).toBe(true);
    expect(samples.every((s) => s.mode !== "guaranteed")).toBe(true);
    expect(samples.every((s) => Math.abs((s.chance ?? 0) - 0.5) < 1e-9)).toBe(true);
  });

  it("schedules at most one Inferno per parent (no recursive chain)", () => {
    for (let lane = 0; lane < 128; lane++) {
      const rt = createRuntime(
        {
          ...baseInput,
          league: unholy,
          crit: { chance: 0.5 },
          context: { style: "melee", ruleset: "equilibrium" },
          startingAdrenaline: 100,
          detailLevel: "full-analysis",
        },
        { laneIndex: lane, laneCount: 128 },
      );
      expect(performCast(rt, rt.byId.get("attack")!, 0, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);
      const parents = rt.events.filter((e) => e.abilityId === "attack" && e.family === "hit");
      const infernos = rt.events.filter((e) => e.abilityId === "inferno-of-zamorak");
      expect(infernos.length).toBeLessThanOrEqual(parents.length);
      for (const parent of parents) {
        const children = infernos.filter((e) => e.derivedFrom === parent.seq);
        if (parent.damage.critical?.outcome === true) {
          expect(children).toHaveLength(1);
        } else {
          expect(children).toHaveLength(0);
        }
      }
    }
  });

  it("adds Big Boned once after concrete pin (no double shared rider)", () => {
    const samples: {
      outcome: boolean | undefined;
      expected: number;
      bbExpected: number | undefined;
    }[] = [];
    for (let lane = 0; lane < 128; lane++) {
      const rt = createRuntime(
        {
          ...baseInput,
          league: unholyWithBigBoned,
          crit: { chance: 0.5 },
          context: { style: "melee", ruleset: "equilibrium" },
          startingAdrenaline: 100,
          detailLevel: "full-analysis",
        },
        { laneIndex: lane, laneCount: 128 },
      );
      expect(performCast(rt, rt.byId.get("attack")!, 0, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);
      for (const event of rt.events.filter((e) => e.abilityId === "inferno-of-zamorak")) {
        const bb = event.components?.find((c) => c.id === "big-boned");
        samples.push({
          outcome: event.damage.critical?.outcome,
          expected: event.damage.expected,
          bbExpected: bb?.damage.expected,
        });
      }
    }
    const non = samples.find((s) => s.outcome === false);
    const crit = samples.find((s) => s.outcome === true);
    expect(non).toBeDefined();
    expect(crit).toBeDefined();
    // BB = floor(10000 * 0.05) = 500 non-crit; inherits host crit on crits.
    expect(non!.bbExpected).toBe(500);
    expect(non!.expected).toBeCloseTo(1500 + 500, 10);
    expect(crit!.bbExpected).toBeGreaterThan(0);
    expect(crit!.expected).toBeCloseTo(3000 + (crit!.bbExpected ?? 0), 10);
  });
});
