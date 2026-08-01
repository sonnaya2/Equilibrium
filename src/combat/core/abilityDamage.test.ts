import { describe, expect, it } from "vitest";
import { bandOf, baseAbilityDamage } from "./abilityDamage";
import { damagePerLevel } from "./damagePerLevel";

describe("abilityDamage", () => {
  it("applies percent bands with floored ends", () => {
    expect(bandOf(1000, { minPct: 110, maxPct: 130 })).toEqual({
      min: 1100,
      max: 1300,
      expected: 1200,
    });
  });

  it("rejects inverted bands and bad bases", () => {
    expect(() => bandOf(1000, { minPct: 130, maxPct: 110 })).toThrow(RangeError);
    expect(() => bandOf(-1, { minPct: 1, maxPct: 2 })).toThrow(RangeError);
  });
});

describe("baseAbilityDamage golden fixtures", () => {
  const t99 = { tier: 99 };

  it.each([
    ["melee", 1821],
    ["ranged", 1821],
    ["magic", 1821],
  ] as const)("level 99 naked T99 2H %s = 264 + 132 + 1425", (style, expected) => {
    const styleCap =
      style === "ranged" ? { ammunitionTier: 99 } : style === "magic" ? { spellTier: 99 } : {};
    expect(baseAbilityDamage(99, { kind: "twohand", style, weapon: t99, ...styleCap })).toBe(
      expected,
    );
  });

  it("level 99 T99/T99 dual wield = 1214 + floor(1214 / 2)", () => {
    expect(
      baseAbilityDamage(99, {
        kind: "mainhand",
        style: "melee",
        weapon: t99,
        offhand: t99,
      }),
    ).toBe(1821);
  });

  it("level 99 T99 death guard plus T99 conduit uses explicit necromancy hands", () => {
    expect(baseAbilityDamage(99, { kind: "necromancy", deathGuard: t99, conduit: t99 })).toBe(1821);
  });

  it("supports boosted levels", () => {
    // floor(DPL(110)) + floor(DPL(110)/2) + floor(14.4*99) = 289+144+1425.
    expect(baseAbilityDamage(110, { kind: "twohand", style: "melee", weapon: t99 })).toBe(1858);
  });

  it("supports mixed-tier dual wield", () => {
    // T99 main = 1214; T85-as-main = 1080; off-hand contributes floor(1080/2).
    expect(
      baseAbilityDamage(99, {
        kind: "mainhand",
        style: "melee",
        weapon: t99,
        offhand: { tier: 85 },
      }),
    ).toBe(1754);
  });

  it("caps ranged and Magic weapon contributions independently", () => {
    expect(
      baseAbilityDamage(99, {
        kind: "twohand",
        style: "ranged",
        weapon: t99,
        ammunitionTier: 80,
      }),
    ).toBe(1548);
    expect(
      baseAbilityDamage(99, {
        kind: "twohand",
        style: "magic",
        weapon: t99,
        spellTier: 80,
      }),
    ).toBe(1548);
  });

  it("caps high-tier melee weapons at the effective damage level", () => {
    // Melee's 9.6 term is level-capped; its separate 4.8 term uses raw weapon tier.
    // floor(DPL(50)) + floor(DPL(50)/2) + floor(9.6*50) + floor(4.8*99)
    // = 145 + 72 + 480 + 475.
    expect(baseAbilityDamage(50, { kind: "twohand", style: "melee", weapon: t99 })).toBe(1172);
  });

  it("places equipment style damage inside the weighted weapon floor", () => {
    // 264 + 132 + floor(14.4*99 + 1.5*12.7) = 1840.
    expect(
      baseAbilityDamage(99, {
        kind: "twohand",
        style: "melee",
        weapon: t99,
        styleBonus: 12.7,
      }),
    ).toBe(1840);
  });

  it("keeps the style-bonus floor boundary exact", () => {
    const below = baseAbilityDamage(99, {
      kind: "twohand",
      style: "melee",
      weapon: t99,
      styleBonus: 0.59,
    });
    const above = baseAbilityDamage(99, {
      kind: "twohand",
      style: "melee",
      weapon: t99,
      styleBonus: 0.6,
    });
    expect(above - below).toBe(1);
  });

  it("keeps each documented intermediate floor separate", () => {
    const expected =
      Math.floor(damagePerLevel(99)) + Math.floor(damagePerLevel(99) / 2) + Math.floor(14.4 * 99);
    expect(baseAbilityDamage(99, { kind: "twohand", style: "melee", weapon: t99 })).toBe(expected);
  });

  it("rejects invalid levels and tiers", () => {
    expect(() => baseAbilityDamage(0, { kind: "twohand", style: "melee", weapon: t99 })).toThrow(
      RangeError,
    );
    expect(() => baseAbilityDamage(99, { kind: "necromancy", deathGuard: { tier: -1 } })).toThrow(
      RangeError,
    );
  });
});
