import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { createStochasticOracle } from "../runtime/stochastic";
import { simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";

describe("crit outcome materialization", () => {
  it("single-lane oracle bernoulli rate is near p over many hits", () => {
    const oracle = createStochasticOracle({ laneIndex: 0, laneCount: 1, seed: 17 });
    const draws = Array.from({ length: 32 }, () => oracle.uniform("stream-a"));
    expect(draws.every((u) => u >= 0 && u < 1)).toBe(true);
    expect(new Set(draws.map((u) => u.toFixed(12))).size).toBeGreaterThan(1);
    expect(draws.every((u) => u === 0.5)).toBe(false);

    for (const p of [0.1, 0.35, 0.5, 0.8] as const) {
      const stream = createStochasticOracle({ laneIndex: 0, laneCount: 1, seed: 17 });
      const n = 400;
      const hits = Array.from({ length: n }, () => stream.bernoulli(`p-${p}`, p)).filter(Boolean)
        .length;
      const rate = hits / n;
      expect(rate, `p=${p}`).toBeGreaterThan(0);
      expect(rate, `p=${p}`).toBeLessThan(1);
      expect(Math.abs(rate - p), `p=${p}`).toBeLessThan(0.08);
    }
  });

  it("single-lane damage-only crit stays expected-value", () => {
    for (const chance of [0.1, 0.5, 0.55, 0.8] as const) {
      const rt = createRuntime(
        {
          base: 1000,
          level: 99,
          accuracy: 1,
          crit: { chance },
          abilities: MAGIC_ABILITIES,
          context: { style: "magic" },
          detailLevel: "full-analysis",
        },
        { laneIndex: 0, laneCount: 1, seed: 9 },
      );
      expect(performCast(rt, rt.byId.get("magic_attack")!, 0, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);
      const hit = rt.events.find((event) => event.family === "hit");
      expect(hit, `chance ${chance}`).toBeDefined();
      expect(hit!.damage.critical?.chance).toBeCloseTo(chance, 10);
      expect(hit!.damage.critical?.mode).toBe("expected");
      expect(hit!.damage.critical?.outcome).toBeUndefined();

      const detail = rt.hitDetails.get(hit!.seq);
      expect(detail, `chance ${chance}`).toBeDefined();
      expect(detail!.critOutcome).toBeUndefined();
      const critExpected = hit!.damage.critExpected ?? detail!.critExpected;
      const nonCritExpected = detail!.nonCritExpected;
      expect(critExpected, `chance ${chance}`).toBeDefined();
      const blended = (1 - chance) * nonCritExpected + chance * critExpected!;
      expect(hit!.damage.expected).toBeCloseTo(blended, 8);
    }
  });

  it("multi-lane land materializes a concrete bernoulli outcome on damage.critical", () => {
    const rt = createRuntime(
      {
        base: 1000,
        level: 99,
        accuracy: 1,
        crit: { chance: 0.5 },
        abilities: MAGIC_ABILITIES,
        context: { style: "magic" },
        detailLevel: "full-analysis",
      },
      { laneIndex: 0, laneCount: 128 },
    );
    expect(performCast(rt, rt.byId.get("magic_attack")!, 0, false).ok).toBe(true);
    advanceTo(rt, rt.endTick);
    const hit = rt.events.find((event) => event.family === "hit");
    expect(hit).toBeDefined();
    expect(hit!.damage.critical?.outcome === true || hit!.damage.critical?.outcome === false).toBe(
      true,
    );
  });

  it("default 10% magic auto keeps the same EV across single-lane seeds", () => {
    const totals: number[] = [];
    for (let seed = 0; seed < 40; seed++) {
      const summary = simulate(
        {
          base: 2456,
          level: 120,
          accuracy: 1,
          crit: { chance: 0.1, disabled: false, damageBonus: 0 },
          abilities: MAGIC_ABILITIES,
          context: { style: "magic" },
          rotation: rotationOf("magic_attack", "magic_attack", "magic_attack", "magic_attack"),
        },
        { stochasticLanes: 1, stochasticSeed: seed },
      );
      expect(summary.ok).toBe(true);
      for (const event of summary.events) {
        if (!event.damage.critical || event.damage.critical.mode === "none") continue;
        expect(event.damage.critical.chance).toBeCloseTo(0.1, 10);
        expect(event.damage.critical.mode).toBe("expected");
        expect(event.damage.critical.outcome).toBeUndefined();
      }
      totals.push(summary.totalExpected);
    }
    expect(new Set(totals.map((total) => total.toFixed(8))).size).toBe(1);
  });

  it("single-lane simulate at 80% crit retains expected outcomes", () => {
    const summary = simulate(
      {
        base: 2456,
        level: 120,
        accuracy: 1,
        crit: { chance: 0.8 },
        abilities: MAGIC_ABILITIES,
        context: { style: "magic" },
        rotation: rotationOf(
          "magic_attack",
          "magic_attack",
          "magic_attack",
          "magic_attack",
          "magic_attack",
          "magic_attack",
          "magic_attack",
          "magic_attack",
        ),
      },
      { stochasticLanes: 1, stochasticSeed: 3 },
    );
    expect(summary.ok).toBe(true);
    const critEvents = summary.events.filter(
      (event) => event.damage.critical && event.damage.critical.mode !== "none",
    );
    expect(critEvents.length).toBeGreaterThan(0);
    expect(critEvents.every((event) => event.damage.critical?.chance === 0.8)).toBe(true);
    expect(critEvents.every((event) => event.damage.critical?.mode === "expected")).toBe(true);
    expect(critEvents.every((event) => event.damage.critical?.outcome === undefined)).toBe(true);
  });
});
