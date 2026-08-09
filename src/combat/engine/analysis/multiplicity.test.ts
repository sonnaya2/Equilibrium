import { describe, expect, it } from "vitest";
import { simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { baseInput, rangedInput } from "../../test/fixtures/inputs";
import { resolveLeagueRules } from "../../league/ruleset";
import {
  expectedStatefulOccurrences,
  resolveEventMultiplicity,
  statefulOccurrenceProbability,
  statefulProcSuccessProbability,
} from "./multiplicity";
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
    provenance: { kind: "player_direct" },
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
      expectedTriggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      expectedAttachedComponents: 0,
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
          expectedTriggerRolls: 0,
        }),
      ),
    ).toEqual({
      expectedTriggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 0,
      expectedAttachedComponents: 1,
    });
  });

  it("maps a generic recursive proc to its geometric multiplicity", () => {
    expect(
      resolveEventMultiplicity(
        event({
          family: "blessing",
          abilityId: "recursive-proc",
          expectedOccurrences: 0.05 / 0.95,
          expectedTriggerRolls: 1 / 0.95,
          expectedActivations: 0.05 / 0.95,
          expectedSeparateHits: 0.05 / 0.95,
        }),
      ),
    ).toEqual({
      expectedTriggerRolls: 1 / 0.95,
      expectedActivations: 0.05 / 0.95,
      expectedSeparateHits: 0.05 / 0.95,
      expectedAttachedComponents: 0,
    });
  });

  it("legacy chance-weighted EV still implies one trigger roll", () => {
    expect(resolveEventMultiplicity(event({ expectedOccurrences: 0.05 }))).toEqual({
      expectedTriggerRolls: 1,
      expectedActivations: 0.05,
      expectedSeparateHits: 0.05,
      expectedAttachedComponents: 0,
    });
  });
});

describe("stateful occurrence models", () => {
  it("preserves exact event and proc probabilities for a recursive geometric hit", () => {
    const recursiveProc = event({
      occurrenceModel: {
        kind: "geometric",
        startProbability: 0.05,
        continuationProbability: 0.05,
      },
    });
    expect(expectedStatefulOccurrences(recursiveProc)).toBeCloseTo(0.05 / 0.95, 12);
    expect(statefulOccurrenceProbability(recursiveProc)).toBe(0.05);
    expect(statefulProcSuccessProbability(recursiveProc, 0.125)).toBeCloseTo(
      (0.05 * 0.125) / (1 - 0.05 * 0.875),
      12,
    );
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
      expectedTriggerRolls: 0,
      expectedActivations: 1,
      expectedSeparateHits: 1,
      expectedAttachedComponents: 0,
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
    const hosts = summary.events.filter((e) => e.abilityId === "greater_ricochet");
    expect(hosts).toHaveLength(7);
    for (const host of hosts) {
      const riders = host.components?.filter((component) => component.id === "big-boned");
      expect(riders).toHaveLength(1);
      expect(riders?.[0]).toMatchObject({
        attached: true,
        hitCapPolicy: "shared",
        analysis: {
          kind: "league-blessing",
          blessingId: "big-boned",
          expectedActivations: 1,
        },
      });
      expect(host.originKind).toBe("direct");
      expect(resolveEventMultiplicity(host)).toEqual({
        expectedTriggerRolls: 0,
        expectedActivations: 1,
        expectedSeparateHits: 1,
        expectedAttachedComponents: 1,
      });
    }
    const bb = summary.analysis.byEffect.find((row) => row.id === "big-boned");
    // Rider row: Total is the bonus; Bonus column stays 0 (not self-attributed).
    expect(bb?.totalDamage).toBeGreaterThan(0);
    expect(bb?.bonusDamage).toBe(0);
    // Parent skill shows rider total in its Bonus column only.
    const gr = summary.analysis.byEffect.find((row) => row.id === "greater_ricochet");
    expect(gr?.bonusDamage).toBeCloseTo(bb?.totalDamage ?? 0, 6);
    expect(gr?.bonusDamage).toBeGreaterThan(0);
  });

  it("Cinders on GR keeps attached riders and Bernoulli Inferno hits distinct", () => {
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const hosts = summary.events.filter((e) => e.abilityId === "greater_ricochet");
    const riders = hosts.flatMap(
      (host) => host.components?.filter((component) => component.id === "abyssal-cinders") ?? [],
    );
    const infernos = summary.events.filter((e) => e.abilityId === "inferno-of-zamorak");
    expect(riders).toHaveLength(7);
    expect(
      summary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")
        ?.expectedActivations,
    ).toBeCloseTo(7 * 0.05, 1);

    let expectedTriggerRolls = 0;
    let activations = 0;
    let separateHits = 0;
    for (const inferno of infernos) {
      expect(inferno.attached).toBe(false);
      expect(inferno.expectedTriggerRolls).toBe(1);
      expect(inferno.expectedOccurrences).toBe(1);
      expect(inferno.expectedActivations).toBe(1);
      expect(inferno.expectedSeparateHits).toBe(1);
      expect(inferno.occurrenceModel).toBeUndefined();
      expect(inferno.originKind).toBe("blessing");
      const mult = resolveEventMultiplicity(inferno);
      expectedTriggerRolls += mult.expectedTriggerRolls;
      activations += mult.expectedActivations;
      separateHits += mult.expectedSeparateHits;
    }
    expect(expectedTriggerRolls).toBe(infernos.length);
    expect(activations).toBe(infernos.length);
    expect(separateHits).toBe(infernos.length);

    for (const rider of riders) {
      expect(rider.attached).toBe(true);
      expect(rider.hitCapPolicy).toBe("shared");
      expect(rider.analysis).toMatchObject({
        kind: "league-blessing",
        blessingId: "abyssal-cinders",
        expectedActivations: 1,
      });
    }
    expect(
      hosts.every((host) => resolveEventMultiplicity(host).expectedAttachedComponents === 1),
    ).toBe(true);
    const cindersRow = summary.analysis.byEffect.find((row) => row.id === "abyssal-cinders");
    const gr = summary.analysis.byEffect.find((row) => row.id === "greater_ricochet");
    expect(cindersRow?.bonusDamage).toBe(0);
    expect(gr?.bonusDamage).toBeCloseTo(cindersRow?.totalDamage ?? 0, 6);
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

    const ridersOnDots = dots.flatMap(
      (event) => event.components?.filter((component) => component.id === "big-boned") ?? [],
    );
    expect(ridersOnDots.length).toBe(dotTicks);
    for (const rider of ridersOnDots) {
      expect(rider.attached).toBe(true);
      expect(rider.hitCapPolicy).toBe("shared");
      expect(rider.analysis?.expectedActivations).toBe(1);
    }
    expect(dots.every((event) => event.originKind === "dot")).toBe(true);
    expect(dots.every((event) => resolveEventMultiplicity(event).expectedSeparateHits === 1)).toBe(
      true,
    );
    // BB row: Total holds the damage; Bonus column is 0 (not self-tagged).
    // Global DoT total still includes riders on bleed ticks.
    const bb = summary.analysis.byEffect.find((row) => row.id === "big-boned");
    expect(bb?.totalDamage).toBeGreaterThan(0);
    expect(bb?.bonusDamage).toBe(0);
    expect(bb?.dotDamage).toBe(0);
    expect(summary.analysis.dotDamage).toBeGreaterThanOrEqual(bb?.totalDamage ?? 0);
    // Dismember shows bonus attributed onto the bleed skill only.
    const dis = summary.analysis.byEffect.find((row) => row.id === "dismember");
    expect(dis?.bonusDamage).toBeCloseTo(bb?.totalDamage ?? 0, 6);
  });
});
