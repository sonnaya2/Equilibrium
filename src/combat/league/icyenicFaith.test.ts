import { describe, expect, it } from "vitest";
import {
  ICYENIC_FAITH_RELIC,
  ICYENIC_PER_PRAYER,
  SOUL_SPLIT_HEAL_FRACTION,
  TOME_OF_THE_ICYENE_ID,
  TOME_OF_THE_ICYENE_PRAYER,
  icyenicFaithActive,
  icyenicFaithBonuses,
  icyenicProtectionNote,
  icyenicProtectionOutcome,
  icyenicScalingPrayer,
  icyenicSoulSplitHeal,
  icyenicSoulSplitNote,
  isTomeOfTheIcyeneWorn,
  resolveIcyenicFaithBonuses,
} from "./icyenicFaith";

/**
 * Icyenic Faith (Equilibrium T7) + Tome of the Icyene.
 * https://runescape.wiki/w/Icyenic_Faith
 * 0.2% crit chance and 0.2% base AD per Prayer; protect = 100% block + Soul Split heal.
 */

describe("Icyenic Faith constants", () => {
  it("locks the wiki face values used by the product formula", () => {
    expect(ICYENIC_FAITH_RELIC).toBe("Icyenic Faith");
    expect(TOME_OF_THE_ICYENE_ID).toBe("item:tome-of-the-icyene");
    expect(TOME_OF_THE_ICYENE_PRAYER).toBe(50);
    expect(ICYENIC_PER_PRAYER).toBe(0.002);
    expect(SOUL_SPLIT_HEAL_FRACTION).toBe(0.1);
  });
});

describe("icyenicFaithActive", () => {
  it("detects the relic on an array", () => {
    expect(icyenicFaithActive(["Icyenic Faith"])).toBe(true);
    expect(icyenicFaithActive(["Some Other Relic", "Icyenic Faith"])).toBe(true);
    expect(icyenicFaithActive(["Some Other Relic"])).toBe(false);
    expect(icyenicFaithActive([])).toBe(false);
  });

  it("detects the relic on a Set", () => {
    expect(icyenicFaithActive(new Set(["Icyenic Faith"]))).toBe(true);
    expect(icyenicFaithActive(new Set(["Icyenic Faith", "Other"]))).toBe(true);
    expect(icyenicFaithActive(new Set(["Other"]))).toBe(false);
    expect(icyenicFaithActive(new Set())).toBe(false);
  });

  it("is false when relics are undefined", () => {
    expect(icyenicFaithActive(undefined)).toBe(false);
  });
});

describe("isTomeOfTheIcyeneWorn", () => {
  it("matches item:tome-of-the-icyene only", () => {
    expect(isTomeOfTheIcyeneWorn([TOME_OF_THE_ICYENE_ID])).toBe(true);
    expect(isTomeOfTheIcyeneWorn(["item:other", TOME_OF_THE_ICYENE_ID])).toBe(true);
    expect(isTomeOfTheIcyeneWorn(["item:tome-of-the-icyene-fake"])).toBe(false);
    expect(isTomeOfTheIcyeneWorn([])).toBe(false);
    expect(isTomeOfTheIcyeneWorn(undefined)).toBe(false);
  });
});

describe("icyenicScalingPrayer", () => {
  it("is zero unless the relic is active and the Tome is worn", () => {
    expect(icyenicScalingPrayer(50, { relicActive: true, tomeWorn: true })).toBe(50);
    expect(icyenicScalingPrayer(50, { relicActive: false, tomeWorn: true })).toBe(0);
    expect(icyenicScalingPrayer(50, { relicActive: true, tomeWorn: false })).toBe(0);
    expect(icyenicScalingPrayer(50, { relicActive: false, tomeWorn: false })).toBe(0);
  });

  it("clamps negative equipment prayer to zero when both gates pass", () => {
    expect(icyenicScalingPrayer(-12, { relicActive: true, tomeWorn: true })).toBe(0);
  });
});

describe("icyenicFaithBonuses", () => {
  it("gives 10% crit and 1.10x base AD at 50 Prayer (Tome face)", () => {
    const b = icyenicFaithBonuses(50);
    expect(b.totalPrayerBonus).toBe(50);
    expect(b.critChanceBonus).toBe(0.1);
    expect(b.baseAbilityDamageBonus).toBe(0.1);
    expect(b.baseAbilityDamageMultiplier).toBe(1.1);
  });

  it("is identity at 0 Prayer", () => {
    const b = icyenicFaithBonuses(0);
    expect(b.totalPrayerBonus).toBe(0);
    expect(b.critChanceBonus).toBe(0);
    expect(b.baseAbilityDamageBonus).toBe(0);
    expect(b.baseAbilityDamageMultiplier).toBe(1);
  });

  it("clamps negative Prayer to the zero-bonus identity", () => {
    const b = icyenicFaithBonuses(-40);
    expect(b.totalPrayerBonus).toBe(0);
    expect(b.critChanceBonus).toBe(0);
    expect(b.baseAbilityDamageBonus).toBe(0);
    expect(b.baseAbilityDamageMultiplier).toBe(1);
  });

  it("scales linearly at 0.2% per Prayer point", () => {
    const b = icyenicFaithBonuses(25);
    expect(b.critChanceBonus).toBeCloseTo(0.05, 10);
    expect(b.baseAbilityDamageBonus).toBeCloseTo(0.05, 10);
    expect(b.baseAbilityDamageMultiplier).toBeCloseTo(1.05, 10);
  });
});

describe("resolveIcyenicFaithBonuses", () => {
  it("composes scaling prayer then the bonus formula", () => {
    expect(
      resolveIcyenicFaithBonuses(50, { relicActive: true, tomeWorn: true }),
    ).toMatchObject({
      totalPrayerBonus: 50,
      critChanceBonus: 0.1,
      baseAbilityDamageBonus: 0.1,
      baseAbilityDamageMultiplier: 1.1,
    });
    expect(
      resolveIcyenicFaithBonuses(50, { relicActive: true, tomeWorn: false }),
    ).toMatchObject({
      totalPrayerBonus: 0,
      critChanceBonus: 0,
      baseAbilityDamageMultiplier: 1,
    });
    expect(
      resolveIcyenicFaithBonuses(50, { relicActive: false, tomeWorn: true }),
    ).toMatchObject({
      totalPrayerBonus: 0,
      critChanceBonus: 0,
      baseAbilityDamageMultiplier: 1,
    });
  });
});

describe("icyenicProtectionOutcome", () => {
  it("is inactive when the relic is off", () => {
    const outcome = icyenicProtectionOutcome({
      relicActive: false,
      windowSeconds: 60,
      scenario: {
        protectionActive: true,
        incomingHitIntervalSeconds: 6,
        incomingHitDamage: 1_000,
      },
    });
    expect(outcome.support).toBe("inactive");
    expect(outcome.unavailability).toBe("relic-inactive");
    expect(outcome.blockFraction).toBe(0);
    expect(outcome.qualifyingHits).toBeNull();
    expect(outcome.mitigatedDamage).toBeNull();
  });

  it("is scenario-dependent when protect is off", () => {
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 60,
      scenario: {
        protectionActive: false,
        incomingHitIntervalSeconds: 6,
      },
    });
    expect(outcome.support).toBe("scenario-dependent");
    expect(outcome.unavailability).toBe("protection-off");
    expect(outcome.blockFraction).toBe(1);
    expect(outcome.qualifyingHits).toBeNull();
    expect(outcome.mitigatedDamage).toBeNull();
    expect(outcome.missingInputs).toContain("protection prayer or deflection curse");
  });

  it("is scenario-dependent when protect is unset", () => {
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 60,
      scenario: { incomingHitIntervalSeconds: 6 },
    });
    expect(outcome.support).toBe("scenario-dependent");
    expect(outcome.unavailability).toBe("protection-off");
  });

  it("is scenario-dependent without an incoming hit interval", () => {
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 60,
      scenario: { protectionActive: true },
    });
    expect(outcome.support).toBe("scenario-dependent");
    expect(outcome.unavailability).toBe("no-scenario");
    expect(outcome.missingInputs).toContain("incoming hit interval");
    expect(outcome.blockFraction).toBe(1);
  });

  it("is scenario-dependent for non-positive or non-finite intervals", () => {
    for (const interval of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const outcome = icyenicProtectionOutcome({
        relicActive: true,
        windowSeconds: 60,
        scenario: {
          protectionActive: true,
          incomingHitIntervalSeconds: interval,
        },
      });
      expect(outcome.support).toBe("scenario-dependent");
      expect(outcome.unavailability).toBe("no-scenario");
    }
  });

  it("is scenario-dependent for invalid window duration", () => {
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 0,
      scenario: {
        protectionActive: true,
        incomingHitIntervalSeconds: 6,
      },
    });
    expect(outcome.support).toBe("scenario-dependent");
    expect(outcome.unavailability).toBe("invalid-duration");
    expect(outcome.mitigatedDamage).toBeNull();
  });

  it("is scenario-dependent for absurdly large hit intervals", () => {
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 60,
      scenario: {
        protectionActive: true,
        incomingHitIntervalSeconds: 3601,
      },
    });
    expect(outcome.support).toBe("scenario-dependent");
    expect(outcome.unavailability).toBe("invalid-interval");
  });

  it("models 100% block with qualifying hits when the interval is valid", () => {
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 30,
      scenario: {
        protectionActive: true,
        incomingHitIntervalSeconds: 6,
      },
    });
    expect(outcome.support).toBe("modeled");
    expect(outcome.unavailability).toBeNull();
    expect(outcome.blockFraction).toBe(1);
    expect(outcome.qualifyingHits).toBe(5);
    expect(outcome.mitigatedDamage).toBeNull();
    expect(outcome.missingInputs).toContain("incoming hit damage");
  });

  it("floors mitigated damage when hit size is known", () => {
    // floor(60/6) = 10 hits * 1234 * 1.0 block = 12340
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 60,
      scenario: {
        protectionActive: true,
        incomingHitIntervalSeconds: 6,
        incomingHitDamage: 1_234,
      },
    });
    expect(outcome.support).toBe("modeled");
    expect(outcome.qualifyingHits).toBe(10);
    expect(outcome.mitigatedDamage).toBe(12_340);
    expect(outcome.missingInputs).toEqual([]);
  });

  it("floors partial-window hit counts instead of rounding up", () => {
    // floor(29/6) = 4 hits
    const outcome = icyenicProtectionOutcome({
      relicActive: true,
      windowSeconds: 29,
      scenario: {
        protectionActive: true,
        incomingHitIntervalSeconds: 6,
        incomingHitDamage: 100,
      },
    });
    expect(outcome.qualifyingHits).toBe(4);
    expect(outcome.mitigatedDamage).toBe(400);
  });
});

describe("icyenicProtectionNote", () => {
  it("returns a non-empty note for every unavailability path", () => {
    const notes = [
      icyenicProtectionNote(
        icyenicProtectionOutcome({ relicActive: false, windowSeconds: 60 }),
      ),
      icyenicProtectionNote(
        icyenicProtectionOutcome({
          relicActive: true,
          windowSeconds: 60,
          scenario: { protectionActive: false },
        }),
      ),
      icyenicProtectionNote(
        icyenicProtectionOutcome({
          relicActive: true,
          windowSeconds: 60,
          scenario: { protectionActive: true },
        }),
      ),
      icyenicProtectionNote(
        icyenicProtectionOutcome({
          relicActive: true,
          windowSeconds: 0,
          scenario: { protectionActive: true, incomingHitIntervalSeconds: 6 },
        }),
      ),
      icyenicProtectionNote(
        icyenicProtectionOutcome({
          relicActive: true,
          windowSeconds: 60,
          scenario: {
            protectionActive: true,
            incomingHitIntervalSeconds: 3601,
          },
        }),
      ),
    ];
    for (const note of notes) {
      expect(typeof note).toBe("string");
      expect(note.length).toBeGreaterThan(0);
    }
  });

  it("names hit count and mitigation on a modeled outcome with hit size", () => {
    const note = icyenicProtectionNote(
      icyenicProtectionOutcome({
        relicActive: true,
        windowSeconds: 30,
        scenario: {
          protectionActive: true,
          incomingHitIntervalSeconds: 6,
          incomingHitDamage: 500,
        },
      }),
    );
    expect(note).toMatch(/100%/);
    expect(note).toMatch(/5 hits/);
    expect(note).toMatch(/2500 mitigated/);
  });

  it("notes unset hit size without inventing mitigation", () => {
    const note = icyenicProtectionNote(
      icyenicProtectionOutcome({
        relicActive: true,
        windowSeconds: 30,
        scenario: {
          protectionActive: true,
          incomingHitIntervalSeconds: 6,
        },
      }),
    );
    expect(note.length).toBeGreaterThan(0);
    expect(note).toMatch(/hit size unset/i);
  });
});

describe("icyenicSoulSplitHeal", () => {
  it("heals floor(damage * 0.1) only when relic and protect are both on", () => {
    expect(
      icyenicSoulSplitHeal(1_234, { relicActive: true, protectionActive: true }),
    ).toBe(123);
    expect(
      icyenicSoulSplitHeal(10, { relicActive: true, protectionActive: true }),
    ).toBe(1);
    expect(
      icyenicSoulSplitHeal(9, { relicActive: true, protectionActive: true }),
    ).toBe(0);
  });

  it("returns null when the relic or protect is off", () => {
    expect(
      icyenicSoulSplitHeal(1_000, { relicActive: false, protectionActive: true }),
    ).toBeNull();
    expect(
      icyenicSoulSplitHeal(1_000, { relicActive: true, protectionActive: false }),
    ).toBeNull();
    expect(
      icyenicSoulSplitHeal(1_000, { relicActive: false, protectionActive: false }),
    ).toBeNull();
  });

  it("returns null for non-finite or negative expected damage", () => {
    expect(
      icyenicSoulSplitHeal(Number.NaN, { relicActive: true, protectionActive: true }),
    ).toBeNull();
    expect(
      icyenicSoulSplitHeal(-1, { relicActive: true, protectionActive: true }),
    ).toBeNull();
  });
});

describe("icyenicSoulSplitNote", () => {
  it("returns non-empty notes for every gate state", () => {
    const notes = [
      icyenicSoulSplitNote(null, { relicActive: false, protectionActive: true }),
      icyenicSoulSplitNote(null, { relicActive: true, protectionActive: false }),
      icyenicSoulSplitNote(null, { relicActive: true, protectionActive: true }),
      icyenicSoulSplitNote(123, { relicActive: true, protectionActive: true }),
    ];
    for (const note of notes) {
      expect(typeof note).toBe("string");
      expect(note.length).toBeGreaterThan(0);
    }
  });

  it("includes the heal figure when available", () => {
    expect(
      icyenicSoulSplitNote(123, { relicActive: true, protectionActive: true }),
    ).toMatch(/123/);
  });
});
