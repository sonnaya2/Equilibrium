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

  it("reproduces the wiki worked maximum: 19,677 buffed, 22,628 with 15% overheal", () => {
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
    expect(stats.temporaryFlatLife).toBe(500 + 1000 + 297);
    expect(stats.totemOfVitalityLife).toBe(1500);
    expect(stats.temporaryMaxLife).toBe(19677);
    expect(stats.overhealCeiling).toBe(22628);
  });

  it("computes the bonfire window as ⌈(fm+1)/2⌉ × 0.1% of Constitution + equipment, capped at 750", () => {
    const at99 = lifePointStats({ constitutionLevel: 99, bonfireFiremakingLevel: 99 });
    expect(at99.bonfireLife).toBe(Math.floor(0.05 * 9900));
    const at1 = lifePointStats({ constitutionLevel: 99, bonfireFiremakingLevel: 1 });
    expect(at1.bonfireLife).toBe(Math.floor(0.001 * 9900));
    const capped = lifePointStats({
      constitutionLevel: 99,
      equipmentLife: 5785,
      bonfireFiremakingLevel: 99,
    });
    expect(capped.bonfireLife).toBe(750);
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

  it("doubles the maximum under Powerburst of vitality, capped at 32,000", () => {
    const uncapped = lifePointStats({ constitutionLevel: 99, powerburstOfVitality: true });
    expect(uncapped.temporaryMaxLife).toBe(19800);
    const capped = lifePointStats({
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
    expect(capped.temporaryMaxLife).toBe(32000);
    expect(capped.overhealCeiling).toBe(32000);
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
});
