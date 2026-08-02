import { describe, expect, it } from "vitest";
import { defenceStats } from "../core/defence";
import { aegisArmourBonus, resolveLeagueRules } from "./ruleset";
import { blessingChoice } from "../../league/blessings";

/**
 * Teragard's Aegis: "Your base ability damage is increased by 25% of your total
 * armour value. If you are wielding a defender, it is increased by 50%. If you
 * are wielding a shield, it is increased by 75%."
 * (RuneScape Wiki, Equilibrium League/Blessings, verified 2026-08-02.)
 */
const AEGIS = blessingChoice(1, "Order")!.combat;

const armour = (
  equipmentArmour: number,
  extra: Parameters<typeof defenceStats>[0] = {
    baseLevel: 99,
  },
) => defenceStats({ ...extra, equipmentArmour });

describe("Teragard's Aegis armour conversion", () => {
  it("adds 25% / 50% / 75% of the total armour value to base ability damage", () => {
    const stats = armour(1_000);
    expect(aegisArmourBonus(AEGIS, stats, null).baseAbilityDamageBonus).toBe(250);
    expect(aegisArmourBonus(AEGIS, stats, "defender").baseAbilityDamageBonus).toBe(500);
    expect(aegisArmourBonus(AEGIS, stats, "shield").baseAbilityDamageBonus).toBe(750);
  });

  it("resolves the percentage before rounding, so 1,002 armour splits the two readings", () => {
    // floor(1002 × 0.25) = 250 and ×3 would be 750; the card's flat 75% gives 751.
    const stats = armour(1_002);
    expect(aegisArmourBonus(AEGIS, stats, null).baseAbilityDamageBonus).toBe(250);
    expect(aegisArmourBonus(AEGIS, stats, "defender").baseAbilityDamageBonus).toBe(501);
    expect(aegisArmourBonus(AEGIS, stats, "shield").baseAbilityDamageBonus).toBe(751);
  });

  it("scales the addition through a later ability band rather than multiplying final damage", () => {
    // 1,000 base + 750 from a shield, read by a 150% ability = 2,625 raw damage,
    // which is what an additive base-damage increase must produce. A 1.75×
    // final-damage reading would instead give 1,000 × 1.5 × 1.75 = 2,625 only by
    // coincidence at this band, so assert the base itself, not just the product.
    const bonus = aegisArmourBonus(AEGIS, armour(1_000), "shield");
    expect(1_000 + bonus.baseAbilityDamageBonus).toBe(1_750);
    expect(Math.floor((1_000 + bonus.baseAbilityDamageBonus) * 1.5)).toBe(2_625);
    expect(
      Math.floor(
        (1_000 + aegisArmourBonus(AEGIS, armour(1_000), null).baseAbilityDamageBonus) * 1.5,
      ),
    ).toBe(1_875);
    expect(
      Math.floor(
        (1_000 + aegisArmourBonus(AEGIS, armour(1_000), "defender").baseAbilityDamageBonus) * 1.5,
      ),
    ).toBe(2_250);
  });

  it("is unchanged by Fortitude, which only moves the block armour rating", () => {
    const plain = armour(1_000);
    const fortified = armour(1_000, { baseLevel: 99, fortitude: true });
    expect(fortified.blockArmourRating).toBeGreaterThan(plain.blockArmourRating);
    for (const offhand of [null, "defender", "shield"] as const) {
      expect(aegisArmourBonus(AEGIS, fortified, offhand).baseAbilityDamageBonus).toBe(
        aegisArmourBonus(AEGIS, plain, offhand).baseAbilityDamageBonus,
      );
    }
    // The two quantities are separate fields, so no single number can serve both.
    expect(fortified.totalArmour).not.toBe(fortified.blockArmourRating);
    expect(aegisArmourBonus(AEGIS, fortified, null).excludedBlockArmour).toBeGreaterThan(0);
  });

  it("is unchanged by prayer and curse block levels", () => {
    const plain = armour(1_000);
    const cursed = armour(1_000, { baseLevel: 99, prayerBlockLevels: 12 });
    expect(cursed.blockArmourRating).toBeGreaterThan(plain.blockArmourRating);
    expect(aegisArmourBonus(AEGIS, cursed, null).baseAbilityDamageBonus).toBe(250);
  });

  it("is unchanged by Defence level and overloads, which grant no equipment armour", () => {
    expect(
      aegisArmourBonus(AEGIS, armour(1_000, { baseLevel: 1 }), null).baseAbilityDamageBonus,
    ).toBe(250);
    expect(
      aegisArmourBonus(AEGIS, armour(1_000, { baseLevel: 99, overloadTier: "elder" }), null)
        .baseAbilityDamageBonus,
    ).toBe(250);
  });

  it("counts a wielded shield's own armour inside the basis before the 75% share", () => {
    // A shield adds its armour to the total, so its contribution is multiplied
    // by the very share it unlocks: (1000 + 200) × 0.75.
    const withShield = armour(1_200);
    expect(aegisArmourBonus(AEGIS, withShield, "shield").baseAbilityDamageBonus).toBe(900);
  });

  it("reports zero without the blessing", () => {
    expect(aegisArmourBonus(undefined, armour(1_000), "shield")).toMatchObject({
      armourPercent: 0,
      baseAbilityDamageBonus: 0,
      qualifyingArmour: 1_000,
    });
  });

  it("exposes the diagnostic fields the analysis needs", () => {
    const stats = armour(1_000, { baseLevel: 99, fortitude: true });
    expect(aegisArmourBonus(AEGIS, stats, "defender")).toMatchObject({
      qualifyingArmour: 1_000,
      offhand: "defender",
      armourPercent: 0.5,
      baseAbilityDamageBonus: 500,
    });
    expect(aegisArmourBonus(AEGIS, stats, "defender").excludedBlockArmour).toBe(
      stats.blockArmourRating - 1_000,
    );
  });

  it("feeds Striking Light the same total armour value", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Order", "Order"] },
      { totalArmour: armour(1_000, { baseLevel: 99, fortitude: true }).totalArmour },
    );
    expect(league.totalArmour).toBe(1_000);
  });
});
