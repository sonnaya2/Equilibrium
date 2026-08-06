import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { baseInput } from "../fixtures/inputs";
import { lastCast } from "../helpers/summary";

describe("manual rotation timeline", () => {
  it("walks casts down the global cooldown and accumulates adrenaline", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack", "attack", "attack") });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6]);
    expect(s.casts[2].adrenalineAfter).toBe(27);
    expect(s.ticks).toBe(9);
    expect(s.totalExpected).toBeCloseTo(3 * 1200);
    expect(s.dps).toBeCloseTo(3600 / (9 * 0.6));
  });

  it("is deterministic and its contribution split sums to the total", () => {
    const rotation = rotationOf("attack", "attack", "rend", "attack", "assault");
    const a = simulate({ ...baseInput, rotation });
    const b = simulate({ ...baseInput, rotation });
    expect(a).toEqual(b);
    const split = Object.values(a.perAbility).reduce((n, x) => n + x, 0);
    expect(split).toBeCloseTo(a.totalExpected);
    expect(a.perAbility["attack"]).toBeCloseTo(3 * 1200);
  });

  it("bleed tails land on their sourced ticks and extend the timeline", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("dismember") });
    expect(s.ok).toBe(true);
    expect(s.ticks).toBe(17);
    expect(s.damageByTick[0]).toBeUndefined();
    for (let t = 2; t <= 16; t += 2) expect(s.damageByTick[t]).toBeCloseTo(300);
    expect(s.totalExpected).toBeCloseTo(8 * 300);
  });

  it("starts from the configured adrenaline and records listed, effective, and actual spend", () => {
    const s = simulate({
      ...baseInput,
      startingAdrenaline: 25,
      weaponConfiguration: "twohand",
      rotation: rotationOf("hurricane"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0]).toMatchObject({
      adrenalineBefore: 25,
      adrenalineAfter: 0,
      listedCost: 25,
      effectiveCost: 25,
      actualSpend: 25,
      refund: 0,
      adrenalineGained: 0,
    });
  });

  it("rejects starting adrenaline outside 0-100", () => {
    expect(() =>
      simulate({ ...baseInput, startingAdrenaline: -1, rotation: rotationOf("attack") }),
    ).toThrow(RangeError);
    expect(() =>
      simulate({ ...baseInput, startingAdrenaline: 101, rotation: rotationOf("attack") }),
    ).toThrow(RangeError);
  });

  it("applies the shared 30,000 cap in simulation and bypasses it only when disabled", () => {
    const capped = simulate({
      ...baseInput,
      base: 10_000,
      startingAdrenaline: 100,
      cap: { cap: 30_000 },
      rotation: rotationOf("overpower"),
    });
    const uncapped = simulate({
      ...baseInput,
      base: 10_000,
      startingAdrenaline: 100,
      cap: { cap: 30_000, bypass: true },
      rotation: rotationOf("overpower"),
    });
    expect(capped.casts[0].result.max).toBe(30_000);
    expect(capped.casts[0].result.expected).toBe(30_000);
    expect(uncapped.casts[0].result.max).toBe(57_000);
    expect(uncapped.casts[0].result.expected).toBeGreaterThan(30_000);
  });
});

describe("event log reconciles with the cast records", () => {
  it("reconciles per cast: non-attached hit/dot events sum to that cast's hit damage", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault", "dismember"),
    });
    expect(s.ok).toBe(true);
    s.casts.forEach((cast, i) => {
      const owned = s.events.filter(
        (e) => e.sourceCast === i && e.family !== "proc" && !e.attached,
      );
      const eventSum = owned.reduce((n, e) => n + e.damage.expected, 0);
      expect(cast.result.expected).toBeCloseTo(eventSum, 10);
      expect(cast.result.min).toBeCloseTo(
        owned.reduce((n, e) => n + e.damage.min, 0),
        10,
      );
      expect(cast.result.max).toBeCloseTo(
        owned.reduce((n, e) => n + e.damage.max, 0),
        10,
      );
      expect(cast.result.hits.reduce((n, h) => n + h.expected, 0)).toBeCloseTo(eventSum, 10);
    });
  });
});

describe("automatic Basic Attacks", () => {
  it("weaves basics through an adrenaline shortfall instead of failing", () => {
    const s = simulate({ ...baseInput, autoWeave: true, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(true);
    expect(s.casts).toHaveLength(8);
    expect(s.casts.slice(0, 7).every((c) => c.abilityId === "attack" && c.auto)).toBe(true);
    expect(s.casts[7].abilityId).toBe("overpower");
    expect(s.casts[7].tick).toBe(21);
    expect(s.casts[7].adrenalineAfter).toBe(63 - 60);
    expect(s.casts[7].auto).toBeUndefined();
  });

  it("manual mode still fails the same shortfall honestly", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("overpower") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("overpower needs 60% adrenaline");
  });

  it("weaves through cooldown gaps and builds Bloodlust from the woven basics", () => {
    const s = simulate({
      ...baseInput,
      autoWeave: true,
      rotation: rotationOf("assault", "assault"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "attack@0",
      "attack@3",
      "attack@6",
      "assault@9",
      "attack@17",
      "attack@20",
      "attack@23",
      "assault@26",
    ]);
    expect(s.casts[3].result.expected).toBeCloseTo(4 * 1400);
    expect(s.casts[7].result.expected).toBeCloseTo(4 * 1800);
  });

  it("weaves the upcoming style's own basic", () => {
    const s = simulate({
      ...baseInput,
      abilities: RANGED_ABILITIES,
      autoWeave: true,
      rotation: rotationOf("imbue_shadows"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.slice(0, 5).every((c) => c.abilityId === "ranged_attack" && c.auto)).toBe(true);
    expect(lastCast(s).abilityId).toBe("imbue_shadows");
    expect(lastCast(s).tick).toBe(15);
    expect(lastCast(s).adrenalineAfter).toBe(45 - 40);
  });

  it("merges Impatient outcomes between woven basics", () => {
    const expensive = {
      id: "expensive_ultimate",
      name: "Expensive ultimate",
      style: "melee" as const,
      category: "ultimate" as const,
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 90 },
    };
    const s = simulate({
      ...baseInput,
      abilities: [...MELEE_ABILITIES, expensive],
      autoWeave: true,
      adrenaline: { impatientRank: 4 },
      rotation: rotationOf(expensive.id),
    });
    expect(s.ok).toBe(true);
    expect(s.rng?.failedWeight).toBeUndefined();
    expect(lastCast(s).abilityId).toBe(expensive.id);
  });

  it("stops with an honest error when no weave can ever afford the cast", () => {
    const impossible = {
      id: "impossible_ult",
      name: "Impossible ult",
      style: "melee" as const,
      category: "ultimate" as const,
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 101 },
    };
    const s = simulate({
      ...baseInput,
      abilities: [...MELEE_ABILITIES, impossible],
      autoWeave: true,
      rotation: rotationOf("impossible_ult"),
    });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("unaffordable");
    // Permanent cost>cap: fail before weaving (not after MAX_AUTO_WEAVE_CASTS basics).
    expect(s.casts.every((c) => !c.auto)).toBe(true);
    expect(s.casts).toHaveLength(0);
    expect(s.totalExpected).toBe(0);
    expect(s.ticks).toBeLessThan(10);
  });

  it("fails immediately on a permanent weapon mismatch without weaving basics", () => {
    // Flurry is dualwield-only; twohand config can never satisfy it.
    const s = simulate({
      ...baseInput,
      weaponConfiguration: "twohand",
      autoWeave: true,
      rotation: rotationOf("flurry"),
    });
    expect(s.ok).toBe(false);
    expect(s.error).toMatch(/flurry requires dualwield/i);
    expect(s.casts).toHaveLength(0);
    expect(s.totalExpected).toBe(0);
    expect(s.ticks).toBeLessThan(10);
  });
});
