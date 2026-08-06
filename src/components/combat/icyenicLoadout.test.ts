import { describe, expect, it } from "vitest";
import { mulFloor } from "@/combat/core/rounding";
import { equipmentById } from "@/combat/data";
import {
  ICYENIC_FAITH_RELIC,
  ICYENIC_PER_PRAYER,
  TOME_OF_THE_ICYENE_ID,
  TOME_OF_THE_ICYENE_PRAYER,
} from "@/combat/league/icyenicFaith";
import { loadoutStats } from "./loadoutStats";
import { DEFAULT_LOADOUT, type Loadout } from "./useLoadout";

const RELICS = [ICYENIC_FAITH_RELIC] as const;

const statsOf = (loadout: Partial<Loadout> = {}, relics?: readonly string[]) =>
  loadoutStats({ ...DEFAULT_LOADOUT, ...loadout } as Loadout, relics ? { relics } : {});

const tomeRecord = () => equipmentById(TOME_OF_THE_ICYENE_ID);

describe("Icyenic Faith equipment catalogue integrity", () => {
  it("resolves Tome, Morrigan javelin, and throwing axe without path clobber", () => {
    const tome = equipmentById(TOME_OF_THE_ICYENE_ID);
    const javelin = equipmentById("item:morrigans-javelin");
    const axe = equipmentById("item:morrigans-throwing-axe");

    expect(tome, "Tome missing; run npm run data:rebuild").toBeDefined();
    expect(javelin, "Morrigan javelin missing; Tome may have clobbered records[552]").toBeDefined();
    expect(
      axe,
      "Morrigan throwing axe missing; Tome may have clobbered records[553]",
    ).toBeDefined();

    expect(tome!.slot).toBe("pocket");
    expect(tome!.bonuses.prayer).toBe(TOME_OF_THE_ICYENE_PRAYER);
    expect(tome!.sources?.some((s) => s.url?.includes("Icyenic_Faith"))).toBe(true);

    expect(javelin!.slot).toBe("mainhand");
    expect(javelin!.bonuses.accuracy).toBe(1829);
    expect(javelin!.bonuses.damage).toBe(1162.2);
    expect(
      javelin!.sources?.some(
        (s) => s.url?.includes("Morrigan%27s_javelin") || s.url?.includes("Morrigan's_javelin"),
      ),
    ).toBe(true);

    expect(axe!.slot).toBe("mainhand");
    expect(axe!.bonuses.accuracy).toBe(1829);
    expect(axe!.bonuses.damage).toBe(955.5);
    expect(
      axe!.sources?.some(
        (s) =>
          s.url?.includes("Morrigan%27s_throwing_axe") ||
          s.url?.includes("Morrigan's_throwing_axe"),
      ),
    ).toBe(true);
  });
});

describe("Icyenic Faith through a Setup loadout", () => {
  it("matches baseline base and critChance without the relic", () => {
    const stats = statsOf();
    expect(stats.league.relicNames.has(ICYENIC_FAITH_RELIC)).toBe(false);
    expect(stats.tomeOfTheIcyeneWorn).toBe(false);
    expect(stats.icyenic.totalPrayerBonus).toBe(0);
    expect(stats.icyenic.critChanceBonus).toBe(0);
    expect(stats.icyenic.baseAbilityDamageMultiplier).toBe(1);
    expect(stats.critChanceBreakdown.icyenic ?? 0).toBe(0);
    expect(
      stats.baseAbilityDamageBreakdown.find((row) => row.label === "Icyenic Faith")?.value ?? 0,
    ).toBe(0);
  });

  it("keeps scaling off with the relic but no Tome equipped", () => {
    const baseline = statsOf();
    const withRelic = statsOf({}, RELICS);
    expect(withRelic.league.relicNames.has(ICYENIC_FAITH_RELIC)).toBe(true);
    expect(withRelic.tomeOfTheIcyeneWorn).toBe(false);
    expect(withRelic.icyenic.totalPrayerBonus).toBe(0);
    expect(withRelic.icyenic.critChanceBonus).toBe(0);
    expect(withRelic.icyenic.baseAbilityDamageMultiplier).toBe(1);
    expect(withRelic.base).toBe(baseline.base);
    expect(withRelic.critChance).toBe(baseline.critChance);
  });

  it("scales prayer crit and mulFloor base when relic + Tome are active", () => {
    const tome = tomeRecord();
    expect(
      tome,
      "item:tome-of-the-icyene missing from equipment catalogue; run npm run data:rebuild",
    ).toBeDefined();
    expect(tome!.bonuses.prayer).toBe(TOME_OF_THE_ICYENE_PRAYER);

    const withoutScaling = statsOf({}, RELICS);
    const withTome = statsOf({ equipmentSlots: { pocket: TOME_OF_THE_ICYENE_ID } }, RELICS);

    expect(withTome.tomeOfTheIcyeneWorn).toBe(true);
    expect(withTome.equipment.prayer).toBeGreaterThanOrEqual(TOME_OF_THE_ICYENE_PRAYER);
    expect(withTome.icyenic.totalPrayerBonus).toBeGreaterThanOrEqual(TOME_OF_THE_ICYENE_PRAYER);
    expect(withTome.icyenic.critChanceBonus).toBe(
      withTome.icyenic.totalPrayerBonus * ICYENIC_PER_PRAYER,
    );

    const mult = withTome.icyenic.baseAbilityDamageMultiplier;
    expect(mult).toBe(1 + withTome.icyenic.totalPrayerBonus * ICYENIC_PER_PRAYER);
    expect(withTome.base).toBe(mulFloor(withoutScaling.base, mult));
    expect(withTome.base - withoutScaling.base).toBe(
      mulFloor(withoutScaling.base, mult) - withoutScaling.base,
    );

    expect(withTome.critsDisabled).toBe(false);
    expect(withTome.critChance).toBeCloseTo(
      withoutScaling.critChance + withTome.icyenic.critChanceBonus,
      10,
    );
    expect(withTome.critChanceBreakdown.icyenic).toBe(withTome.icyenic.critChanceBonus);
  });

  it("sets 100% protect block when protection prayer is on with the relic", () => {
    const stats = statsOf({ buffs: { ...DEFAULT_LOADOUT.buffs, protectionPrayer: true } }, RELICS);
    expect(stats.icyenicProtection.blockFraction).toBe(1);
    expect(stats.icyenicProtection.unavailability).not.toBe("protection-off");
    expect(stats.icyenicProtection.unavailability).not.toBe("relic-inactive");
  });

  it("reports protection-off when the relic is on but protect is off", () => {
    const stats = statsOf({ buffs: { ...DEFAULT_LOADOUT.buffs, protectionPrayer: false } }, RELICS);
    expect(stats.icyenicProtection.unavailability).toBe("protection-off");
  });
});
