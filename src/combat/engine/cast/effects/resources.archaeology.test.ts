import { describe, expect, it } from "vitest";
import { createCastContext } from "../../simulation/simulate";
import { baseInput } from "../../../test/fixtures/inputs";
import { FURY_OF_THE_SMALL_EXTRA_ADRENALINE } from "../../../shared/furyOfTheSmall";
import { CONSERVATION_OF_ENERGY_REFUND } from "../../../shared/conservationOfEnergy";
import { HEIGHTENED_SENSES_ADRENALINE_BONUS } from "../../../shared/heightenedSenses";
import type { AbilitySpec } from "../../../pipeline/calculateAbility";

const attack = baseInput.abilities.find((a) => a.id === "attack")!;
const assault = baseInput.abilities.find((a) => a.id === "assault")!;
const berserk = baseInput.abilities.find((a) => a.id === "berserk")!;
const listedBasicGain = attack.adrenaline!.gain!;

describe("Fury of the Small (engine)", () => {
  it("adds +1 to basic adrenaline gain", () => {
    const ctx = createCastContext({
      ...baseInput,
      adrenaline: { basicAdrenalineFlatBonus: FURY_OF_THE_SMALL_EXTRA_ADRENALINE },
    });
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBeCloseTo(listedBasicGain + 1, 10);
  });

  it("does not add +1 to non-basic spenders", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { basicAdrenalineFlatBonus: FURY_OF_THE_SMALL_EXTRA_ADRENALINE },
    });
    expect(ctx.performCast(assault, 0, false).ok).toBe(true);
    // Assault spends 25 with no listed gain.
    expect(ctx.getState().adrenaline).toBe(75);
  });

  it("Invigorating multiplies listed gain including FotS +1", () => {
    const ctx = createCastContext({
      ...baseInput,
      adrenaline: {
        basicAdrenalineFlatBonus: FURY_OF_THE_SMALL_EXTRA_ADRENALINE,
        basicGainMultiplier: 1.2,
      },
    });
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBeCloseTo((listedBasicGain + 1) * 1.2, 10);
  });
});

describe("Conservation of Energy (engine)", () => {
  it("refunds 10 after an ultimate spend", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ultimateAdrenalineRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    // 100 - 100 cost + 10 CoE
    expect(ctx.getState().adrenaline).toBe(10);
  });

  it("does not refund on non-ultimates", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ultimateAdrenalineRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(ctx.performCast(assault, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(75);
  });

  it("refunds once per ultimate cast (not double on one cast)", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ultimateAdrenalineRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);
    expect(ctx.getState().adrenaline).not.toBe(20);
  });

  it("refunds once on each of two ultimate casts", () => {
    // No-CD ultimates cost 50 so CoE leaves enough for a second cast.
    const ultA: AbilitySpec = {
      id: "test_ult_a",
      name: "Test Ult A",
      style: "melee",
      category: "ultimate",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 50 },
    };
    const ultB: AbilitySpec = {
      id: "test_ult_b",
      name: "Test Ult B",
      style: "melee",
      category: "ultimate",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 50 },
    };
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      abilities: [...baseInput.abilities, ultA, ultB],
      adrenaline: { ultimateAdrenalineRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(ctx.performCast(ultA, 0, false).ok).toBe(true);
    // 100 - 50 + 10 = 60
    expect(ctx.getState().adrenaline).toBe(60);
    expect(ctx.performCast(ultB, ctx.getState().tick, false).ok).toBe(true);
    // 60 - 50 + 10 = 20
    expect(ctx.getState().adrenaline).toBe(20);
  });

  it("still refunds after Relentless full refund", () => {
    // 50-cost ult so Relentless keeps adren and CoE +10 is visible under the 100 cap.
    const ult: AbilitySpec = {
      id: "test_ult_relentless",
      name: "Test Ult",
      style: "melee",
      category: "ultimate",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 50 },
    };
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 80,
      abilities: [...baseInput.abilities, ult],
      adrenaline: {
        ultimateAdrenalineRefund: CONSERVATION_OF_ENERGY_REFUND,
        relentlessRank: 5,
      },
    });
    expect(ctx.performCast(ult, 0, false, { relentless: true }).ok).toBe(true);
    // Relentless keeps 80; CoE still refunds +10 once.
    expect(ctx.getState().adrenaline).toBe(90);
  });

  it("excludes onslaught ids", () => {
    const onslaught: AbilitySpec = {
      id: "onslaught",
      name: "Onslaught",
      style: "melee",
      category: "ultimate",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 100 },
    };
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      abilities: [...baseInput.abilities, onslaught],
      adrenaline: { ultimateAdrenalineRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(ctx.performCast(onslaught, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(0);
  });
  it("respects adrenaline cap when refund would exceed it", () => {
    // 50-cost ult + Relentless keeps full adren; CoE +10 must clamp at cap.
    const ult: AbilitySpec = {
      id: "test_ult_cap",
      name: "Test Ult Cap",
      style: "melee",
      category: "ultimate",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 50 },
    };
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      abilities: [...baseInput.abilities, ult],
      adrenaline: {
        ultimateAdrenalineRefund: CONSERVATION_OF_ENERGY_REFUND,
        relentlessRank: 5,
      },
    });
    expect(ctx.getState().adrenalineCap).toBe(100);
    expect(ctx.performCast(ult, 0, false, { relentless: true }).ok).toBe(true);
    // Relentless keeps 100; CoE tries +10 but gainAdrenaline clamps to 100.
    expect(ctx.getState().adrenaline).toBe(100);
  });
});

describe("Heightened Senses (engine)", () => {
  it("raises cap to 110 and clamps gains", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 105,
      adrenaline: {
        maxAdrenalineBonus: HEIGHTENED_SENSES_ADRENALINE_BONUS,
        basicAdrenalineFlatBonus: FURY_OF_THE_SMALL_EXTRA_ADRENALINE,
      },
    });
    expect(ctx.getState().adrenalineCap).toBe(110);
    expect(ctx.getState().adrenaline).toBe(105);
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    // 105 + (listed + 1) would exceed 110 without clamp.
    expect(ctx.getState().adrenaline).toBe(110);
  });

  it("rejects startingAdrenaline above the raised cap", () => {
    expect(() =>
      createCastContext({
        ...baseInput,
        startingAdrenaline: 111,
        adrenaline: { maxAdrenalineBonus: HEIGHTENED_SENSES_ADRENALINE_BONUS },
      }),
    ).toThrow(/startingAdrenaline outside 0-110/);
  });
});
