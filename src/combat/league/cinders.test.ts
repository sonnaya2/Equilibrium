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

 * The "On hit" prefix is what makes the roll per landed hit rather than per
 * cast; every expected-application count below follows from that reading alone.
 */
const cinders = (derived: { maximumLife?: number } = {}) =>
  resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: ["Chaos", "Chaos"] }, derived);

const infernoApplications = (summary: ReturnType<typeof simulate>) =>
  summary.events
    .filter((event) => event.abilityId === "inferno-of-zamorak")
    .reduce((sum, event) => sum + (event.expectedOccurrences ?? 1), 0);

const cindersRiders = (summary: ReturnType<typeof simulate>) =>
  summary.events.filter((event) => event.abilityId === "abyssal-cinders").length;

const ranged = (id: string) => RANGED_ABILITIES.find((ability) => ability.id === id)!;

const closed = { rider: false, cindersRider: false, onHit: false } as const;
const ridersNoOnHit = { rider: true, cindersRider: true, onHit: false } as const;
const ridersAndOnHit = { rider: true, cindersRider: true, onHit: true } as const;
/** Light/Inferno unique hits: BB yes, Cinders 15% no (not abilities). */
const bbOnlyNoOnHit = { rider: true, cindersRider: false, onHit: false } as const;

describe("Abyssal Cinders eligibility policy", () => {
  it("gives direct hits both riders and the on-hit roll", () => {
    expect(blessingHitEligibility("direct", false)).toEqual(ridersAndOnHit);
  });

  it("gives a damage-over-time tick the riders but no on-hit roll", () => {
    expect(blessingHitEligibility("dot", false)).toEqual(ridersNoOnHit);
  });

  it("gives a conjure command the riders but no on-hit roll", () => {
    expect(blessingHitEligibility("command", false)).toEqual(ridersNoOnHit);
  });

  it("gives conjure auto/poison the riders but no on-hit roll", () => {
    expect(blessingHitEligibility("conjure", false)).toEqual(ridersNoOnHit);
    expect(blessingHitEligibility({ kind: "conjure_auto" }, false)).toEqual(ridersNoOnHit);
    expect(blessingHitEligibility({ kind: "conjure_poison" }, false)).toEqual(ridersNoOnHit);
  });

  it("gives invention procs (Crackling/Aftershock) the riders but no on-hit roll", () => {
    expect(blessingHitEligibility({ kind: "invention_proc" }, false)).toEqual(ridersNoOnHit);
    expect(blessingHitEligibility({ kind: "invention_proc", detail: "crackling" }, false)).toEqual(
      ridersNoOnHit,
    );
    expect(blessingHitEligibility({ kind: "invention_proc", detail: "aftershock" }, false)).toEqual(
      ridersNoOnHit,
    );
  });

  // Legacy string "proc" maps to equipment_proc (still closed). Invention uses kind invention_proc.
  it.each(["proc", "blessing"] as const)("excludes %s damage entirely", (source) => {
    expect(blessingHitEligibility(source, false)).toEqual(closed);
  });

  it("excludes attached components whatever their source, so hit counts stay honest", () => {
    for (const source of ["direct", "dot", "command", "conjure"] as const) {
      expect(blessingHitEligibility(source, true)).toEqual(closed);
    }
  });

  it("cannot recurse onto generic blessing damage or attached riders", () => {
    expect(blessingHitEligibility("blessing", false)).toEqual(closed);
    expect(blessingHitEligibility("blessing", true)).toEqual(closed);
    expect(blessingHitEligibility({ kind: "blessing", detail: "big-boned" }, false)).toEqual(closed);
    expect(blessingHitEligibility({ kind: "blessing", detail: "abyssal-cinders" }, false)).toEqual(
      closed,
    );
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "light-of-saradomin" }, true),
    ).toEqual(closed);
  });

  it("Light/Inferno unique hits get Big Boned only (no Cinders 15%, no on-hit re-roll)", () => {
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "light-of-saradomin" }, false),
    ).toEqual(bbOnlyNoOnHit);
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "inferno-of-zamorak" }, false),
    ).toEqual(bbOnlyNoOnHit);
  });
});

describe("Inferno of Zamorak rolls once per qualifying landed hit", () => {
  it("expects 0.05 applications from a one-hit attack", () => {
    const summary = simulate({
      ...baseInput,
      league: cinders(),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(infernoApplications(summary)).toBeCloseTo(0.05, 10);
    // Cinders 15% on the ability hit only (not on Inferno - not an ability).
    expect(cindersRiders(summary)).toBe(1);
  });

  it("expects 0.10 applications from a two-hit ability", () => {
    const twoHit = MELEE_ABILITIES.find((ability) => ability.hits.length === 2)!;
    const summary = simulate({
      ...baseInput,
      league: cinders(),
      startingAdrenaline: 100,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(twoHit.id),
    });
    expect(infernoApplications(summary)).toBeCloseTo(0.1, 10);
    expect(cindersRiders(summary)).toBe(2);
  });

  it("expects 0.35 applications from Greater Ricochet's seven hits", () => {
    expect(ranged("greater_ricochet").hits).toHaveLength(7);
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    expect(infernoApplications(summary)).toBeCloseTo(0.35, 10);
    // One Cinders 15% attached rider per GR hit; Inferno is a unique hit without Cinders.
    expect(cindersRiders(summary)).toBe(7);
  });

  it("expects 0.40 applications from Rapid Fire's eight channel hits", () => {
    expect(ranged("rapid_fire").hits).toHaveLength(8);
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      startingAdrenaline: 100,
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("rapid_fire"),
    });
    expect(infernoApplications(summary)).toBeCloseTo(0.4, 10);
    expect(cindersRiders(summary)).toBe(8);
  });

  it("does not roll on a bleed's damage-over-time ticks, but still rides them", () => {
    const dismember = MELEE_ABILITIES.find((ability) => ability.id === "dismember")!;
    const dotTicks = dismember.hits.filter((hit) => hit.dot).length;
    expect(dotTicks).toBeGreaterThan(0);
    const summary = simulate({
      ...baseInput,
      league: cinders(),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    const directHits = dismember.hits.length - dotTicks;
    expect(infernoApplications(summary)).toBeCloseTo(0.05 * directHits, 10);
    // Cinders 15% on every dismember hit (including DoT ticks); none on Inferno.
    expect(cindersRiders(summary)).toBe(dismember.hits.length);
  });

  it("Inferno is a unique hit: no Cinders 15%, no Inferno-on-Inferno cascade", () => {
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
    // Cinders 15% is attached bonus, not a unique hit.
    const cindersEvents = generated.filter((e) => e.abilityId === "abyssal-cinders");
    expect(cindersEvents.length).toBe(7);
    for (const c of cindersEvents) {
      expect(c.attached).toBe(true);
      expect(c.expectedSeparateHits ?? 0).toBe(0);
      expect(c.damageTag).toBe("bonus-damage");
    }
    // Inferno is a unique hit; no Cinders rider derives from it.
    const infernos = generated.filter((e) => e.abilityId === "inferno-of-zamorak");
    expect(infernos.length).toBeGreaterThan(0);
    for (const inf of infernos) {
      expect(inf.attached).toBe(false);
      expect(inf.expectedSeparateHits).toBeGreaterThan(0);
    }
    const infernoSeqs = new Set(infernos.map((e) => e.seq));
    expect(
      generated.some(
        (e) => e.abilityId === "abyssal-cinders" && infernoSeqs.has(e.derivedFrom ?? -1),
      ),
    ).toBe(false);
    // Inferno never derives from another Inferno.
    for (const event of infernos) {
      expect(infernoSeqs.has(event.derivedFrom ?? -1)).toBe(false);
    }
    // Attached riders never host further blessing damage.
    const attachedRiderSeqs = new Set(
      generated.filter((event) => event.attached).map((event) => event.seq),
    );
    for (const event of generated) {
      expect(attachedRiderSeqs.has(event.derivedFrom ?? -1)).toBe(false);
    }
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
    expect(quickInferno).toBeCloseTo(0.35, 10);

    const summary = simulate({
      ...rangedInput,
      league,
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    expect(quickInferno).toBeCloseTo(infernoApplications(summary), 10);
    expect(quick.leagueContributions.filter((c) => c.effectId === "abyssal-cinders")).toHaveLength(
      cindersRiders(summary),
    );
  });

  it("reports expected activations and average damage per activation in the analysis", () => {
    const summary = simulate({
      ...rangedInput,
      league: cinders(),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const inferno = summary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")!;
    // 100-200% of 1,000 base averages 1,500 per activation.
    expect(inferno.expectedActivations).toBeCloseTo(0.35, 10);
    expect(inferno.triggerRolls).toBeCloseTo(7, 10);
    expect(inferno.averagePerActivation).toBeCloseTo(1_500, 0);
    expect(inferno.totalDamage).toBeCloseTo(0.35 * 1_500, 0);
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

  it("is crit-eligible bonus damage: non-zero crit chance raises expected above the flat 5%", () => {
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
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });
    expect(summary.events.filter((event) => event.abilityId === "big-boned")).toHaveLength(
      dismember.hits.length,
    );
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
