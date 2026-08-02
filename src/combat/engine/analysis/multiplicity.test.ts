import { describe, expect, it } from "vitest";
import { simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { baseInput, rangedInput } from "../../test/fixtures/inputs";
import { resolveLeagueRules } from "../../league/ruleset";
import { resolveEventMultiplicity } from "./multiplicity";
import type { ScheduledEvent } from "../runtime/events";

/** Minimal event shell for pure multiplicity resolution. */
function event(partial: Partial<ScheduledEvent>): ScheduledEvent {
  return {
    tick: 0,
    seq: 0,
    family: "hit",
    abilityId: "attack",
    sourceCast: 0,
    hitIndex: 0,
    attached: false,
    procEligible: true,
    recursionAllowed: false,
    resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
    ...partial,
  };
}

const cinders = () =>
  resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: ["Chaos", "Chaos"] });

const bigBoned = () =>
  resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: ["Balance"] },
    { maximumLife: 15_000 },
  );

describe("resolveEventMultiplicity defaults", () => {
  it("treats an ordinary deterministic direct hit as one separate hit, no rolls", () => {
    expect(resolveEventMultiplicity(event({}))).toEqual({
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      attachedComponents: 0,
    });
  });

  it("counts attached riders as attached components, not separate hits", () => {
    expect(
      resolveEventMultiplicity(
        event({
          attached: true,
          abilityId: "big-boned",
          family: "blessing",
          expectedOccurrences: 1,
          expectedActivations: 1,
          expectedSeparateHits: 0,
          triggerRolls: 0,
        }),
      ),
    ).toEqual({
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 0,
      attachedComponents: 1,
    });
  });

  it("maps one 5% Inferno roll to 1 trigger, 0.05 activations and separate hits", () => {
    expect(
      resolveEventMultiplicity(
        event({
          family: "blessing",
          abilityId: "inferno-of-zamorak",
          expectedOccurrences: 0.05,
          triggerRolls: 1,
          expectedActivations: 0.05,
          expectedSeparateHits: 0.05,
        }),
      ),
    ).toEqual({
      triggerRolls: 1,
      expectedActivations: 0.05,
      expectedSeparateHits: 0.05,
      attachedComponents: 0,
    });
  });

  it("legacy chance-weighted EV still implies one trigger roll", () => {
    expect(resolveEventMultiplicity(event({ expectedOccurrences: 0.05 }))).toEqual({
      triggerRolls: 1,
      expectedActivations: 0.05,
      expectedSeparateHits: 0.05,
      attachedComponents: 0,
    });
  });
});

describe("scheduled hit multiplicity and origin provenance", () => {
  it("one-hit ability: one separate hit on the ability event", () => {
    const summary = simulate({
      ...baseInput,
      rotation: rotationOf("attack"),
    });
    const hits = summary.events.filter((e) => e.abilityId === "attack" && !e.attached);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.originKind).toBe("direct");
    expect(resolveEventMultiplicity(hits[0]!)).toMatchObject({
      triggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      attachedComponents: 0,
    });
  });

  it("Greater Ricochet: seven separate hits, one cast", () => {
    const summary = simulate({
      ...rangedInput,
      rotation: rotationOf("greater_ricochet"),
    });
    const hits = summary.events.filter(
      (e) => e.abilityId === "greater_ricochet" && e.family === "hit" && !e.attached,
    );
    expect(hits).toHaveLength(7);
    const separate = hits.reduce(
      (sum, e) => sum + resolveEventMultiplicity(e).expectedSeparateHits,
      0,
    );
    expect(separate).toBe(7);
    expect(summary.casts).toHaveLength(1);
  });

  it("Big Boned attached metadata: zero separate hits, one attached component each", () => {
    const summary = simulate({
      ...rangedInput,
      league: bigBoned(),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const riders = summary.events.filter((e) => e.abilityId === "big-boned");
    expect(riders).toHaveLength(7);
    for (const rider of riders) {
      expect(rider.attached).toBe(true);
      expect(rider.damageTag).toBe("bonus-damage");
      expect(rider.originKind).toBe("direct");
      expect(rider.expectedSeparateHits).toBe(0);
      expect(rider.triggerRolls).toBe(0);
      expect(rider.expectedActivations).toBe(1);
      expect(resolveEventMultiplicity(rider)).toEqual({
        triggerRolls: 0,
        expectedActivations: 1,
        expectedSeparateHits: 0,
        attachedComponents: 1,
      });
    }
    const bb = summary.analysis.byEffect.find((row) => row.id === "big-boned");
    expect(bb?.bonusDamage).toBeGreaterThan(0);
    expect(bb?.bonusDamage).toBeCloseTo(bb?.totalDamage ?? 0, 6);
  });

  it("Cinders on GR: 7 riders, 7 Inferno trigger rolls, 0.35 expected activations", () => {
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const riders = summary.events.filter((e) => e.abilityId === "abyssal-cinders");
    const infernos = summary.events.filter((e) => e.abilityId === "inferno-of-zamorak");
    expect(riders).toHaveLength(7);
    expect(infernos).toHaveLength(7);

    let triggerRolls = 0;
    let activations = 0;
    let separateHits = 0;
    for (const inferno of infernos) {
      expect(inferno.attached).toBe(false);
      expect(inferno.triggerRolls).toBe(1);
      expect(inferno.expectedActivations).toBeCloseTo(0.05, 10);
      expect(inferno.expectedSeparateHits).toBeCloseTo(0.05, 10);
      expect(inferno.originKind).toBe("direct");
      const mult = resolveEventMultiplicity(inferno);
      triggerRolls += mult.triggerRolls;
      activations += mult.expectedActivations;
      separateHits += mult.expectedSeparateHits;
    }
    expect(triggerRolls).toBe(7);
    expect(activations).toBeCloseTo(0.35, 10);
    expect(separateHits).toBeCloseTo(0.35, 10);

    for (const rider of riders) {
      expect(rider.attached).toBe(true);
      expect(resolveEventMultiplicity(rider).expectedSeparateHits).toBe(0);
    }
  });

  it("DoT rider preserves originKind 'dot' from the parent bleed tick", () => {
    const dismember = MELEE_ABILITIES.find((a) => a.id === "dismember")!;
    const dotTicks = dismember.hits.filter((h) => h.dot).length;
    expect(dotTicks).toBeGreaterThan(0);

    const summary = simulate({
      ...baseInput,
      league: bigBoned(),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });

    const dots = summary.events.filter((e) => e.abilityId === "dismember" && e.family === "dot");
    expect(dots.length).toBe(dotTicks);
    for (const tick of dots) {
      expect(tick.originKind).toBe("dot");
    }

    const ridersOnDots = summary.events.filter(
      (e) =>
        e.abilityId === "big-boned" &&
        e.derivedFrom !== undefined &&
        dots.some((d) => d.seq === e.derivedFrom),
    );
    expect(ridersOnDots.length).toBe(dotTicks);
    for (const rider of ridersOnDots) {
      expect(rider.originKind).toBe("dot");
      expect(rider.attached).toBe(true);
      expect(resolveEventMultiplicity(rider).expectedSeparateHits).toBe(0);
    }
  });
});
