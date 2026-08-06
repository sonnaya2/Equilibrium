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
  it("adds 25% / 50% / 75% of equipment armour when basis is equipment", () => {
    const stats = armour(1_000);
    const eq = { basis: "equipment" as const };
    expect(aegisArmourBonus(AEGIS, stats, null, eq).baseAbilityDamageBonus).toBe(250);
    expect(aegisArmourBonus(AEGIS, stats, "defender", eq).baseAbilityDamageBonus).toBe(500);
    expect(aegisArmourBonus(AEGIS, stats, "shield", eq).baseAbilityDamageBonus).toBe(750);
  });

  it("defaults to total block rating (equipment + Defence share)", () => {
    const stats = armour(1_000, { baseLevel: 99 });
    const bonus = aegisArmourBonus(AEGIS, stats, null);
    expect(bonus.basis).toBe("total-rating");
    expect(bonus.qualifyingArmour).toBe(stats.blockArmourRating);
    expect(bonus.baseAbilityDamageBonus).toBe(Math.floor(stats.blockArmourRating * 0.25));
    expect(bonus.baseAbilityDamageBonus).toBeGreaterThan(250);
  });

  it("resolves the percentage before rounding, so 1,002 armour splits the two readings", () => {
    // floor(1002 × 0.25) = 250 and ×3 would be 750; the card's flat 75% gives 751.
    const stats = armour(1_002);
    const eq = { basis: "equipment" as const };
    expect(aegisArmourBonus(AEGIS, stats, null, eq).baseAbilityDamageBonus).toBe(250);
    expect(aegisArmourBonus(AEGIS, stats, "defender", eq).baseAbilityDamageBonus).toBe(501);
    expect(aegisArmourBonus(AEGIS, stats, "shield", eq).baseAbilityDamageBonus).toBe(751);
  });

  it("scales the addition through a later ability band rather than multiplying final damage", () => {
    // 1,000 base + 750 from a shield, read by a 150% ability = 2,625 raw damage,
    // which is what an additive base-damage increase must produce. A 1.75×
    // final-damage reading would instead give 1,000 × 1.5 × 1.75 = 2,625 only by
    // coincidence at this band, so assert the base itself, not just the product.
    const eq = { basis: "equipment" as const };
    const bonus = aegisArmourBonus(AEGIS, armour(1_000), "shield", eq);
    expect(1_000 + bonus.baseAbilityDamageBonus).toBe(1_750);
    expect(Math.floor((1_000 + bonus.baseAbilityDamageBonus) * 1.5)).toBe(2_625);
    expect(
      Math.floor(
        (1_000 + aegisArmourBonus(AEGIS, armour(1_000), null, eq).baseAbilityDamageBonus) * 1.5,
      ),
    ).toBe(1_875);
    expect(
      Math.floor(
        (1_000 + aegisArmourBonus(AEGIS, armour(1_000), "defender", eq).baseAbilityDamageBonus) *
          1.5,
      ),
    ).toBe(2_250);
  });

  it("equipment basis ignores Fortitude block rating; total-rating basis includes it", () => {
    const plain = armour(1_000);
    const fortified = armour(1_000, { baseLevel: 99, fortitude: true });
    expect(fortified.blockArmourRating).toBeGreaterThan(plain.blockArmourRating);
    for (const offhand of [null, "defender", "shield"] as const) {
      expect(
        aegisArmourBonus(AEGIS, fortified, offhand, { basis: "equipment" }).baseAbilityDamageBonus,
      ).toBe(
        aegisArmourBonus(AEGIS, plain, offhand, { basis: "equipment" }).baseAbilityDamageBonus,
      );
      expect(
        aegisArmourBonus(AEGIS, fortified, offhand, { basis: "total-rating" })
          .baseAbilityDamageBonus,
      ).toBeGreaterThan(
        aegisArmourBonus(AEGIS, plain, offhand, { basis: "total-rating" }).baseAbilityDamageBonus,
      );
    }
    expect(fortified.totalArmour).not.toBe(fortified.blockArmourRating);
    expect(
      aegisArmourBonus(AEGIS, fortified, null, { basis: "equipment" }).excludedBlockArmour,
    ).toBeGreaterThan(0);
    expect(
      aegisArmourBonus(AEGIS, fortified, null, { basis: "total-rating" }).excludedBlockArmour,
    ).toBe(0);
  });

  it("equipment basis ignores prayer block levels; total-rating includes them", () => {
    const plain = armour(1_000);
    const cursed = armour(1_000, { baseLevel: 99, prayerBlockLevels: 12 });
    expect(cursed.blockArmourRating).toBeGreaterThan(plain.blockArmourRating);
    expect(
      aegisArmourBonus(AEGIS, cursed, null, { basis: "equipment" }).baseAbilityDamageBonus,
    ).toBe(250);
    expect(
      aegisArmourBonus(AEGIS, cursed, null, { basis: "total-rating" }).baseAbilityDamageBonus,
    ).toBeGreaterThan(250);
  });

  it("equipment basis ignores Defence/overload; total-rating scales with block level", () => {
    expect(
      aegisArmourBonus(AEGIS, armour(1_000, { baseLevel: 1 }), null, {
        basis: "equipment",
      }).baseAbilityDamageBonus,
    ).toBe(250);
    expect(
      aegisArmourBonus(AEGIS, armour(1_000, { baseLevel: 99, overloadTier: "elder" }), null, {
        basis: "equipment",
      }).baseAbilityDamageBonus,
    ).toBe(250);
    const low = aegisArmourBonus(AEGIS, armour(1_000, { baseLevel: 1 }), null, {
      basis: "total-rating",
    });
    const high = aegisArmourBonus(
      AEGIS,
      armour(1_000, { baseLevel: 99, overloadTier: "elder" }),
      null,
      { basis: "total-rating" },
    );
    expect(high.baseAbilityDamageBonus).toBeGreaterThan(low.baseAbilityDamageBonus);
  });

  it("counts a wielded shield's own armour inside the basis before the 75% share", () => {
    // A shield adds its armour to the total, so its contribution is multiplied
    // by the very share it unlocks: (1000 + 200) × 0.75.
    const withShield = armour(1_200);
    expect(
      aegisArmourBonus(AEGIS, withShield, "shield", { basis: "equipment" }).baseAbilityDamageBonus,
    ).toBe(900);
  });

  it("reports zero without the blessing", () => {
    expect(
      aegisArmourBonus(undefined, armour(1_000), "shield", { basis: "equipment" }),
    ).toMatchObject({
      armourPercent: 0,
      baseAbilityDamageBonus: 0,
      qualifyingArmour: 1_000,
    });
  });

  it("exposes the diagnostic fields the analysis needs", () => {
    const stats = armour(1_000, { baseLevel: 99, fortitude: true });
    expect(aegisArmourBonus(AEGIS, stats, "defender", { basis: "equipment" })).toMatchObject({
      qualifyingArmour: 1_000,
      basis: "equipment",
      offhand: "defender",
      armourPercent: 0.5,
      baseAbilityDamageBonus: 500,
    });
    expect(
      aegisArmourBonus(AEGIS, stats, "defender", { basis: "equipment" }).excludedBlockArmour,
    ).toBe(stats.blockArmourRating - 1_000);
  });

  it("feeds Striking Light the same total armour value", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Order", "Order"] },
      { totalArmour: armour(1_000, { baseLevel: 99, fortitude: true }).totalArmour },
    );
    expect(league.totalArmour).toBe(1_000);
  });
});
