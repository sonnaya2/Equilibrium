import { describe, expect, it } from "vitest";
import { calculateAbility } from "../../pipeline/calculateAbility";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import { RANGED_ABILITIES, RANGED_EFFECTS } from "./abilities";

const byId = (id: string) => RANGED_ABILITIES.find((a) => a.id === id)!;

describe("ranged ability data", () => {
  it("every record carries a source and sane bands", () => {
    for (const a of RANGED_ABILITIES) {
      expect(a.source.verifiedAt, a.id).toBeTruthy();
      for (const h of a.hits) expect(h.band.minPct, a.id).toBeLessThanOrEqual(h.band.maxPct);
    }
    expect(new Set(RANGED_ABILITIES.map((a) => a.id)).size).toBe(RANGED_ABILITIES.length);
  });

  it("shadow tendrils is a guaranteed crit with the modernised band", () => {
    const tendrils = byId("shadow_tendrils");
    expect(tendrils.guaranteedCrit).toBe(true);
    expect(tendrils.hits[0]!.band).toEqual({ minPct: 200, maxPct: 240 });
    expect(tendrils.adrenaline?.cost).toBe(0);
    expect(tendrils.cooldownSeconds).toBe(45);
  });

  it("priority Revo / popular-set abilities carry wiki multi-hit bands", () => {
    expect(byId("piercing_shot").hits).toHaveLength(2);
    expect(byId("piercing_shot").hits[0]!.band).toEqual({ minPct: 45, maxPct: 55 });

    expect(byId("snap_shot").hits).toHaveLength(2);
    expect(byId("snap_shot").hits[0]!.band).toEqual({ minPct: 135, maxPct: 155 });
    expect(byId("snap_shot").adrenaline?.cost).toBe(25);

    expect(byId("snipe").hits[0]).toMatchObject({
      band: { minPct: 300, maxPct: 360 },
      tickOffset: 3,
    });

    expect(byId("rapid_fire").hits).toHaveLength(8);
    expect(byId("rapid_fire").hits.every((h) => h.band.minPct === 75 && h.band.maxPct === 85)).toBe(
      true,
    );
    expect(byId("rapid_fire").hits.map((h) => h.tickOffset)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    expect(byId("bombardment").hits[0]!.band).toEqual({ minPct: 220, maxPct: 260 });
    expect(byId("bombardment").adrenaline?.cost).toBe(25);

    expect(byId("deadshot").hits).toHaveLength(4);
    expect(byId("deadshot").hits[0]!.band).toEqual({ minPct: 105, maxPct: 125 });
    expect(byId("deadshot_igneous").hits).toHaveLength(8);
    expect(byId("deadshot_igneous").hits[0]!.band).toEqual({ minPct: 55, maxPct: 75 });
    expect(byId("deadshot").hits.every((h) => h.tickOffset === undefined)).toBe(true);
    expect(byId("deadshot_igneous").hits.every((h) => h.tickOffset === undefined)).toBe(true);
    expect(byId("snap_shot").hits.every((h) => h.tickOffset === undefined)).toBe(true);
    expect(byId("piercing_shot").hits.every((h) => h.tickOffset === undefined)).toBe(true);

    expect(byId("binding_shot").hits[0]!.band).toEqual({ minPct: 65, maxPct: 75 });
  });

  it("ricochet family models solo-target full return hits", () => {
    const rico = byId("ricochet");
    expect(rico.hits).toHaveLength(3);
    expect(rico.hits[0]!.band).toEqual({ minPct: 75, maxPct: 85 });
    expect(rico.hits[1]!.band).toEqual({ minPct: 15, maxPct: 20 });
    expect(rico.hits.map((h) => h.tickOffset)).toEqual([undefined, 1, 1]);

    const gr = byId("greater_ricochet");
    expect(gr.hits).toHaveLength(7);
    expect(gr.hits.slice(3).every((h) => h.band.minPct === 4 && h.band.maxPct === 6)).toBe(true);
    expect(gr.hits.map((h) => h.tickOffset)).toEqual([undefined, 1, 1, 1, 1, 1, 1]);
  });

  it("corruption shot decays 20% of initial band across 5 crit-ineligible hits", () => {
    const corr = byId("corruption_shot");
    expect(corr.hits).toHaveLength(5);
    expect(corr.hits[0]!.band).toEqual({ minPct: 90, maxPct: 110 });
    expect(corr.hits[1]!.band).toEqual({ minPct: 72, maxPct: 88 });
    expect(corr.hits[4]!.band).toEqual({ minPct: 18, maxPct: 22 });
    expect(corr.hits.every((h) => h.critEligible === false)).toBe(true);
    expect(corr.hits.map((h) => h.tickOffset)).toEqual([0, 2, 4, 6, 8]);
    const input = { base: 1000, level: 99, accuracy: 1, crit: { chance: 0 } };
    const result = calculateAbility(corr, input);
    expect(result.expected).toBeCloseTo(3000);
  });

  it("effect notes stay sourced; calculable priority abilities are not effect-only", () => {
    for (const e of RANGED_EFFECTS) expect(e.source.verifiedAt, e.id).toBeTruthy();
    for (const id of [
      "piercing_shot",
      "ricochet",
      "greater_ricochet",
      "snap_shot",
      "snipe",
      "rapid_fire",
      "bombardment",
      "deadshot",
      "corruption_shot",
      "binding_shot",
      "galeshot",
      "shadow_tendrils",
      "imbue_shadows",
      "deaths_swiftness",
      "greater_deaths_swiftness",
    ]) {
      expect(
        RANGED_ABILITIES.some((a) => a.id === id),
        id,
      ).toBe(true);
      expect(
        RANGED_EFFECTS.some((e) => e.id === id),
        id,
      ).toBe(false);
    }
  });

  it("wiki adrenaline and cooldowns for the post-CSM ranged kit", () => {
    expect(byId("ranged_attack").adrenaline).toEqual({ gain: 9 });
    expect(byId("ranged_attack").autoAttack).toBe(true);

    expect(byId("piercing_shot").adrenaline).toEqual({ gain: 9 });
    expect(byId("piercing_shot").cooldownSeconds).toBe(3);

    expect(byId("binding_shot").adrenaline).toEqual({ gain: 9 });
    expect(byId("binding_shot").cooldownSeconds).toBe(15);

    expect(byId("galeshot").adrenaline).toEqual({ gain: 9 });
    expect(byId("galeshot").cooldownSeconds).toBe(20.4);
    expect(byId("galeshot").appliesEffect).toBe("searing_winds");

    expect(byId("ricochet").adrenaline).toEqual({ gain: 9 });
    expect(byId("ricochet").cooldownSeconds).toBe(10.2);
    expect(byId("greater_ricochet").cooldownSeconds).toBe(10.2);

    expect(byId("snap_shot").adrenaline).toEqual({ cost: 25 });
    expect(byId("snap_shot").cooldownSeconds).toBe(1.8);

    expect(byId("snipe").adrenaline).toEqual({ cost: 0 });
    expect(byId("snipe").cooldownSeconds).toBe(60);
    expect(byId("snipe").category).toBe("enhanced");

    expect(byId("bombardment").adrenaline).toEqual({ cost: 25 });
    expect(byId("bombardment").cooldownSeconds).toBe(1.8);

    expect(byId("rapid_fire").adrenaline).toEqual({ cost: 25 });
    expect(byId("rapid_fire").cooldownSeconds).toBe(20.4);

    expect(byId("corruption_shot").adrenaline).toEqual({ cost: 20 });
    expect(byId("corruption_shot").cooldownSeconds).toBe(15);

    expect(byId("shadow_tendrils").adrenaline).toEqual({ cost: 0 });
    expect(byId("shadow_tendrils").cooldownSeconds).toBe(45);

    expect(byId("imbue_shadows").adrenaline).toEqual({ cost: 40 });
    expect(byId("imbue_shadows").cooldownSeconds).toBe(60);
    expect(byId("imbue_shadows").hits).toHaveLength(0);
    expect(byId("imbue_shadows").stateEffect).toBe("shadow_imbued");

    expect(byId("deadshot").adrenaline).toEqual({ cost: 60 });
    expect(byId("deadshot").cooldownSeconds).toBe(30);
    expect(byId("deadshot_igneous").adrenaline).toEqual({ cost: 60 });

    expect(byId("deaths_swiftness").adrenaline).toEqual({ cost: 100 });
    expect(byId("deaths_swiftness").cooldownSeconds).toBe(60);
    expect(byId("greater_deaths_swiftness").stateEffect).toBe("greater_deaths_swiftness");
  });

  it("does not ship CSM-removed abilities as calculable specs", () => {
    const removed = [
      "tight_bindings",
      "dazing_shot",
      "greater_dazing_shot",
      "demoralise",
      "rout",
      "needle_strike",
      "fragmentation_shot",
      "salt_the_wound",
      "unload",
      "incendiary_shot",
      "escape",
    ];
    for (const id of removed) {
      expect(
        RANGED_ABILITIES.some((a) => a.id === id),
        id,
      ).toBe(false);
    }
    expect(RANGED_EFFECTS.some((e) => e.id === "csm_removals")).toBe(true);
  });

  it("shadow tendrils crits guaranteed even at 0% crit chance", () => {
    const s = simulate({
      ...rangedInput,
      crit: { chance: 0 },
      rotation: rotationOf("shadow_tendrils"),
    });
    expect(s.casts[0].result.expected).toBeCloseTo(3299.7506234413963, 10);
  });
});
