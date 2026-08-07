import { describe, expect, it } from "vitest";
import { defenceStats } from "../core/defence";
import { aegisArmourBonus, resolveLeagueRules } from "./ruleset";
import { blessingChoice } from "../../league/blessings";

const AEGIS = blessingChoice(1, "Order")!.combat;

const armour = (
  equipmentArmour: number,
  extra: Parameters<typeof defenceStats>[0] = { baseLevel: 99 },
) => defenceStats({ ...extra, equipmentArmour });

describe("Teragard's Aegis armour conversion", () => {
  it("uses the resolved Armour rating for 25% / 50% / 75%", () => {
    const stats = armour(1_000);
    expect(stats.blockArmourRating).toBe(2_212);
    expect(aegisArmourBonus(AEGIS, stats, null).baseAbilityDamageBonus).toBe(553);
    expect(aegisArmourBonus(AEGIS, stats, "defender").baseAbilityDamageBonus).toBe(1_106);
    expect(aegisArmourBonus(AEGIS, stats, "shield").baseAbilityDamageBonus).toBe(1_659);
  });

  it("resolves the percentage before rounding", () => {
    const stats = armour(1_002);
    expect(stats.blockArmourRating).toBe(2_214);
    expect(aegisArmourBonus(AEGIS, stats, null).baseAbilityDamageBonus).toBe(553);
    expect(aegisArmourBonus(AEGIS, stats, "defender").baseAbilityDamageBonus).toBe(1_107);
    expect(aegisArmourBonus(AEGIS, stats, "shield").baseAbilityDamageBonus).toBe(1_660);
  });

  it("changes when the shared Armour rating changes", () => {
    const low = aegisArmourBonus(AEGIS, armour(1_000), null);
    const high = aegisArmourBonus(AEGIS, armour(1_200), null);
    expect(high.baseAbilityDamageBonus - low.baseAbilityDamageBonus).toBe(50);
  });

  it("includes Defence, prayer, and Fortitude inputs in the Armour rating", () => {
    const plain = armour(1_000);
    const fortified = armour(1_000, { baseLevel: 99, fortitude: true });
    const cursed = armour(1_000, { baseLevel: 99, prayerBlockLevels: 12 });
    expect(fortified.blockArmourRating).toBeGreaterThan(plain.blockArmourRating);
    expect(cursed.blockArmourRating).toBeGreaterThan(plain.blockArmourRating);
    expect(fortified.totalArmour).toBe(plain.totalArmour);
    expect(cursed.totalArmour).toBe(plain.totalArmour);
    expect(aegisArmourBonus(AEGIS, fortified, null).baseAbilityDamageBonus).toBe(668);
    expect(aegisArmourBonus(AEGIS, cursed, null).baseAbilityDamageBonus).toBe(644);
  });

  it("counts a wielded shield's armour before the 75% share", () => {
    expect(aegisArmourBonus(AEGIS, armour(1_200), "shield").baseAbilityDamageBonus).toBe(1_809);
  });

  it("adds to base ability damage rather than multiplying final damage", () => {
    const bonus = aegisArmourBonus(AEGIS, armour(1_000), "shield");
    expect(1_000 + bonus.baseAbilityDamageBonus).toBe(2_659);
    expect(Math.floor((1_000 + bonus.baseAbilityDamageBonus) * 1.5)).toBe(3_988);
  });

  it("reports zero without the blessing", () => {
    expect(aegisArmourBonus(undefined, armour(1_000), "shield")).toMatchObject({
      armourPercent: 0,
      baseAbilityDamageBonus: 0,
      offhand: "shield",
    });
  });

  it("exposes only the resolved off-hand share and bonus", () => {
    expect(aegisArmourBonus(AEGIS, armour(1_000), "defender")).toMatchObject({
      offhand: "defender",
      armourPercent: 0.5,
      baseAbilityDamageBonus: 1_106,
    });
  });

  it("feeds Striking Light the same Total Armor Value", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Order", "Order"] },
      { totalArmour: armour(1_000, { baseLevel: 99, fortitude: true }).totalArmour },
    );
    expect(league.totalArmour).toBe(1_000);
  });
});
