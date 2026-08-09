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
 * Unholy Critual Inferno: geometric chain forces intermediate outcomes true and
 * the terminal false. Chance stays at the Critual cap (0.5), never guaranteed.
 * Damage pins to the matching band - not EV blend, not double-pinned excess.
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

  it("pins continuing Infernos to critExpected and terminals to nonCritExpected", () => {
    let sawChain = false;
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
      const infernos = rt.events.filter((e) => e.abilityId === "inferno-of-zamorak");
      if (infernos.length < 2) continue;
      sawChain = true;
      const chains = new Map<number, typeof infernos>();
      for (const event of infernos) {
        const key = event.derivedFrom ?? -1;
        const list = chains.get(key) ?? [];
        list.push(event);
        chains.set(key, list);
      }
      for (const chain of chains.values()) {
        const terminal = chain.at(-1)!;
        expect(terminal.damage.critical?.outcome).toBe(false);
        // non-crit mid of 100-200% of base 1000
        expect(terminal.damage.expected).toBeCloseTo(1500, 10);
        expect(terminal.damage.expected).toBeLessThan(terminal.damage.critExpected ?? Infinity);
        for (const continuing of chain.slice(0, -1)) {
          expect(continuing.damage.critical?.outcome).toBe(true);
          expect(continuing.damage.expected).toBeCloseTo(continuing.damage.critExpected ?? 0, 10);
          // Regression: pre-pin + attachedMass double-count produced 3750 vs 3000.
          expect(continuing.damage.expected).toBeLessThanOrEqual(
            (continuing.damage.critExpected ?? 0) + 1e-9,
          );
        }
      }
      break;
    }
    expect(sawChain).toBe(true);
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
