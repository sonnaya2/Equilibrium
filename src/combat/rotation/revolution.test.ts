import { describe, expect, it } from "vitest";
import { combatRevolutionBars, abilityById } from "../data";
import { resolveBar, specFromRecord } from "../data/specs";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { simulateRevolution } from "./revolution";

const ENGINE_SPECS = new Map(
  [...MELEE_ABILITIES, ...RANGED_ABILITIES, ...MAGIC_ABILITIES].map((spec) => [spec.id, spec]),
);

const baseInput = { base: 1000, level: 99, accuracy: 1, crit: { chance: 0 } };

describe("resolveBar", () => {
  it("prefers engine specs over record adapters for the same ability", () => {
    const meleeBar = combatRevolutionBars.records.find((bar) => bar.id === "melee-dual-wield")!;
    const slots = resolveBar(meleeBar, ENGINE_SPECS);
    const rend = slots.find((slot) => slot.name === "Rend")!;
    expect(rend.modelledBy).toBe("engine");
    expect(rend.spec?.id).toBe("rend");
    const flurry = slots.find((slot) => slot.name === "Flurry")!;
    expect(flurry.modelledBy).toBe("record");
    expect(flurry.spec?.hits).toHaveLength(8);
    expect(flurry.spec?.hits[0].band).toEqual({ minPct: 60, maxPct: 70 });
    const meteor = slots.find((slot) => slot.name === "Meteor Strike")!;
    expect(meteor.modelledBy).toBe("unmodelled");
    expect(meteor.spec).toBeNull();
  });

  it("resolves Adaptive Strike by weapon setup and Sacrifice to the bar's style", () => {
    const dw = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "melee-dual-wield")!, ENGINE_SPECS);
    expect(dw.find((slot) => slot.name === "Adaptive Strike")!.spec?.id).toBe("adaptive_strike_dw");
    const th = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "melee-two-handed")!, ENGINE_SPECS);
    expect(th.find((slot) => slot.name === "Adaptive Strike")!.spec?.id).toBe("adaptive_strike_2h");

    const ranged = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "ranged")!, ENGINE_SPECS);
    const sacrifice = ranged.find((slot) => slot.name === "Sacrifice")!;
    expect(sacrifice.modelledBy).toBe("record");
    expect(sacrifice.spec?.style).toBe("ranged");
  });

  it("never invents a spec for slots without sourced bands", () => {
    const magic = resolveBar(combatRevolutionBars.records.find((bar) => bar.id === "magic")!, ENGINE_SPECS);
    for (const name of ["Tsunami", "Omnipower", "Smoke Tendrils", "Dragon Breath"]) {
      expect(magic.find((slot) => slot.name === name)!.modelledBy).toBe("unmodelled");
    }
  });
});

describe("specFromRecord", () => {
  it("builds multi-hit specs from explicit record structure only", () => {
    const record = abilityById("magic:greater-concentrated-blast")!;
    const spec = specFromRecord(record)!;
    expect(spec.hits).toHaveLength(3);
    expect(spec.hits[0].band).toEqual({ minPct: 40, maxPct: 50 });
    expect(spec.adrenaline).toEqual({ gain: 9 });
    expect(spec.cooldownSeconds).toBeCloseTo(5.4, 5);
  });

  it("returns null for bandless records instead of fabricating damage", () => {
    expect(specFromRecord(abilityById("ranged:deadshot")!)).toBeNull();
  });
});

describe("simulateRevolution", () => {
  it("fires the first ready bar ability per slot and weaves basics through shortfalls", () => {
    const bar = combatRevolutionBars.records.find((candidate) => candidate.id === "magic")!;
    const modelled = resolveBar(bar, ENGINE_SPECS).filter((slot) => slot.spec !== null).map((slot) => slot.spec!);
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values(), ...modelled],
      bar: modelled,
      style: "magic",
      durationTicks: 120,
    });
    expect(s.ok).toBe(true);
    // Greater Sunshine leads the bar but is unaffordable at 0 adrenaline, so the
    // first ready slot further down fires instead — revolution skips, never waits.
    expect(s.casts[0].abilityId).toBe("magic:greater-concentrated-blast");
    expect(s.casts[0].tick).toBe(0);
    // Basics fill slots where nothing on the bar is ready.
    expect(s.casts.some((cast) => cast.abilityId === "magic_attack" && cast.auto)).toBe(true);
    // Cost abilities drain the pool whenever they are ready and affordable.
    expect(s.casts.some((cast) => cast.abilityId === "magic:wild-magic")).toBe(true);
    expect(s.casts.some((cast) => cast.abilityId === "magic:asphyxiate")).toBe(true);
  });

  it("pools basics until a lone ultimate is affordable, then fires it", () => {
    const sunshine = ENGINE_SPECS.get("greater_sunshine")!;
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [sunshine],
      style: "magic",
      durationTicks: 48,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.slice(0, 12).every((cast) => cast.abilityId === "magic_attack" && cast.auto)).toBe(true);
    expect(s.casts[12].abilityId).toBe("greater_sunshine");
    expect(s.casts[12].tick).toBe(36);
    // The 12th basic caps adrenaline at 100, so the 100% cost leaves nothing.
    expect(s.casts[12].adrenalineAfter).toBe(0);
  });

  it("honours priority order — the same abilities in a different order cast differently", () => {
    const bar = combatRevolutionBars.records.find((candidate) => candidate.id === "magic")!;
    const modelled = resolveBar(bar, ENGINE_SPECS).filter((slot) => slot.spec !== null).map((slot) => slot.spec!);
    const reversed = [...modelled].reverse();
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values(), ...reversed],
      bar: reversed,
      style: "magic",
      durationTicks: 24,
    });
    const sonicWave = s.casts.find((cast) => cast.abilityId === "magic:sonic-wave")!;
    expect(sonicWave.tick).toBe(0);
  });

  it("lands Combust burn hits on their sourced ticks past the horizon", () => {
    const combust = ENGINE_SPECS.get("combust")!;
    const s = simulateRevolution({
      ...baseInput,
      abilities: [...ENGINE_SPECS.values()],
      bar: [combust],
      style: "magic",
      durationTicks: 6,
    });
    expect(s.ok).toBe(true);
    const burnTicks = Object.keys(s.damageByTick).map(Number).filter((tick) => tick > 0);
    expect(Math.max(...burnTicks)).toBeGreaterThan(6);
  });
});
