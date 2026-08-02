import { describe, expect, it } from "vitest";
import { lifePointStats } from "./lifePoints";

describe("lifePointStats", () => {
  it("gives 100 life per Constitution level (1,000 at 10; 9,900 at 99)", () => {
    expect(lifePointStats({ constitutionLevel: 10 }).constitutionLife).toBe(1000);
    expect(lifePointStats({ constitutionLevel: 99 }).constitutionLife).toBe(9900);
    expect(lifePointStats({ constitutionLevel: 10 }).normalMaxLife).toBe(1000);
  });

  it("rejects Constitution levels outside 1–99 (boosted max-LP is unverified)", () => {
    expect(() => lifePointStats({ constitutionLevel: 0 })).toThrow(RangeError);
    expect(() => lifePointStats({ constitutionLevel: 100 })).toThrow(RangeError);
    expect(() => lifePointStats({ constitutionLevel: Number.NaN })).toThrow(RangeError);
  });

  it("composes the normal maximum without temporary buffs", () => {
    const stats = lifePointStats({
      constitutionLevel: 99,
      equipmentLife: 5785,
      reaperCrew: true,
      boonOfHet: true,
    });
    expect(stats.permanentLife).toBe(200 + 495);
    expect(stats.temporaryFlatLife).toBe(0);
    expect(stats.normalMaxLife).toBe(9900 + 5785 + 695);
    expect(stats.temporaryMaxLife).toBe(stats.normalMaxLife);
    expect(stats.currentLife).toBe(stats.temporaryMaxLife);
  });

  it("keeps persistent life in the normal maximum and food overheal based on that maximum", () => {
    const stats = lifePointStats({
      constitutionLevel: 99,
      equipmentLife: 5785,
      reaperCrew: true,
      boonOfHet: true,
      fontOfLife: true,
      fortitude: true,
      thermalBath: true,
      totemOfVitality: true,
      overheal: "soup-line",
    });
    expect(stats.permanentLife).toBe(200 + 495 + 500 + 1500);
    expect(stats.temporaryFlatLife).toBe(1000 + 297);
    expect(stats.totemOfVitalityLife).toBe(1500);
    expect(stats.normalMaxLife).toBe(18_380);
    expect(stats.temporaryMaxLife).toBe(19677);
    expect(stats.overhealCeiling).toBe(22_434);
  });

  it("scales Boon of Het with maximum life and caps it at 495", () => {
    // 5% of 5,000 + 1,000 is below the cap, so the percentage binds.
    const low = lifePointStats({ constitutionLevel: 50, equipmentLife: 1000, boonOfHet: true });
    expect(low.permanentLife).toBe(300);
    // Equipment life counts toward the basis, so the cap binds well before 99.
    const capped = lifePointStats({ constitutionLevel: 50, equipmentLife: 5785, boonOfHet: true });
    expect(capped.permanentLife).toBe(495);
    expect(lifePointStats({ constitutionLevel: 99, boonOfHet: true }).permanentLife).toBe(495);
  });

  it("computes the bonfire window through current level 110, capped at 750", () => {
    const at110 = lifePointStats({ constitutionLevel: 99, bonfireFiremakingLevel: 110 });
    expect(at110.bonfireLife).toBe(Math.floor(0.056 * 9900));
    const at1 = lifePointStats({ constitutionLevel: 99, bonfireFiremakingLevel: 1 });
    expect(at1.bonfireLife).toBe(Math.floor(0.001 * 9900));
    const capped = lifePointStats({
      constitutionLevel: 99,
      equipmentLife: 5785,
      bonfireFiremakingLevel: 110,
    });
    expect(capped.bonfireLife).toBe(750);
    expect(() => lifePointStats({ constitutionLevel: 99, bonfireFiremakingLevel: 111 })).toThrow(
      RangeError,
    );
  });

  it("rejects bonfire + Totem of Vitality together — they do not stack", () => {
    expect(() =>
      lifePointStats({ constitutionLevel: 99, bonfireFiremakingLevel: 99, totemOfVitality: true }),
    ).toThrow(RangeError);
  });

  it("applies Fortitude as 10 + 10 × Constitution level", () => {
    const stats = lifePointStats({ constitutionLevel: 99, fortitude: true });
    expect(stats.temporaryFlatLife).toBe(1000);
  });

  it("does not let Fortitude increase a percentage food overheal", () => {
    const stats = lifePointStats({
      constitutionLevel: 99,
      fortitude: true,
      overheal: "soup-line",
    });
    expect(stats.normalMaxLife).toBe(9900);
    expect(stats.temporaryMaxLife).toBe(10_900);
    expect(stats.overhealCeiling).toBe(10_900 + Math.floor(0.15 * 9900));
  });

  it("caps overheal by class: +10%, +15%, or the flat brew ceilings", () => {
    const base = { constitutionLevel: 99 };
    expect(lifePointStats({ ...base, overheal: "rocktail-line" }).overhealCeiling).toBe(
      9900 + Math.floor(0.1 * 9900),
    );
    expect(lifePointStats({ ...base, overheal: "soup-line" }).overhealCeiling).toBe(
      9900 + Math.floor(0.15 * 9900),
    );
    expect(lifePointStats({ ...base, overheal: "saradomin-brew" }).overhealCeiling).toBe(10900);
    expect(lifePointStats({ ...base, overheal: "super-saradomin-brew" }).overhealCeiling).toBe(
      11200,
    );
  });

  it("doubles current, maximum, and overheal without an extra calculator cap", () => {
    const base = lifePointStats({
      constitutionLevel: 99,
      equipmentLife: 5785,
      reaperCrew: true,
      boonOfHet: true,
      fontOfLife: true,
      fortitude: true,
      thermalBath: true,
      totemOfVitality: true,
      powerburstOfVitality: true,
    });
    expect(base.temporaryMaxLife).toBe(39_354);
    expect(base.overhealCeiling).toBe(39_354);
    expect(Object.values(base.breakdown).reduce((sum, value) => sum + value, 0)).toBe(
      base.temporaryMaxLife,
    );

    const wounded = lifePointStats({
      constitutionLevel: 99,
      currentLife: 4000,
      powerburstOfVitality: true,
    });
    expect(wounded.currentLife).toBe(8000);
  });

  it("clamps current life to the overheal ceiling and defaults to the maximum", () => {
    const stats = lifePointStats({
      constitutionLevel: 99,
      overheal: "saradomin-brew",
      currentLife: 15000,
    });
    expect(stats.currentLife).toBe(10900);
    expect(lifePointStats({ constitutionLevel: 99 }).currentLife).toBe(9900);
  });

  it("applies the league maximum-life multiplier before overheal and Powerburst", () => {
    const stats = lifePointStats({
      constitutionLevel: 99,
      fontOfLife: true,
      maximumLifeMultiplier: 1.5,
      overheal: "soup-line",
    });
    expect(stats.normalMaxLife).toBe(15_600);
    expect(stats.temporaryMaxLife).toBe(15_600);
    expect(stats.overhealCeiling).toBe(17_940);
    expect(Object.values(stats.breakdown).reduce((sum, value) => sum + value, 0)).toBe(
      stats.temporaryMaxLife,
    );
  });
});
