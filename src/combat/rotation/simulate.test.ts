import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { rotationOf } from "./actions";
import { simulate, type SimulateInput } from "./simulate";

const baseInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

describe("simulate", () => {
  it("walks casts down the global cooldown and accumulates adrenaline", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack", "attack", "attack") });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6]);
    expect(s.casts[2].adrenalineAfter).toBe(27);
    expect(s.ticks).toBe(9);
    expect(s.totalExpected).toBeCloseTo(3 * 1200);
    expect(s.dps).toBeCloseTo(3600 / (9 * 0.6));
  });

  it("swaps Assault to its 4-Bloodlust band only once the threshold is met", () => {
    const low = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault"),
    });
    expect(low.casts.at(-1)!.result.expected).toBeCloseTo(4 * 1400);

    const high = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault"),
    });
    const assault = high.casts.at(-1)!;
    expect(assault.tick).toBe(12);
    expect(assault.result.expected).toBeCloseTo(4 * 1800);
    expect(assault.adrenalineAfter).toBe(36 - 25);
  });

  it("stalls a repeated cast until its individual cooldown expires", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        "attack", "attack", "attack",
        "assault",
        "attack", "attack", "attack",
        "assault",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
  });

  it("fails on adrenaline starvation instead of silently skipping", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack", "overpower") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("adrenaline");
    expect(s.casts).toHaveLength(1);
  });

  it("fails on an unknown ability id", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("definitely_not_real") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("unknown ability");
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
});

describe("simulate — damage-over-time scheduling", () => {
  it("bleed tails land on their sourced ticks and extend the timeline", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("dismember") });
    expect(s.ok).toBe(true);
    expect(s.ticks).toBe(17);
    expect(s.damageByTick[0]).toBeUndefined();
    for (let t = 2; t <= 16; t += 2) expect(s.damageByTick[t]).toBeCloseTo(300);
    expect(s.totalExpected).toBeCloseTo(8 * 300);
  });
});

describe("simulate — berserk", () => {
  const setup = [
    ...Array(12).fill("attack"),
    "berserk",
    "rend",
    ...Array(10).fill("attack"),
    "rend",
  ];

  it("multiplies melee damage inside the window and expires after 19.8s", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf(...setup) });
    expect(s.ok).toBe(true);
    const rends = s.casts.filter((c) => c.abilityId === "rend");
    expect(rends[0].tick).toBe(39);
    // floor(1350×1.75)+floor(2887.5…): the band ends floor before averaging.
    expect(rends[0].result.expected).toBeCloseTo(2624.5);
    expect(rends[1].tick).toBe(72);
    expect(rends[1].result.expected).toBeCloseTo(1500);
  });
});

describe("simulate — ranged", () => {
  const rangedInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: RANGED_ABILITIES,
    context: { style: "ranged" },
  };

  it("deathspore arrows waive the adrenaline cost at 12 stacks", () => {
    const rotation = rotationOf(...Array(12).fill("ranged_attack"), "imbue_shadows");
    const withAmmo = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(withAmmo.ok).toBe(true);
    expect(withAmmo.casts.at(-1)!.adrenalineAfter).toBe(100);

    const without = simulate({ ...rangedInput, rotation });
    expect(without.casts.at(-1)!.adrenalineAfter).toBe(60);
  });

  it("searing winds adds its bonus hit inside the window only", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf("galeshot", "ranged_attack", "ranged_attack", "ranged_attack", "ranged_attack"),
    });
    expect(s.casts[1].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[2].result.expected).toBeCloseTo(1000 + 200);
    // Tick 9 is still inside the 10-tick window; tick 12 is outside it.
    expect(s.casts[3].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[4].result.expected).toBeCloseTo(1000);
  });

  it("shadow imbued grants adrenaline per ranged hit", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(...Array(5).fill("ranged_attack"), "imbue_shadows", "galeshot"),
    });
    expect(s.casts.at(-1)!.adrenalineAfter).toBe(5 + 9 + 5);
  });

  it("shadow tendrils without an active imbue grants no phantom adrenaline", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf("shadow_tendrils", "ranged_attack"),
    });
    expect(s.casts.map((c) => c.adrenalineAfter)).toEqual([0, 9]);
  });

  it("shadow tendrils crits guaranteed even at 0% crit chance", () => {
    const s = simulate({ ...rangedInput, crit: { chance: 0 }, rotation: rotationOf("shadow_tendrils") });
    expect(s.casts[0].result.expected).toBeCloseTo(2200 * 1.5);
  });
});

describe("simulate — magic", () => {
  const magicInput: Omit<SimulateInput, "rotation"> = {
    ...baseInput,
    abilities: MAGIC_ABILITIES,
    context: { style: "magic" },
  };

  it("runic charge casts off-GCD and empowers the next dragon breath", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf("runic_charge", "magic_attack", "dragon_breath_empowered"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].tick).toBe(0);
    expect(s.casts[1].tick).toBe(0);
    expect(s.casts[2].result.expected).toBeCloseTo(2850);
  });

  it("empowered casts fail without an active charge", () => {
    const s = simulate({ ...magicInput, rotation: rotationOf("dragon_breath_empowered") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("requires an active Runic Charge");
  });

  it("runic charge cannot be recast inside its cooldown", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf("runic_charge", "magic_attack", "runic_charge"),
    });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("on cooldown");
  });
});

describe("simulate auto-weave", () => {
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
    const s = simulate({ ...baseInput, autoWeave: true, rotation: rotationOf("assault", "assault") });
    expect(s.ok).toBe(true);
    // Second assault's cooldown ends at 19, mid-GCD after the tick-18 basic — it
    // fires on the next grid slot, exactly as in game.
    expect(s.casts.map((c) => `${c.abilityId}@${c.tick}`)).toEqual([
      "attack@0", "attack@3", "attack@6",
      "assault@9",
      "attack@12", "attack@15", "attack@18",
      "assault@21",
    ]);
    // First assault at 3 stacks uses the base band; the second, at 6, is empowered.
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
    expect(s.casts.at(-1)!.abilityId).toBe("imbue_shadows");
    expect(s.casts.at(-1)!.tick).toBe(15);
    expect(s.casts.at(-1)!.adrenalineAfter).toBe(45 - 40);
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
  });
});
