import { describe, expect, it } from "vitest";
import {
  isBasicAttack,
  isGeneratingBasicAbility,
  resolveAbilityAdrenalineGain,
  resolveAbilityAdrenalineGainBreakdown,
} from "./adrenalineGain";

const attack = {
  id: "attack",
  category: "basic" as const,
  basicAttack: true,
  adrenaline: { gain: 9 },
};

const rend = {
  id: "rend",
  category: "basic" as const,
  adrenaline: { gain: 9 },
};

describe("eligibility", () => {
  it("identifies Basic Attacks without treating every basic as one", () => {
    expect(isBasicAttack(attack)).toBe(true);
    expect(isBasicAttack(rend)).toBe(false);
  });

  it("does not treat legacy autoattacks as post-modernisation Basic Attacks", () => {
    expect(isBasicAttack({ autoAttack: true })).toBe(false);
  });

  it("isGeneratingBasicAbility needs listed gain > 0", () => {
    expect(isGeneratingBasicAbility(attack)).toBe(true);
    expect(isGeneratingBasicAbility(rend)).toBe(true);
    expect(isGeneratingBasicAbility({ category: "basic", adrenaline: { gain: 0 } })).toBe(false);
    expect(isGeneratingBasicAbility({ category: "threshold", adrenaline: { gain: 9 } })).toBe(
      false,
    );
  });
});

describe("resolveAbilityAdrenalineGain (expected, no Impatient)", () => {
  it("basic attack, no mods: 9", () => {
    expect(resolveAbilityAdrenalineGain(attack)).toBe(9);
  });

  it("basic attack + Fury: 10", () => {
    expect(resolveAbilityAdrenalineGain(attack, { basicAdrenalineFlatBonus: 1 })).toBe(10);
  });

  it("basic attack + Invig4: 10.8", () => {
    expect(resolveAbilityAdrenalineGain(attack, { basicGainMultiplier: 1.2 })).toBeCloseTo(
      10.8,
      10,
    );
  });

  it("basic attack + Fury + Invig4: 12", () => {
    expect(
      resolveAbilityAdrenalineGain(attack, {
        basicAdrenalineFlatBonus: 1,
        basicGainMultiplier: 1.2,
      }),
    ).toBeCloseTo(12, 10);
  });

  it("non-attack basic + Fury: listed+1", () => {
    expect(resolveAbilityAdrenalineGain(rend, { basicAdrenalineFlatBonus: 1 })).toBe(10);
  });

  it("non-attack basic + Invig4: listed unchanged by invig", () => {
    expect(resolveAbilityAdrenalineGain(rend, { basicGainMultiplier: 1.2 })).toBe(9);
  });

  it("does not apply FotS to thresholds", () => {
    const assault = { category: "threshold" as const, adrenaline: { gain: 9 } };
    expect(isGeneratingBasicAbility(assault)).toBe(false);
    expect(resolveAbilityAdrenalineGain(assault, { basicAdrenalineFlatBonus: 1 })).toBe(9);
  });

  it("abilityGainMultiplier applies after Invigorating", () => {
    expect(
      resolveAbilityAdrenalineGain(attack, {
        basicAdrenalineFlatBonus: 1,
        basicGainMultiplier: 1.2,
        abilityGainMultiplier: 1.5,
      }),
    ).toBeCloseTo(18, 10);
  });
});

describe("resolveAbilityAdrenalineGainBreakdown with Impatient", () => {
  it("basic attack + Impatient + Invig4: 14.4", () => {
    const b = resolveAbilityAdrenalineGainBreakdown({
      listedGain: 9,
      isGeneratingBasicAbility: true,
      isBasicAttack: true,
      impatientProc: true,
      basicGainMultiplier: 1.2,
    });
    expect(b.impatientGain).toBe(3);
    expect(b.gainBeforeInvigorating).toBe(12);
    expect(b.totalAbilityGain).toBeCloseTo(14.4, 10);
  });

  it("basic attack + Fury + Impatient + Invig4: 15.6", () => {
    const b = resolveAbilityAdrenalineGainBreakdown({
      listedGain: 9,
      isGeneratingBasicAbility: true,
      isBasicAttack: true,
      impatientProc: true,
      basicAdrenalineFlatBonus: 1,
      basicGainMultiplier: 1.2,
    });
    expect(b.totalAbilityGain).toBeCloseTo(15.6, 10);
  });

  it("non-attack basic + Fury + Impatient: listed+4, no invig", () => {
    const b = resolveAbilityAdrenalineGainBreakdown({
      listedGain: 9,
      isGeneratingBasicAbility: true,
      isBasicAttack: false,
      impatientProc: true,
      basicAdrenalineFlatBonus: 1,
      basicGainMultiplier: 1.2,
    });
    expect(b.invigoratingMultiplier).toBe(1);
    expect(b.totalAbilityGain).toBe(13);
  });
});
