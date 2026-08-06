import { describe, expect, it } from "vitest";
import {
  netAdrenalineDeltaFromTransaction,
  previewAdrenalineTransaction,
  resolveAdrenalineTransaction,
} from "./adrenalineTransaction";
import { CONSERVATION_OF_ENERGY_REFUND } from "./conservationOfEnergy";
import { RING_OF_VIGOUR_REFUND } from "./ringOfVigour";

const baseGain = {
  listedGain: 9,
  isGeneratingBasicAbility: true,
  isBasicAttack: true,
  listedCost: 0,
  effectiveCost: 0,
  relentlessProc: false,
  before: 0,
  cap: 100,
};

describe("resolveAdrenalineTransaction - generation", () => {
  it("1. basic attack, no mods: 9", () => {
    const tx = resolveAdrenalineTransaction(baseGain);
    expect(tx.totalAbilityGain).toBe(9);
    expect(tx.afterResources).toBe(9);
  });

  it("2. basic attack + Fury: 10", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      basicAdrenalineFlatBonus: 1,
    });
    expect(tx.furyOfTheSmallGain).toBe(1);
    expect(tx.totalAbilityGain).toBe(10);
  });

  it("3. basic attack + Invig4: 10.8", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      basicGainMultiplier: 1.2,
    });
    expect(tx.totalAbilityGain).toBeCloseTo(10.8, 10);
  });

  it("4. basic attack + Fury + Invig4: 12", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      basicAdrenalineFlatBonus: 1,
      basicGainMultiplier: 1.2,
    });
    expect(tx.totalAbilityGain).toBeCloseTo(12, 10);
  });

  it("5. basic attack + Impatient + Invig4: 14.4", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      impatientProc: true,
      basicGainMultiplier: 1.2,
    });
    // (9 + 3) * 1.2
    expect(tx.impatientGain).toBe(3);
    expect(tx.gainBeforeInvigorating).toBe(12);
    expect(tx.totalAbilityGain).toBeCloseTo(14.4, 10);
  });

  it("6. basic attack + Fury + Impatient + Invig4: 15.6", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      impatientProc: true,
      basicAdrenalineFlatBonus: 1,
      basicGainMultiplier: 1.2,
    });
    // (9 + 1 + 3) * 1.2 = 15.6
    expect(tx.totalAbilityGain).toBeCloseTo(15.6, 10);
    expect(tx.afterResources).toBeCloseTo(15.6, 10);
  });

  it("7. non-attack basic + Fury: listed+1", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      isBasicAttack: false,
      basicAdrenalineFlatBonus: 1,
    });
    expect(tx.totalAbilityGain).toBe(10);
  });

  it("8. non-attack basic + Invig4: listed unchanged by invig", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      isBasicAttack: false,
      basicGainMultiplier: 1.2,
    });
    expect(tx.invigoratingMultiplier).toBe(1);
    expect(tx.totalAbilityGain).toBe(9);
  });

  it("9. non-attack basic + Fury + Impatient: listed+4", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      isBasicAttack: false,
      impatientProc: true,
      basicAdrenalineFlatBonus: 1,
      basicGainMultiplier: 1.2,
    });
    expect(tx.totalAbilityGain).toBe(13);
  });

  it("Meteor mult sits after flats, before Invigorating", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      basicAdrenalineFlatBonus: 1,
      impatientProc: true,
      meteorBasicMultiplier: 1.5,
      basicGainMultiplier: 1.2,
    });
    // (9+1+3)*1.5*1.2 = 23.4
    expect(tx.gainBeforeInvigorating).toBeCloseTo(19.5, 10);
    expect(tx.totalAbilityGain).toBeCloseTo(23.4, 10);
  });

  it("abilityGainMultiplier after Invigorating", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      basicAdrenalineFlatBonus: 1,
      impatientProc: true,
      basicGainMultiplier: 1.2,
      abilityGainMultiplier: 1.5,
    });
    // (9+1+3)*1.2*1.5 = 23.4
    expect(tx.totalAbilityGain).toBeCloseTo(23.4, 10);
  });
});

describe("resolveAdrenalineTransaction - spend / refunds", () => {
  it("10. ultimate 100 from 100: neither / CoE / Vigour / both", () => {
    const baseUlt = {
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 100,
      effectiveCost: 100,
      relentlessProc: false,
    };

    const neither = resolveAdrenalineTransaction(baseUlt);
    expect(neither.actualSpend).toBe(100);
    expect(neither.afterResources).toBe(0);

    const coe = resolveAdrenalineTransaction({
      ...baseUlt,
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
    });
    expect(coe.afterResources).toBe(10);

    const vigour = resolveAdrenalineTransaction({
      ...baseUlt,
      ringOfVigourRefund: RING_OF_VIGOUR_REFUND,
    });
    expect(vigour.afterResources).toBe(10);

    const both = resolveAdrenalineTransaction({
      ...baseUlt,
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
      ringOfVigourRefund: RING_OF_VIGOUR_REFUND,
    });
    expect(both.afterResources).toBe(20);
  });

  it("11. Onslaught: neither refund (caller passes 0)", () => {
    const tx = resolveAdrenalineTransaction({
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 100,
      effectiveCost: 100,
      relentlessProc: false,
      conservationOfEnergyRefund: 0,
      ringOfVigourRefund: 0,
    });
    expect(tx.afterResources).toBe(0);
  });

  it("12. cap clamp", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      before: 95,
      basicAdrenalineFlatBonus: 1,
      basicGainMultiplier: 1.2,
    });
    // 95 + 12 would be 107
    expect(tx.afterResourcesUnclamped).toBeCloseTo(107, 10);
    expect(tx.afterResources).toBe(100);
  });

  it("13. Relentless prevents spend; CoE still refunds", () => {
    const tx = resolveAdrenalineTransaction({
      before: 80,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 50,
      effectiveCost: 50,
      relentlessProc: true,
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
    });
    expect(tx.actualSpend).toBe(0);
    expect(tx.spendPreventedBy).toBe("relentless");
    expect(tx.afterResources).toBe(90);
  });

  it("Deathspore zeros spend while cost still listed", () => {
    const tx = resolveAdrenalineTransaction({
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 50,
      effectiveCost: 50,
      relentlessProc: false,
      spendZeroReason: "deathspore",
    });
    expect(tx.actualSpend).toBe(0);
    expect(tx.spendPreventedBy).toBe("deathspore");
    expect(tx.afterResources).toBe(100);
  });

  it("Relentless wins over deathspore when both set", () => {
    const tx = resolveAdrenalineTransaction({
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 50,
      effectiveCost: 50,
      relentlessProc: true,
      spendZeroReason: "deathspore",
    });
    expect(tx.spendPreventedBy).toBe("relentless");
  });

  it("otherImmediateGrants (jaws) fold into afterResources", () => {
    const tx = resolveAdrenalineTransaction({
      ...baseGain,
      otherImmediateGrants: 4,
    });
    expect(tx.afterResources).toBe(13);
  });

  it("reconciles after = clamp(before + gains - spend + refunds)", () => {
    const tx = resolveAdrenalineTransaction({
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 100,
      effectiveCost: 100,
      relentlessProc: false,
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
      ringOfVigourRefund: RING_OF_VIGOUR_REFUND,
      otherImmediateGrants: 0,
    });
    const unclamped =
      tx.before +
      tx.totalAbilityGain +
      tx.otherImmediateGrants -
      tx.actualSpend +
      tx.conservationOfEnergyRefund +
      tx.ringOfVigourRefund;
    expect(tx.afterResourcesUnclamped).toBe(unclamped);
    expect(tx.afterResources).toBe(Math.min(tx.cap, Math.max(0, unclamped)));
    expect(tx.afterResources).toBe(20);
  });

  it("Vigour + CoE + Relentless clamp at cap", () => {
    const tx = resolveAdrenalineTransaction({
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 50,
      effectiveCost: 50,
      relentlessProc: true,
      conservationOfEnergyRefund: 10,
      ringOfVigourRefund: 10,
    });
    expect(tx.afterResourcesUnclamped).toBe(120);
    expect(tx.afterResources).toBe(100);
  });

  it("qualifying ultimate: Vigour alone nets exactly +10 retain from 100-cost", () => {
    const tx = resolveAdrenalineTransaction({
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 100,
      effectiveCost: 100,
      relentlessProc: false,
      ringOfVigourRefund: RING_OF_VIGOUR_REFUND,
    });
    expect(tx.ringOfVigourRefund).toBe(10);
    expect(tx.conservationOfEnergyRefund).toBe(0);
    expect(tx.afterResources).toBe(10);
    expect(netAdrenalineDeltaFromTransaction(tx)).toBe(-90);
  });

  it("CoE + Vigour nets exactly +20 retain (additive fields, not stacked sources)", () => {
    const tx = resolveAdrenalineTransaction({
      before: 100,
      cap: 100,
      listedGain: 0,
      isGeneratingBasicAbility: false,
      isBasicAttack: false,
      listedCost: 100,
      effectiveCost: 100,
      relentlessProc: false,
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
      ringOfVigourRefund: RING_OF_VIGOUR_REFUND,
    });
    expect(tx.conservationOfEnergyRefund + tx.ringOfVigourRefund).toBe(20);
    expect(tx.afterResources).toBe(20);
    expect(netAdrenalineDeltaFromTransaction(tx)).toBe(-80);
  });
});

describe("previewAdrenalineTransaction (analysis SSOT)", () => {
  const ult = {
    id: "berserk",
    category: "ultimate",
    adrenaline: { cost: 100 },
  };
  const threshold = {
    id: "assault",
    category: "threshold",
    adrenaline: { cost: 25 },
  };
  const special = {
    id: "instability",
    category: "enhanced",
    weaponSpecial: true,
    adrenaline: { cost: 50 },
  };

  it("Vigour ultimate: refund field 10, net -90", () => {
    const tx = previewAdrenalineTransaction(ult, { ringOfVigour: true });
    expect(tx.ringOfVigourRefund).toBe(10);
    expect(tx.conservationOfEnergyRefund).toBe(0);
    expect(tx.actualSpend).toBe(100);
    expect(netAdrenalineDeltaFromTransaction(tx)).toBe(-90);
  });

  it("CoE + Vigour ultimate: exactly +20 refunds, net -80", () => {
    const tx = previewAdrenalineTransaction(ult, {
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
      ringOfVigour: true,
    });
    expect(tx.conservationOfEnergyRefund).toBe(10);
    expect(tx.ringOfVigourRefund).toBe(10);
    expect(netAdrenalineDeltaFromTransaction(tx)).toBe(-80);
  });

  it("weapon special: requirement and spend use same Vigour discount", () => {
    const tx = previewAdrenalineTransaction(special, { ringOfVigour: true });
    expect(tx.listedCost).toBe(50);
    expect(tx.effectiveCost).toBe(45);
    expect(tx.actualSpend).toBe(45);
    expect(tx.ringOfVigourRefund).toBe(0);
    expect(netAdrenalineDeltaFromTransaction(tx)).toBe(-45);
  });

  it("non-special threshold: cost unchanged, no ultimate refunds", () => {
    const tx = previewAdrenalineTransaction(threshold, {
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
      ringOfVigour: true,
    });
    expect(tx.listedCost).toBe(25);
    expect(tx.effectiveCost).toBe(25);
    expect(tx.actualSpend).toBe(25);
    expect(tx.conservationOfEnergyRefund).toBe(0);
    expect(tx.ringOfVigourRefund).toBe(0);
    expect(netAdrenalineDeltaFromTransaction(tx)).toBe(-25);
  });
});
