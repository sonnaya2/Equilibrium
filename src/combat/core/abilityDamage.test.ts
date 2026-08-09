import { describe, expect, it } from "vitest";
import {
  GOLDEN_L50_T99_MELEE_LEVEL_CAP,
  GOLDEN_L99_T99_DUAL_WIELD,
  GOLDEN_L99_T99_MAGIC_SPELL80,
  GOLDEN_L99_T99_NECROMANCY,
  GOLDEN_L99_T99_RANGED_AMMO80,
  GOLDEN_L99_T99_STYLE_BONUS_12_7,
  GOLDEN_L99_T99_T85_DUAL,
  GOLDEN_L99_T99_TWO_HAND,
  GOLDEN_L110_T99_TWO_HAND,
} from "../testing/goldens";
import { bandOf, baseAbilityDamage } from "./abilityDamage";
import { damagePerLevel } from "./damagePerLevel";

const t99 = { tier: 99 };

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
  it.each([
    ["melee", GOLDEN_L99_T99_TWO_HAND],
    ["ranged", GOLDEN_L99_T99_TWO_HAND],
    ["magic", GOLDEN_L99_T99_TWO_HAND],
  ] as const)("level 99 naked T99 2H %s", (style, expected) => {
    const styleCap =
      style === "ranged" ? { ammunitionTier: 99 } : style === "magic" ? { spellTier: 99 } : {};
    expect(baseAbilityDamage(99, { kind: "twohand", style, weapon: t99, ...styleCap })).toBe(
      expected,
    );
  });

  it("dual-wield, necromancy, boosts, and mixed tiers", () => {
    expect(
      baseAbilityDamage(99, {
        kind: "mainhand",
        style: "melee",
        weapon: t99,
        offhand: t99,
      }),
    ).toBe(GOLDEN_L99_T99_DUAL_WIELD);
    expect(baseAbilityDamage(99, { kind: "necromancy", deathGuard: t99, conduit: t99 })).toBe(
      GOLDEN_L99_T99_NECROMANCY,
    );
    expect(baseAbilityDamage(110, { kind: "twohand", style: "melee", weapon: t99 })).toBe(
      GOLDEN_L110_T99_TWO_HAND,
    );
    expect(
      baseAbilityDamage(99, {
        kind: "mainhand",
        style: "melee",
        weapon: t99,
        offhand: { tier: 85 },
      }),
    ).toBe(GOLDEN_L99_T99_T85_DUAL);
  });

  it("caps ranged and Magic weapon contributions independently", () => {
    expect(
      baseAbilityDamage(99, {
        kind: "twohand",
        style: "ranged",
        weapon: t99,
        ammunitionTier: 80,
      }),
    ).toBe(GOLDEN_L99_T99_RANGED_AMMO80);
    expect(
      baseAbilityDamage(99, {
        kind: "twohand",
        style: "magic",
        weapon: t99,
        spellTier: 80,
      }),
    ).toBe(GOLDEN_L99_T99_MAGIC_SPELL80);
  });

  it("level-caps the melee weapon term and places style bonus inside the floor", () => {
    expect(baseAbilityDamage(50, { kind: "twohand", style: "melee", weapon: t99 })).toBe(
      GOLDEN_L50_T99_MELEE_LEVEL_CAP,
    );
    expect(
      baseAbilityDamage(99, {
        kind: "twohand",
        style: "melee",
        weapon: t99,
        styleBonus: 12.7,
      }),
    ).toBe(GOLDEN_L99_T99_STYLE_BONUS_12_7);
  });

  it("keeps the style-bonus floor boundary exact", () => {
    // Single 14.4 floor: floor(14.4*99 + 1.5*b) steps at b=0.27 (1.5*0.26=0.39, 1.5*0.27=0.405).
    const below = baseAbilityDamage(99, {
      kind: "twohand",
      style: "melee",
      weapon: t99,
      styleBonus: 0.26,
    });
    const above = baseAbilityDamage(99, {
      kind: "twohand",
      style: "melee",
      weapon: t99,
      styleBonus: 0.27,
    });
    expect(above - below).toBe(1);
  });

  it("keeps each documented intermediate floor separate", () => {
    const expected =
      Math.floor(damagePerLevel(99)) + Math.floor(damagePerLevel(99) / 2) + Math.floor(14.4 * 99);
    expect(expected).toBe(GOLDEN_L99_T99_TWO_HAND);
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
