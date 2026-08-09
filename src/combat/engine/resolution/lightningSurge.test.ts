import { describe, expect, it } from "vitest";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";
import { fsoaMagicInput, magicInput } from "../../test/fixtures/inputs";
import { createCastContext } from "../simulation/context";
import { resolveLeagueRules } from "../../league/ruleset";
import { activeEquipmentEffects } from "../../shared/equipment";
import { calculateHit } from "../../pipeline/calculateHit";

const fsoaTumekenEffects = activeEquipmentEffects({
  style: "magic",
  equipmentSlots: {
    twohand: "item:fractured-staff-of-armadyl",
    helmet: "item:tumekens-resplendence-helm",
    body: "item:tumekens-resplendence-body",
    legs: "item:tumekens-resplendence-legs",
  },
});

function delayedMagicHit(tickOffset: number) {
  const attack = magicInput.abilities.find((ability) => ability.id === "magic_attack")!;
  return {
    ...attack,
    id: `delayed_magic_${tickOffset}`,
    hits: [{ ...attack.hits[0]!, tickOffset }],
  };
}

describe("Lightning Surge proc event", () => {
  it("schedules Instability's Lightning Surge as a proc event at sourceHitTick+1 (EV, non-recursive)", () => {
    const s = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      rotation: rotationOf(...Array(6).fill("magic_attack"), "instability", "magic_attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng?.lanes ?? 1).toBe(1);
    const instabilitySeq = s.casts.findIndex((c) => c.abilityId === "instability");
    const followSeq = s.casts.findIndex((c, i) => i > instabilitySeq);
    // Source: https://runescape.wiki/w/User%3ASfoxrs/sandbox/soa; this abstraction lands the candidate hit on the cast tick.
    // Instability's buff is active before its candidate hit in this abstraction.
    expect(s.events.filter((e) => e.sourceCast === instabilitySeq).map((e) => e.family)).toEqual([
      "hit",
      "proc",
    ]);
    const followEvents = s.events.filter((e) => e.sourceCast === followSeq);
    expect(followEvents.map((e) => e.family)).toEqual(["hit", "proc"]);
    const sourceHit = followEvents[0]!;
    // Source hit: boolean LS marker + castSnap (no nested lightningSurge.snap).
    expect(sourceHit.lightningSurge).toBe(true);
    expect(sourceHit.castSnap).toBeDefined();
    expect(sourceHit.castSnap!.castSeq).toBe(followSeq);
    const surge = followEvents[1]!;
    expect(surge.tick).toBe(s.casts[followSeq]!.tick + 1);
    expect(surge.procEligible).toBe(false);
    expect(surge.recursionAllowed).toBe(false);
    expect(surge.provenance).toEqual({ kind: "equipment_proc", detail: "lightning_surge" });
    expect(surge.lightningSurge).toBeUndefined();
    expect(surge.damage.expected).toBeCloseTo(1199.7512437810944, 10);
    expect(surge.damage.min).toBe(0);
    expect(surge.damage.max).toBe(0);
    // Hit events reconcile with the cast record; the surge EV lands in expected.
    expect(s.casts[followSeq]!.result.expected).toBeCloseTo(2899.2563913107733, 10);
    expect(s.casts[followSeq]!.result.hits).toHaveLength(1);
    expect(s.damageByTick[s.casts[followSeq]!.tick + 1]).toBeCloseTo(1199.7512437810944, 10);
  });

  it("checks Instability when the source hit lands, not when its cast starts", () => {
    const delayed = delayedMagicHit(5);
    const ctx = createCastContext({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, delayed],
    });
    ctx.performCast(delayed, 0, false);
    ctx.performCast(ctx.byId.get("instability")!, ctx.getState().tick, false);
    const summary = ctx.finish();
    // The schedule abstraction lands the candidate hit at its cast tick; this checks own-hit
    // eligibility and the sourced +1 proc delay, not an unsourced projectile offset.
    const procTicks = summary.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(procTicks).toHaveLength(2);
    expect(procTicks[0]).toBeLessThan(6);
    expect(procTicks[1]).toBe(6);
  });

  it("uses the half-open Instability window at the source hit boundary", () => {
    const lastActive = delayedMagicHit(46);
    const expired = delayedMagicHit(48);
    const active = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, lastActive],
      rotation: rotationOf("instability", lastActive.id),
    });
    const activeProcTicks = active.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(activeProcTicks).toHaveLength(2);
    expect(activeProcTicks.at(-1)).toBe(50);

    const inactive = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, expired],
      rotation: rotationOf("instability", expired.id),
    });
    const inactiveProcTicks = inactive.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(inactiveProcTicks).toHaveLength(1);
    expect(inactiveProcTicks[0]).toBeLessThan(48);
  });

  it("weights Surge critical contribution by source occurrence", () => {
    const sourceChance = 0.5;
    const s = simulate({
      ...fsoaMagicInput,
      crit: { chance: sourceChance },
      startingAdrenaline: 50,
      rotation: rotationOf("instability", "magic_attack"),
    });
    const source = s.events.find(
      (event) => event.abilityId === "magic_attack" && event.family === "hit",
    )!;
    const surge = s.events.find(
      (event) => event.family === "proc" && event.sourceCast === source.sourceCast,
    )!;
    const surgeHit = calculateHit({
      base: 1000,
      band: { minPct: 70, maxPct: 90 },
      level: 99,
      accuracy: 1,
      crit: { chance: sourceChance },
    });
    const expectedContribution =
      sourceChance * surgeHit.critChance * (surgeHit.critExpected - surgeHit.nonCritExpected);
    expect(surge.damage.expected).toBeCloseTo(sourceChance * surgeHit.expected, 10);
    expect(surge.damage.critical?.chance).toBeCloseTo(surgeHit.critChance, 10);
    expect(surge.damage.critical?.contribution).toBeCloseTo(expectedContribution, 10);
  });

  it("checks each channel hit against the Instability expiry tick", () => {
    const attack = magicInput.abilities.find((ability) => ability.id === "magic_attack")!;
    const channel = {
      ...attack,
      id: "expiry_crossing_channel",
      channelTicks: 48,
      hits: [0, 46, 47].map((tickOffset) => ({ ...attack.hits[0]!, tickOffset })),
    };
    const s = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, channel],
      rotation: rotationOf("instability", channel.id),
    });
    const procTicks = s.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(procTicks).toHaveLength(3);
    expect(procTicks).toContain(4);
    expect(procTicks).toContain(50);
    expect(procTicks).not.toContain(51);
  });

  it("does not inherit a channel parent hit-index bonus", () => {
    const attack = magicInput.abilities.find((ability) => ability.id === "magic_attack")!;
    const channel = {
      ...attack,
      id: "channelled_surge_source",
      channelTicks: 8,
      hits: [{ ...attack.hits[0]! }],
    };
    const equipmentEffects = activeEquipmentEffects({
      style: "magic",
      enchantments: ["metaphysics"],
      equipmentSlots: {
        twohand: "item:fractured-staff-of-armadyl",
        ring: "item:channelers-ring",
      },
    });
    const ctx = createCastContext({
      ...fsoaMagicInput,
      crit: { chance: 0 },
      startingAdrenaline: 75,
      abilities: [...magicInput.abilities, channel],
      equipmentEffects,
    });
    ctx.performCast(ctx.byId.get("instability")!, 0, false);
    ctx.performCast(channel, ctx.getState().tick, false);
    const summary = ctx.finish();
    const source = summary.events.find(
      (event) => event.abilityId === channel.id && event.family === "hit",
    );
    const surge = summary.events.find((event) => event.family === "proc");
    expect(source?.damage.critical?.chance).toBeGreaterThan(0);
    expect(surge?.damage.critical?.chance).toBe(0);
  });

  it("does not inherit parent guaranteed or ability-specific crit layers", () => {
    const ctx = createCastContext({
      ...fsoaMagicInput,
      crit: { chance: 0 },
      startingAdrenaline: 50,
    });
    ctx.performCast(ctx.byId.get("instability")!, 0, false);
    ctx.performCast(ctx.byId.get("smoke_tendrils")!, ctx.getState().tick, false);
    const smoke = ctx.finish();
    const smokeSource = smoke.events.find(
      (event) => event.abilityId === "smoke_tendrils" && event.family === "hit",
    );
    const smokeSurge = smoke.events.find(
      (event) => event.family === "proc" && event.sourceCast === smokeSource?.sourceCast,
    );
    expect(smokeSource?.damage.critical?.chance).toBe(1);
    expect(smokeSurge?.damage.critical?.chance).toBe(0);

    const wildContext = createCastContext({
      ...fsoaMagicInput,
      crit: { chance: 0 },
      startingAdrenaline: 75,
    });
    wildContext.performCast(wildContext.byId.get("instability")!, 0, false);
    wildContext.performCast(
      wildContext.byId.get("wild_magic")!,
      wildContext.getState().tick,
      false,
    );
    const wild = wildContext.finish();
    const wildSource = wild.events.find(
      (event) => event.abilityId === "wild_magic" && event.family === "hit",
    );
    const wildSurge = wild.events.find(
      (event) => event.family === "proc" && event.sourceCast === wildSource?.sourceCast,
    );
    expect(wildSource?.damage.critical?.chance).toBeCloseTo(0.1, 10);
    expect(wildSurge?.damage.critical?.chance).toBe(0);
  });

  it("uses land-time Tumeken crit chance and Equilibrium suppression", () => {
    const tumeken = createCastContext({
      ...fsoaMagicInput,
      crit: { chance: 0 },
      startingAdrenaline: 100,
      equipmentEffects: fsoaTumekenEffects,
      tumekensPieces: 3,
      adrenaline: { relentlessRank: 1 },
    });
    tumeken.performCast(tumeken.byId.get("instability")!, 0, false, { relentless: true });
    tumeken.performCast(tumeken.byId.get("sunshine")!, tumeken.getState().tick, false);
    tumeken.performCast(tumeken.byId.get("magic_attack")!, tumeken.getState().tick, false);
    const active = tumeken.finish();
    expect(active.casts.at(-1)!.result.hits[0].critChance).toBeCloseTo(0.045, 10);
    expect(active.events.some((event) => event.family === "proc")).toBe(true);

    const equilibrium = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1, disabled: true },
      startingAdrenaline: 50,
      equipmentEffects: fsoaTumekenEffects,
      tumekensPieces: 3,
      rotation: rotationOf("instability", "magic_attack"),
    });
    expect(equilibrium.casts.at(-1)!.result.hits[0].critChance).toBe(0);
    expect(equilibrium.events.some((event) => event.family === "proc")).toBe(false);
  });

  it("applies the Sunshine crit layer through the Unholy Critual cap", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
    });
    const ctx = createCastContext({
      ...fsoaMagicInput,
      crit: { chance: 0.5 },
      cap: { cap: 1_000 },
      startingAdrenaline: 100,
      equipmentEffects: fsoaTumekenEffects,
      tumekensPieces: 3,
      league,
      context: { style: "magic", ruleset: "equilibrium" },
    });
    ctx.performCast(ctx.byId.get("instability")!, 0, false, { relentless: true });
    ctx.performCast(ctx.byId.get("sunshine")!, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("magic_attack")!, ctx.getState().tick, false);
    const summary = ctx.finish();
    const surge = summary.events.find((event) => event.family === "proc");

    expect(surge).toBeDefined();
    // The source and surge are both at the 50% effective Critual cap. The raw
    // +4.5% Sunshine layer converts to crit damage and is then hit-capped.
    expect(surge!.damage.expected).toBeCloseTo(450, 10);
  });

  it("weights its separate hit and attached Big Boned host by the source crit chance", () => {
    const chance = 0.2;
    const summary = simulate({
      ...fsoaMagicInput,
      crit: { chance },
      league: resolveLeagueRules(
        { ruleset: "equilibrium", blessingPicks: ["Balance"] },
        { maximumLife: 10_000 },
      ),
      context: { style: "magic", ruleset: "equilibrium" },
      rotation: rotationOf(...Array(6).fill("magic_attack"), "instability", "magic_attack"),
    });
    const surge = summary.events.find((event) => event.family === "proc")!;
    const bigBoned = surge.components?.find((component) => component.id === "big-boned");

    expect(surge.expectedActivations).toBe(chance);
    expect(surge.expectedSeparateHits).toBe(chance);
    expect(bigBoned?.analysis?.expectedActivations).toBe(chance);
    expect(bigBoned?.damage.expected).toBeGreaterThan(0);
    expect(summary.events.some((event) => event.abilityId === "big-boned")).toBe(false);
  });
});
