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

describe("baseAbilityDamage", () => {
  const t90 = { tier: 90 };

  it("main-hand = floor(DPL) + floor(9.6 × tier + bonus), keeping the two floors separate", () => {
    const level = 99;
    const expected = Math.floor(damagePerLevel(level)) + Math.floor(9.6 * 90);
    expect(baseAbilityDamage(level, { kind: "mainhand", weapon: t90 })).toBe(expected);
    // A combined floor would round the sum once; the chain floors each term first.
    expect(expected).toBeLessThanOrEqual(Math.floor(damagePerLevel(level) + 9.6 * 90));
  });

  it("adds the style bonus inside the weapon-term floor", () => {
    const withBonus = baseAbilityDamage(90, {
      kind: "mainhand",
      weapon: { tier: 90, styleBonus: 12.7 },
    });
    const without = baseAbilityDamage(90, { kind: "mainhand", weapon: t90 });
    expect(withBonus - without).toBe(Math.floor(9.6 * 90 + 12.7) - Math.floor(9.6 * 90));
  });

  it("dual wield totals MH + floor(OH-level formula / 2)", () => {
    const dw = baseAbilityDamage(99, { kind: "mainhand", weapon: t90, offhand: { tier: 85 } });
    const mh = baseAbilityDamage(99, { kind: "mainhand", weapon: t90 });
    const ohAsMh = baseAbilityDamage(99, { kind: "mainhand", weapon: { tier: 85 } });
    expect(dw).toBe(mh + Math.floor(ohAsMh / 2));
  });

  it("two-handed melee/ranged adds floor(4.8 × tier + 0.5 × bonus)", () => {
    const level = 120;
    const twoHand = baseAbilityDamage(level, { kind: "twohand", weapon: t90, style: "melee" });
    const mh = baseAbilityDamage(level, { kind: "mainhand", weapon: t90 });
    expect(twoHand).toBe(mh + Math.floor(4.8 * 90));
  });

  it("two-handed magic uses the 14.4 tier term with the retained 1.25 level term", () => {
    const level = 99;
    const expected =
      Math.floor(damagePerLevel(level)) + Math.floor(1.25 * level) + Math.floor(14.4 * 90);
    expect(baseAbilityDamage(level, { kind: "twohand", weapon: t90, style: "magic" })).toBe(
      expected,
    );
  });

  it("caps the weapon tier at the spell/ammo tier cap", () => {
    const capped = baseAbilityDamage(99, { kind: "mainhand", weapon: { tier: 90, tierCap: 80 } });
    const t80 = baseAbilityDamage(99, { kind: "mainhand", weapon: { tier: 80 } });
    expect(capped).toBe(t80);
  });

  it("meets the pre-2026 linear total at level 145 for the level term", () => {
    // DPL(145) = 362.5 = old 2.5 × 145 — the curve's documented anchor (changelog §5.1).
    const modern = baseAbilityDamage(145, { kind: "mainhand", weapon: t90 });
    expect(modern).toBe(362 + Math.floor(9.6 * 90));
  });

  it("rejects bad levels", () => {
    expect(() => baseAbilityDamage(0, { kind: "mainhand", weapon: t90 })).toThrow(RangeError);
  });
});
