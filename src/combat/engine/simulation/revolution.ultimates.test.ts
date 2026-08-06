import { describe, expect, it } from "vitest";
import { firstLegalTick } from "../runtime/state";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { activateDeathsSwiftness, deathsSwiftnessActive } from "../../styles/ranged/effects";
import { activateSunshine, sunshineActive } from "../../styles/magic/effects";
import { createCastContext } from "./context";
import { simulateRevolution } from "./revolution";
import { castTimeline, diagnoseUltimateStarvation } from "./ultimateStarvation";

const base = { base: 1000, level: 99, accuracy: 1, crit: { chance: 0 } };
const ALL = [...MAGIC_ABILITIES, ...RANGED_ABILITIES];

function byId(id: string) {
  const a = ALL.find((x) => x.id === id);
  if (!a) throw new Error(`missing ability ${id}`);
  return a;
}

function revoMagic(
  barIds: string[],
  opts: { durationTicks: number; startingAdrenaline?: number; plantedFeet?: boolean },
) {
  const bar = barIds.map(byId);
  return {
    summary: simulateRevolution({
      ...base,
      abilities: ALL,
      bar,
      style: "magic",
      durationTicks: opts.durationTicks,
      startingAdrenaline: opts.startingAdrenaline ?? 0,
      plantedFeet: opts.plantedFeet,
    }),
    bar,
  };
}

function revoRanged(
  barIds: string[],
  opts: { durationTicks: number; startingAdrenaline?: number; plantedFeet?: boolean },
) {
  const bar = barIds.map(byId);
  return {
    summary: simulateRevolution({
      ...base,
      abilities: ALL,
      bar,
      style: "ranged",
      durationTicks: opts.durationTicks,
      startingAdrenaline: opts.startingAdrenaline ?? 0,
      plantedFeet: opts.plantedFeet,
    }),
    bar,
  };
}

describe("revolution ultimates — Sunshine", () => {
  it("casts Sunshine first from 100 adrenaline", () => {
    const { summary: s, bar } = revoMagic(["sunshine"], {
      durationTicks: 30,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("sunshine");
    expect(s.casts[0]?.tick).toBe(0);
    expect(s.casts[0]?.listedCost).toBe(100);
    expect(s.casts[0]?.adrenalineAfter).toBe(0);
    const d = diagnoseUltimateStarvation(s, bar, "sunshine");
    expect(d.castCount).toBeGreaterThanOrEqual(1);
    expect(d.priorityStarved).toBe(false);
  });

  it("eventually casts Sunshine from 0 when no higher spender starves it", () => {
    const { summary: s, bar } = revoMagic(["sunshine"], {
      durationTicks: 48,
      startingAdrenaline: 0,
    });
    expect(s.ok, s.error).toBe(true);
    const sun = s.casts.find((c) => c.abilityId === "sunshine");
    expect(sun, castTimeline(s.casts)).toBeDefined();
    expect(sun!.tick).toBe(36);
    expect(s.casts.slice(0, 12).every((c) => c.abilityId === "magic_attack" && c.auto)).toBe(true);
    expect(diagnoseUltimateStarvation(s, bar, "sunshine").unexplainedMiss).toBe(false);
  });

  it("strict priority: threshold above Sunshine starves the ultimate", () => {
    // Start at 100 so the higher slot is affordable on the first GCD.
    const { summary: s, bar } = revoMagic(["wild_magic", "sunshine"], {
      durationTicks: 120,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("wild_magic");
    expect(s.casts[0]?.adrenalineBefore).toBe(100);
    // From 0 with a 25% threshold above the ult, adren is drained forever (no banking).
    const from0 = revoMagic(["wild_magic", "sunshine"], {
      durationTicks: 120,
      startingAdrenaline: 0,
    });
    expect(from0.summary.casts.filter((c) => c.abilityId === "sunshine")).toHaveLength(0);
    const d = diagnoseUltimateStarvation(from0.summary, from0.bar, "sunshine");
    expect(d.priorityStarved, castTimeline(from0.summary.casts)).toBe(true);
    expect(d.maxAdrenalineBefore).toBeLessThan(100);
    expect(d.higherPrioritySpends).toBeGreaterThan(0);
    // Full-adren steal on the start-100 path.
    const steal = diagnoseUltimateStarvation(s, bar, "sunshine");
    expect(steal.prioritySteals.some((p) => p.tick === 0 && p.abilityId === "wild_magic")).toBe(
      true,
    );
  });

  it("moving Sunshine above the threshold fixes opener starvation at 100 adren", () => {
    // Strict priority: with Sunshine first and adren already 100, it fires before the threshold.
    // (A lower-priority threshold still drains when Sunshine is unaffordable from 0;
    // that is intentional no-banking, not "reservation".)
    const { summary: s, bar } = revoMagic(["sunshine", "wild_magic"], {
      durationTicks: 30,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("sunshine");
    expect(s.casts[0]?.tick).toBe(0);
    const d = diagnoseUltimateStarvation(s, bar, "sunshine");
    expect(d.castCount).toBeGreaterThanOrEqual(1);
    expect(d.priorityStarved).toBe(false);
  });

  it("casts Sunshine a second time after its 60s cooldown", () => {
    // CD ready-at is cast+100. GCD lattice after cast@0 is 3,6,...,99,102; first
    // legal GCD with CD ready is 102 (not 100, which is mid-GCD).
    const { summary: s, bar } = revoMagic(["sunshine"], {
      durationTicks: 106,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    const ticks = s.casts.filter((c) => c.abilityId === "sunshine").map((c) => c.tick);
    expect(ticks, castTimeline(s.casts)).toEqual([0, 102]);
    expect(ticks[1]! - ticks[0]!).toBeGreaterThanOrEqual(100);
    const d = diagnoseUltimateStarvation(s, bar, "sunshine");
    expect(d.minGapTicks).toBe(102);
  });

  it("horizon ends just before / after first Sunshine from 0", () => {
    const before = revoMagic(["sunshine"], { durationTicks: 36, startingAdrenaline: 0 });
    expect(before.summary.casts.filter((c) => c.abilityId === "sunshine")).toHaveLength(0);
    const after = revoMagic(["sunshine"], { durationTicks: 37, startingAdrenaline: 0 });
    expect(
      after.summary.casts.filter((c) => c.abilityId === "sunshine").map((c) => c.tick),
    ).toEqual([36]);
  });

  it("horizon ends just before / after second Sunshine", () => {
    const before = revoMagic(["sunshine"], { durationTicks: 102, startingAdrenaline: 100 });
    expect(
      before.summary.casts.filter((c) => c.abilityId === "sunshine").map((c) => c.tick),
    ).toEqual([0]);
    const after = revoMagic(["sunshine"], { durationTicks: 103, startingAdrenaline: 100 });
    expect(
      after.summary.casts.filter((c) => c.abilityId === "sunshine").map((c) => c.tick),
    ).toEqual([0, 102]);
  });
});

describe("revolution ultimates — Death's Swiftness", () => {
  it("casts Death's Swiftness first from 100 adrenaline", () => {
    const { summary: s } = revoRanged(["deaths_swiftness"], {
      durationTicks: 30,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("deaths_swiftness");
    expect(s.casts[0]?.tick).toBe(0);
    expect(s.casts[0]?.adrenalineAfter).toBe(0);
  });

  it("eventually casts Death's Swiftness from 0 when unstarved", () => {
    const { summary: s } = revoRanged(["deaths_swiftness"], {
      durationTicks: 48,
      startingAdrenaline: 0,
    });
    expect(s.ok, s.error).toBe(true);
    const ds = s.casts.find((c) => c.abilityId === "deaths_swiftness");
    expect(ds, castTimeline(s.casts)).toBeDefined();
    expect(ds!.tick).toBe(36);
  });

  it("strict priority: threshold above DS steals the full-adren opener", () => {
    const { summary: s, bar } = revoRanged(["corruption_shot", "deaths_swiftness"], {
      durationTicks: 30,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("corruption_shot");
    expect(s.casts[0]?.adrenalineBefore).toBe(100);
    const d = diagnoseUltimateStarvation(s, bar, "deaths_swiftness");
    expect(d.prioritySteals[0]).toMatchObject({
      tick: 0,
      abilityId: "corruption_shot",
      adrenalineBefore: 100,
    });
  });

  it("moving DS above the threshold fixes opener starvation at 100 adren", () => {
    const { summary: s, bar } = revoRanged(["deaths_swiftness", "corruption_shot"], {
      durationTicks: 30,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("deaths_swiftness");
    expect(diagnoseUltimateStarvation(s, bar, "deaths_swiftness").priorityStarved).toBe(false);
  });

  it("casts Death's Swiftness a second time after its 60s cooldown", () => {
    const { summary: s } = revoRanged(["deaths_swiftness"], {
      durationTicks: 106,
      startingAdrenaline: 100,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts.filter((c) => c.abilityId === "deaths_swiftness").map((c) => c.tick)).toEqual([
      0, 102,
    ]);
  });
});

describe("ultimate cooldowns — replacement group", () => {
  it("Sunshine and Greater Sunshine share the replacement-group clock", () => {
    const ctx = createCastContext({
      ...base,
      abilities: ALL,
      startingAdrenaline: 100,
    });
    const sun = byId("sunshine");
    ctx.performCast(sun, 0, false);
    expect(ctx.getState().cooldowns.sunshine).toBe(100);
    expect(ctx.getState().cooldowns.greater_sunshine).toBeUndefined();
    expect(ctx.firstLegalTick("sunshine")).toBe(100);
    expect(ctx.firstLegalTick("greater_sunshine")).toBe(100);
    // Peer readiness uses the same group key via firstLegalTick helper.
    expect(firstLegalTick(ctx.getState(), "greater_sunshine", "sunshine")).toBe(100);
  });

  it("Death's Swiftness and Greater DS share the replacement-group clock", () => {
    const ctx = createCastContext({
      ...base,
      abilities: ALL,
      startingAdrenaline: 100,
    });
    ctx.performCast(byId("deaths_swiftness"), 0, false);
    expect(ctx.getState().cooldowns.deaths_swiftness).toBe(100);
    expect(ctx.getState().cooldowns.greater_deaths_swiftness).toBeUndefined();
    expect(ctx.firstLegalTick("deaths_swiftness")).toBe(100);
    expect(ctx.firstLegalTick("greater_deaths_swiftness")).toBe(100);
  });

  it("group-keyed CD does not stick: second Sunshine casts after ready tick", () => {
    const { summary: s } = revoMagic(["sunshine"], {
      durationTicks: 106,
      startingAdrenaline: 100,
    });
    const ticks = s.casts.filter((c) => c.abilityId === "sunshine").map((c) => c.tick);
    expect(ticks[0]).toBe(0);
    expect(ticks[1]).toBeGreaterThanOrEqual(100);
    expect(ticks[1]).toBeLessThanOrEqual(102);
  });

  it("greater ability id shares group CD and recasts after ready tick", () => {
    // Ability id (greater_sunshine) differs from replacementGroup key (sunshine).
    const ctx = createCastContext({
      ...base,
      abilities: ALL,
      startingAdrenaline: 100,
    });
    ctx.performCast(byId("greater_sunshine"), 0, false);
    expect(ctx.getState().cooldowns.sunshine).toBe(100);
    expect(ctx.getState().cooldowns.greater_sunshine).toBeUndefined();
    expect(ctx.firstLegalTick("greater_sunshine")).toBe(100);

    const { summary: s } = revoMagic(["greater_sunshine"], {
      durationTicks: 106,
      startingAdrenaline: 100,
    });
    const ticks = s.casts.filter((c) => c.abilityId === "greater_sunshine").map((c) => c.tick);
    expect(ticks, castTimeline(s.casts)).toEqual([0, 102]);
  });
});

describe("ultimate buff windows — active ticks", () => {
  it("base and Planted Feet Sunshine have sourced active-tick counts", () => {
    const baseWin = activateSunshine(20);
    expect(baseWin.startsAtTick).toBe(21);
    expect(baseWin.expiresAtTick).toBe(71);
    expect(baseWin.expiresAtTick - baseWin.startsAtTick).toBe(50);
    expect(sunshineActive(baseWin, 20)).toBe(false);
    expect(sunshineActive(baseWin, 21)).toBe(true);
    expect(sunshineActive(baseWin, 70)).toBe(true);
    expect(sunshineActive(baseWin, 71)).toBe(false);

    const pf = activateSunshine(20, false, true);
    expect(pf.expiresAtTick - pf.startsAtTick).toBe(63);
    expect(sunshineActive(pf, 20)).toBe(false);
    expect(sunshineActive(pf, 21)).toBe(true);
    expect(sunshineActive(pf, 83)).toBe(true);
    expect(sunshineActive(pf, 84)).toBe(false);
  });

  it("base and Planted Feet Death's Swiftness have sourced active-tick counts", () => {
    const baseWin = activateDeathsSwiftness(20);
    expect(baseWin.expiresAtTick - baseWin.startsAtTick).toBe(50);
    expect(deathsSwiftnessActive(baseWin, 20)).toBe(false);
    expect(deathsSwiftnessActive(baseWin, 21)).toBe(true);
    expect(deathsSwiftnessActive(baseWin, 70)).toBe(true);
    expect(deathsSwiftnessActive(baseWin, 71)).toBe(false);

    const pf = activateDeathsSwiftness(20, false, true);
    expect(pf.expiresAtTick - pf.startsAtTick).toBe(63);
    expect(deathsSwiftnessActive(pf, 83)).toBe(true);
    expect(deathsSwiftnessActive(pf, 84)).toBe(false);
  });

  it("greater variants have sourced active-tick counts; Planted Feet is a no-op", () => {
    const gss = activateSunshine(10, true);
    expect(gss.expiresAtTick - gss.startsAtTick).toBe(64);
    expect(sunshineActive(gss, 10)).toBe(false);
    expect(sunshineActive(gss, 11)).toBe(true);
    expect(sunshineActive(gss, 74)).toBe(true);
    expect(sunshineActive(gss, 75)).toBe(false);
    expect(activateSunshine(10, true, true)).toEqual(gss);

    const gds = activateDeathsSwiftness(10, true);
    expect(gds.expiresAtTick - gds.startsAtTick).toBe(63);
    expect(deathsSwiftnessActive(gds, 10)).toBe(false);
    expect(deathsSwiftnessActive(gds, 11)).toBe(true);
    expect(deathsSwiftnessActive(gds, 73)).toBe(true);
    expect(deathsSwiftnessActive(gds, 74)).toBe(false);
    expect(activateDeathsSwiftness(10, true, true)).toEqual(gds);
  });

  it("cast-context windows match activator half-open bounds", () => {
    const ctx = createCastContext({
      ...base,
      abilities: ALL,
      startingAdrenaline: 100,
      plantedFeet: true,
    });
    ctx.performCast(byId("sunshine"), 0, false);
    const sun = ctx.getState().magic.sunshine;
    expect(sun.startsAtTick).toBe(1);
    expect(sun.expiresAtTick).toBe(64);
    expect(sun.expiresAtTick - sun.startsAtTick).toBe(63);

    const ranged = createCastContext({
      ...base,
      abilities: ALL,
      startingAdrenaline: 100,
    });
    ranged.performCast(byId("greater_deaths_swiftness"), 0, false);
    const ds = ranged.getState().ranged.swiftness;
    expect(ds.startsAtTick).toBe(1);
    expect(ds.expiresAtTick).toBe(64);
    expect(ds.expiresAtTick - ds.startsAtTick).toBe(63);
  });
});

describe("ultimate starvation diagnostic", () => {
  it("marks outsideManagedBar when the ultimate is not on the scanned bar", () => {
    const { summary: s, bar } = revoMagic(["wild_magic"], {
      durationTicks: 30,
      startingAdrenaline: 100,
    });
    const d = diagnoseUltimateStarvation(s, bar, "sunshine");
    expect(d.outsideManagedBar).toBe(true);
    expect(d.castCount).toBe(0);
    expect(d.priorityStarved).toBe(false);
  });

  it("reports max adrenaline and steals without inventing reservation", () => {
    const { summary: s, bar } = revoMagic(["wild_magic", "sunshine"], {
      durationTicks: 80,
      startingAdrenaline: 100,
    });
    const d = diagnoseUltimateStarvation(s, bar, "sunshine");
    expect(d.maxAdrenalineBefore).toBeGreaterThanOrEqual(100);
    expect(d.priorityStarved).toBe(true);
    expect(d.castCount).toBe(0);
  });
});
