import { describe, expect, it } from "vitest";
import { baseAbilityDamage } from "../core/abilityDamage";
import { damagePerLevel } from "../core/damagePerLevel";
import { STANDARD_HIT_CAP, applyHitCap } from "../core/hitCaps";
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
  GOLDEN_STANDARD_HIT_CAP,
} from "./goldens";

const t99 = { tier: 99 };

describe("combat goldens (independently derived)", () => {
  it("DPL intermediate floors rebuild the T99 2H golden without calling baseAbilityDamage", () => {
    const rebuilt =
      Math.floor(damagePerLevel(99)) +
      Math.floor(damagePerLevel(99) / 2) +
      Math.floor(14.4 * 99);
    expect(rebuilt).toBe(GOLDEN_L99_T99_TWO_HAND);
  });

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

  it("dual-wield, necromancy hands, and boosts", () => {
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
  });

  it("tier caps, style bonus, and level-capped melee term", () => {
    expect(
      baseAbilityDamage(99, {
        kind: "mainhand",
        style: "melee",
        weapon: t99,
        offhand: { tier: 85 },
      }),
    ).toBe(GOLDEN_L99_T99_T85_DUAL);
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

  it("standard hit cap is discrete and applied once", () => {
    expect(STANDARD_HIT_CAP).toBe(GOLDEN_STANDARD_HIT_CAP);
    expect(applyHitCap(40_000)).toBe(GOLDEN_STANDARD_HIT_CAP);
    expect(applyHitCap(10_000)).toBe(10_000);
  });
});
