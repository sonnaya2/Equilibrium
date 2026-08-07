import { describe, expect, it } from "vitest";
import { simulate } from "../engine/simulation/simulate";
import { rotationOf } from "../engine/simulation/contracts";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { baseInput, rangedInput } from "../test/fixtures/inputs";
import { blessingHitEligibility, calculateLeagueAbility } from "./damage";
import { resolveLeagueRules } from "./ruleset";

/**
 * Abyssal Cinders: "On hit: Your attacks deal 15% of ability damage as bonus
 * damage. On hit: Your attacks have a 5% chance to trigger an Inferno of
 * Zamorak, which deals 100-200% ability damage to a single target."
 * (RuneScape Wiki, Equilibrium League/Blessings, verified 2026-08-02.)
 * Pre-release interpretation: poison, DoT, conjure, proc, and blessing damage are not attacks.

 * The "On hit" prefix is what makes the roll per landed hit rather than per
 * cast; every expected-application count below follows from that reading alone.
 */
const cinders = (derived: { maximumLife?: number } = {}) =>
  resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: ["Chaos", "Chaos"] }, derived);

const INFERNO_CHANCE = 0.05;
const INFERNOS_PER_HIT = INFERNO_CHANCE;
const CINDERS_RIDERS_PER_HIT = 1;

const infernoApplications = (summary: ReturnType<typeof simulate>) =>
  summary.events
    .filter((event) => event.abilityId === "inferno-of-zamorak")
    .reduce((sum, event) => sum + (event.expectedOccurrences ?? 1), 0);

const cindersRiders = (summary: ReturnType<typeof simulate>) =>
  summary.events
    .filter((event) => event.abilityId === "abyssal-cinders")
    .reduce((sum, event) => sum + (event.expectedOccurrences ?? 1), 0);

const ranged = (id: string) => RANGED_ABILITIES.find((ability) => ability.id === id)!;

const closed = { rider: false, cinders: false, onHit: false } as const;
const broadRider = { rider: true, cinders: false, onHit: false } as const;
const directOnHit = { rider: true, cinders: true, onHit: true } as const;

describe("Abyssal Cinders eligibility policy", () => {
  it("gives direct hits Big Boned, Cinders, and direct on-hit effects", () => {
    expect(blessingHitEligibility("direct", false)).toEqual(directOnHit);
  });

  it("gives damage-over-time ticks Big Boned but not Cinders", () => {
    expect(blessingHitEligibility("dot", false)).toEqual(broadRider);
  });

  it("gives conjure commands Big Boned but not Cinders", () => {
    expect(blessingHitEligibility("command", false)).toEqual(broadRider);
  });

  it("gives conjure auto and poison hits Big Boned but not Cinders", () => {
    expect(blessingHitEligibility("conjure", false)).toEqual(broadRider);
    expect(blessingHitEligibility({ kind: "conjure_auto" }, false)).toEqual(broadRider);
    expect(blessingHitEligibility({ kind: "conjure_poison" }, false)).toEqual(broadRider);
  });

  it("gives invention procs Big Boned but not Cinders", () => {
    expect(blessingHitEligibility({ kind: "invention_proc" }, false)).toEqual(broadRider);
    expect(blessingHitEligibility({ kind: "invention_proc", detail: "crackling" }, false)).toEqual(
      broadRider,
    );
    expect(blessingHitEligibility({ kind: "invention_proc", detail: "aftershock" }, false)).toEqual(
      broadRider,
    );
  });

  it.each(["proc", "blessing"] as const)("keeps %s hits out of Cinders", (source) => {
    expect(blessingHitEligibility(source, false)).toEqual(closed);
  });

  it("excludes attached components whatever their source, so hit counts stay honest", () => {
    for (const source of ["direct", "dot", "command", "conjure"] as const) {
      expect(blessingHitEligibility(source, true)).toEqual(closed);
    }
  });

  it("keeps attached riders and generic blessing hits closed", () => {
    expect(blessingHitEligibility("blessing", false)).toEqual(closed);
    expect(blessingHitEligibility("blessing", true)).toEqual(closed);
    expect(blessingHitEligibility({ kind: "blessing", detail: "big-boned" }, false)).toEqual(
      closed,
    );
    expect(blessingHitEligibility({ kind: "blessing", detail: "abyssal-cinders" }, false)).toEqual(
      closed,
    );
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "light-of-saradomin" }, true),
    ).toEqual(closed);
  });

  it("Light and Inferno hits host Big Boned without re-opening Cinders", () => {
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "light-of-saradomin" }, false),
    ).toEqual(broadRider);
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "inferno-of-zamorak" }, false),
    ).toEqual(broadRider);
  });
});

describe("Inferno of Zamorak rolls once from each direct attack hit", () => {
  it("uses one Bernoulli roll for a one-hit attack", () => {
    const summary = simulate({
      ...baseInput,
      league: cinders(),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(infernoApplications(summary)).toBeCloseTo(INFERNOS_PER_HIT, 10);
    expect(cindersRiders(summary)).toBeCloseTo(CINDERS_RIDERS_PER_HIT, 10);
  });

  it("scales the Bernoulli expectation per hit", () => {
    const twoHit = MELEE_ABILITIES.find((ability) => ability.hits.length === 2)!;
    const summary = simulate({
      ...baseInput,
      league: cinders(),
      startingAdrenaline: 100,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(twoHit.id),
    });
    expect(infernoApplications(summary)).toBeCloseTo(2 * INFERNOS_PER_HIT, 10);
    expect(cindersRiders(summary)).toBeCloseTo(2 * CINDERS_RIDERS_PER_HIT, 10);
  });

  it("includes all seven Greater Ricochet hits", () => {
    expect(ranged("greater_ricochet").hits).toHaveLength(7);
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    expect(infernoApplications(summary)).toBeCloseTo(7 * INFERNOS_PER_HIT, 10);
    expect(cindersRiders(summary)).toBeCloseTo(7 * CINDERS_RIDERS_PER_HIT, 10);
  });

  it("includes all eight Rapid Fire channel hits", () => {
    expect(ranged("rapid_fire").hits).toHaveLength(8);
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      startingAdrenaline: 100,
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("rapid_fire"),
    });
    expect(infernoApplications(summary)).toBeCloseTo(8 * INFERNOS_PER_HIT, 10);
    expect(cindersRiders(summary)).toBeCloseTo(8 * CINDERS_RIDERS_PER_HIT, 10);
  });

  it("excludes bleed ticks", () => {
    const dismember = MELEE_ABILITIES.find((ability) => ability.id === "dismember")!;
    const dotTicks = dismember.hits.filter((hit) => hit.dot).length;
    expect(dotTicks).toBeGreaterThan(0);
    const summary = simulate({
      ...baseInput,
      league: cinders(),
      crit: { chance: 0.2 },
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    expect(infernoApplications(summary)).toBe(0);
    expect(cindersRiders(summary)).toBe(0);
    const infernos = summary.events.filter((event) => event.abilityId === "inferno-of-zamorak");
    expect(infernos).toHaveLength(0);
  });

  it("excludes Crackling and Aftershock hits", () => {
    const summary = simulate({
      ...baseInput,
      league: cinders(),
      crit: { chance: 0 },
      context: { style: "melee", ruleset: "equilibrium" },
      procs: { cracklingRank: 4, aftershockRank: 1 },
      base: 50_000,
      cap: { cap: 30_000, bypass: true },
      rotation: rotationOf("attack"),
    });
    const procs = summary.events.filter(
      (event) => event.abilityId === "crackling" || event.abilityId === "aftershock",
    );
    expect(procs.length).toBeGreaterThan(0);
    for (const effectId of ["abyssal-cinders", "inferno-of-zamorak"]) {
      const derived = summary.events.filter(
        (event) =>
          event.abilityId === effectId &&
          event.derivedFrom !== undefined &&
          procs.some((proc) => proc.seq === event.derivedFrom),
      );
      expect(derived).toHaveLength(0);
    }
  });

  it("keeps each Inferno as one bounded Bernoulli event", () => {
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const generated = summary.events.filter((event) => event.blessingId);
    expect(generated.length).toBeGreaterThan(0);
    for (const event of generated) {
      expect(event.recursionAllowed).toBe(false);
      expect(event.procEligible).toBe(false);
    }
    const cindersEvents = generated.filter((e) => e.abilityId === "abyssal-cinders");
    expect(cindersEvents.length).toBe(7);
    for (const c of cindersEvents) {
      expect(c.attached).toBe(true);
      expect(c.expectedSeparateHits ?? 0).toBe(0);
      expect(c.damageTag).toBe("bonus-damage");
    }
    const infernos = generated.filter((e) => e.abilityId === "inferno-of-zamorak");
    expect(infernos).toHaveLength(7);
    for (const inf of infernos) {
      expect(inf.attached).toBe(false);
      expect(inf.expectedSeparateHits).toBeGreaterThan(0);
      expect(inf.occurrenceModel).toEqual({ kind: "bernoulli", probability: 0.05 });
    }
    expect(infernoApplications(summary)).toBeCloseTo(7 * INFERNOS_PER_HIT, 10);
    expect(cindersRiders(summary)).toBeCloseTo(7 * CINDERS_RIDERS_PER_HIT, 10);
    expect(generated).toHaveLength(14);
  });

  it("agrees between the Quick calculator and the simulator on application counts", () => {
    const league = cinders();
    const quick = calculateLeagueAbility(ranged("greater_ricochet"), {
      base: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      context: { style: "ranged", ruleset: "equilibrium" },
      rules: league,
    });
    const quickInferno = quick.leagueContributions
      .filter((component) => component.effectId === "inferno-of-zamorak")
      .reduce((sum, component) => sum + component.expectedOccurrences, 0);
    expect(quickInferno).toBeCloseTo(7 * INFERNOS_PER_HIT, 10);

    const summary = simulate({
      ...rangedInput,
      league,
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    expect(quickInferno).toBeCloseTo(infernoApplications(summary), 10);
    const quickCinders = quick.leagueContributions
      .filter((component) => component.effectId === "abyssal-cinders")
      .reduce((sum, component) => sum + component.expectedOccurrences, 0);
    expect(quickCinders).toBeCloseTo(cindersRiders(summary), 10);
  });

  it("uses the resolved base ability damage for Cinders and Inferno", () => {
    const contribution = (base: number, effectId: string) =>
      calculateLeagueAbility(ranged("greater_ricochet"), {
        base,
        level: 99,
        accuracy: 1,
        crit: { chance: 0 },
        context: { style: "ranged", ruleset: "equilibrium" },
        rules: cinders(),
      })
        .leagueContributions.filter((component) => component.effectId === effectId)
        .reduce((sum, component) => sum + component.damage.expected, 0);
    expect(
      contribution(1_020, "abyssal-cinders") / contribution(1_000, "abyssal-cinders"),
    ).toBeCloseTo(1.02, 10);
    expect(
      contribution(1_020, "inferno-of-zamorak") / contribution(1_000, "inferno-of-zamorak"),
    ).toBeCloseTo(1.02, 10);
  });

  it("reports expected activations and average damage per activation in the analysis", () => {
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      crit: { chance: 0.2 },
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const inferno = summary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")!;
    expect(inferno.expectedActivations).toBeCloseTo(7 * INFERNOS_PER_HIT, 10);
    expect(inferno.expectedTriggerRolls).toBeCloseTo(7 * CINDERS_RIDERS_PER_HIT, 10);
    expect(inferno.averagePerActivation).toBeGreaterThan(1_500);
    expect(inferno.totalDamage).toBeCloseTo(
      inferno.expectedActivations * inferno.averagePerActivation,
      6,
    );
  });

  it("keeps Big Boned and Cinders attached independently to the root hit", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance", "Chaos"] },
      { maximumLife: 15_000 },
    );
    const summary = simulate({
      ...baseInput,
      league,
      crit: { chance: 0 },
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const attack = summary.analysis.byEffect.find((row) => row.id === "attack")!;
    const cinders = summary.analysis.byEffect.find((row) => row.id === "abyssal-cinders")!;
    const inferno = summary.analysis.byEffect.find((row) => row.id === "inferno-of-zamorak")!;
    const bigBoned = summary.events.filter((event) => event.abilityId === "big-boned");
    expect(bigBoned).toHaveLength(2);
    expect(bigBoned.some((event) => event.bonusTargetId === "abyssal-cinders")).toBe(false);
    expect(attack.bonusDamage).toBeCloseTo(750 + 150, 6);
    expect(cinders.bonusDamage).toBe(0);
    expect(inferno.bonusDamage).toBeCloseTo(750 * INFERNO_CHANCE, 6);
  });
});

describe("Big Boned rides every qualifying damage instance", () => {
  // "All damage you deal gains 5% of your maximum life points as bonus damage."
  const bigBoned = resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: ["Balance"] },
    { maximumLife: 15_000 },
  );

  it("adds one component per hit of a multi-hit ability, not one per cast", () => {
    const summary = simulate({
      ...rangedInput,
      league: bigBoned,
      // Zero crit so the flat 5% of max life is exact.
      crit: { chance: 0 },
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const components = summary.events.filter((event) => event.abilityId === "big-boned");
    expect(components).toHaveLength(7);
    // 5% of 15,000 = 750 per hit, attached, tagged bonus-damage.
    for (const component of components) {
      expect(component.attached).toBe(true);
      expect(component.damageTag).toBe("bonus-damage");
      expect(component.damage.expected).toBe(750);
    }
  });

  it("inherits crits from crit-eligible parent hits", () => {
    const withCrit = simulate({
      ...rangedInput,
      league: bigBoned,
      crit: { chance: 0.2, damageBonus: 0 },
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const riders = withCrit.events.filter((event) => event.abilityId === "big-boned");
    expect(riders).toHaveLength(7);
    for (const rider of riders) {
      expect(rider.damageTag).toBe("bonus-damage");
      // Flat 5% of 15k is 750; crit-eligible EV must exceed that.
      expect(rider.damage.expected).toBeGreaterThan(750);
    }
    const bb = withCrit.analysis.byEffect.find((row) => row.id === "big-boned");
    expect(bb?.totalDamage).toBeGreaterThan(7 * 750);
    // Rider is not self-attributed in Bonus (would double-count vs parents).
    expect(bb?.bonusDamage).toBe(0);
    // Never classify as DoT - even when some parents are bleeds elsewhere.
    expect(bb?.dotDamage).toBe(0);
    // Parent skill shows how much Big Boned added on its hits.
    const gr = withCrit.analysis.byEffect.find((row) => row.id === "greater_ricochet");
    expect(gr?.bonusDamage).toBeCloseTo(bb?.totalDamage ?? 0, 6);
  });

  it("rides damage-over-time ticks too", () => {
    const dismember = MELEE_ABILITIES.find((ability) => ability.id === "dismember")!;
    const summary = simulate({
      ...baseInput,
      league: bigBoned,
      crit: { chance: 0.2 },
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    const riders = summary.events.filter((event) => event.abilityId === "big-boned");
    expect(riders).toHaveLength(dismember.hits.length);
    for (const rider of riders) {
      expect(rider.damage.critical).toMatchObject({ mode: "none", chance: 0, inherited: true });
    }
  });

  it("rides Crackling and Aftershock invention hit splats", () => {
    const summary = simulate({
      ...baseInput,
      league: bigBoned,
      crit: { chance: 0 },
      context: { style: "melee", ruleset: "equilibrium" },
      procs: { cracklingRank: 4, aftershockRank: 1 },
      base: 50_000,
      cap: { cap: 30_000, bypass: true },
      rotation: rotationOf("attack"),
    });
    const crackling = summary.events.filter((e) => e.abilityId === "crackling");
    const aftershock = summary.events.filter((e) => e.abilityId === "aftershock");
    expect(crackling.length).toBeGreaterThan(0);
    expect(aftershock.length).toBeGreaterThan(0);

    const bbOnCrackling = summary.events.filter(
      (e) =>
        e.abilityId === "big-boned" &&
        e.derivedFrom != null &&
        crackling.some((c) => c.seq === e.derivedFrom),
    );
    const bbOnAftershock = summary.events.filter(
      (e) =>
        e.abilityId === "big-boned" &&
        e.derivedFrom != null &&
        aftershock.some((a) => a.seq === e.derivedFrom),
    );
    expect(bbOnCrackling).toHaveLength(crackling.length);
    expect(bbOnAftershock).toHaveLength(aftershock.length);
    // 5% of 15_000 max life = 750 flat per invention splat.
    for (const rider of [...bbOnCrackling, ...bbOnAftershock]) {
      expect(rider.attached).toBe(true);
      expect(rider.damageTag).toBe("bonus-damage");
      expect(rider.damage.expected).toBe(750);
    }
  });
});

describe("base ruleset stays untouched", () => {
  it.each([
    ["melee attack", baseInput, "attack"],
    ["Greater Ricochet", rangedInput, "greater_ricochet"],
  ] as const)("produces no blessing events for %s", (_name, input, ability) => {
    const summary = simulate({ ...input, rotation: rotationOf(ability) });
    expect(summary.events.filter((event) => event.blessingId)).toHaveLength(0);
  });

  it("keeps totals identical with and without an inert ruleset object", () => {
    const withoutLeague = simulate({ ...rangedInput, rotation: rotationOf("greater_ricochet") });
    const withBaseRules = simulate({
      ...rangedInput,
      league: resolveLeagueRules({ ruleset: "base" }),
      rotation: rotationOf("greater_ricochet"),
    });
    expect(withBaseRules.totalExpected).toBe(withoutLeague.totalExpected);
    expect(withBaseRules.events.map((event) => event.abilityId)).toEqual(
      withoutLeague.events.map((event) => event.abilityId),
    );
  });
});
