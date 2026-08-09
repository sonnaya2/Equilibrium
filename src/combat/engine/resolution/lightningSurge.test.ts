import { describe, expect, it } from "vitest";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";
import { magicInput } from "../../test/fixtures/inputs";
import { createCastContext } from "../simulation/context";
import { resolveLeagueRules } from "../../league/ruleset";
import { activeEquipmentEffects } from "../../shared/equipment";

const tumekenEffects = activeEquipmentEffects({
  style: "magic",
  equipmentSlots: {
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
      ...magicInput,
      crit: { chance: 1 },
      rotation: rotationOf(...Array(6).fill("magic_attack"), "instability", "magic_attack"),
    });
    expect(s.ok).toBe(true);
    const instabilitySeq = s.casts.findIndex((c) => c.abilityId === "instability");
    const followSeq = s.casts.findIndex((c, i) => i > instabilitySeq);
    // The granting cast fires no surge: exactly one hit event, no proc.
    expect(s.events.filter((e) => e.sourceCast === instabilitySeq).map((e) => e.family)).toEqual([
      "hit",
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
    expect(s.casts[followSeq]!.result.expected).toBeCloseTo(2699.502487562189, 10);
    expect(s.casts[followSeq]!.result.hits).toHaveLength(1);
    expect(s.damageByTick[s.casts[followSeq]!.tick + 1]).toBeCloseTo(1199.7512437810944, 10);
  });

  it("checks Instability when the source hit lands, not when its cast starts", () => {
    const delayed = delayedMagicHit(5);
    const ctx = createCastContext({
      ...magicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, delayed],
    });
    ctx.performCast(delayed, 0, false);
    ctx.performCast(ctx.byId.get("instability")!, ctx.getState().tick, false);
    const summary = ctx.finish();
    expect(
      summary.events.filter((event) => event.family === "proc").map((event) => event.tick),
    ).toEqual([6]);
  });

  it("uses the half-open Instability window at the source hit boundary", () => {
    const lastActive = delayedMagicHit(46);
    const expired = delayedMagicHit(48);
    const active = simulate({
      ...magicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, lastActive],
      rotation: rotationOf("instability", lastActive.id),
    });
    expect(
      active.events.filter((event) => event.family === "proc").map((event) => event.tick),
    ).toEqual([50]);

    const inactive = simulate({
      ...magicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, expired],
      rotation: rotationOf("instability", expired.id),
    });
    expect(inactive.events.some((event) => event.family === "proc")).toBe(false);
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
      ...magicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, channel],
      rotation: rotationOf("instability", channel.id),
    });
    expect(s.events.filter((event) => event.family === "proc").map((event) => event.tick)).toEqual([
      4, 50,
    ]);
  });

  it("uses land-time Tumeken crit chance and Equilibrium suppression", () => {
    const tumeken = createCastContext({
      ...magicInput,
      crit: { chance: 0 },
      startingAdrenaline: 100,
      equipmentEffects: tumekenEffects,
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
      ...magicInput,
      crit: { chance: 1, disabled: true },
      startingAdrenaline: 50,
      equipmentEffects: tumekenEffects,
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
      ...magicInput,
      crit: { chance: 0.5 },
      cap: { cap: 1_000 },
      startingAdrenaline: 100,
      equipmentEffects: tumekenEffects,
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
      ...magicInput,
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
