import { describe, expect, it } from "vitest";
import {
  enchantedBoltActivationChance,
  enchantedBoltActivationGroup,
  enchantedBoltChancePercent,
} from "./enchantedBolt";

describe("enchanted bolt activation", () => {
  it("shares ordinary chance across ordinary and bakriminel mechanic identities", () => {
    expect(enchantedBoltActivationGroup("opal")).toBe("ordinary");
    expect(enchantedBoltActivationGroup("dragonstone")).toBe("ordinary");
    expect(enchantedBoltActivationChance("pearl")).toBe(0.05);
    expect(enchantedBoltActivationChance("pearl", { rangedCape: true })).toBe(0.06);
    expect(
      enchantedBoltActivationChance("pearl", {
        eliteSeersVillage: true,
        rangedCape: true,
      }),
    ).toBe(0.084);
  });

  it("adds Elite Seers before applying the Ranged cape multiplier", () => {
    expect(enchantedBoltActivationChance("emerald", { eliteSeersVillage: true })).toBe(0.57);
    expect(
      enchantedBoltActivationChance("emerald", {
        eliteSeersVillage: true,
        rangedCape: true,
      }),
    ).toBe(0.684);
    expect(
      enchantedBoltActivationChance("onyx", {
        eliteSeersVillage: true,
        rangedCape: true,
      }),
    ).toBe(0.144);
    expect(enchantedBoltChancePercent(0.684)).toBe(68.4);
  });

  it("does not assign a trigger chance to non-enchanted mechanics", () => {
    expect(enchantedBoltActivationChance("ordinary")).toBeNull();
    expect(enchantedBoltActivationChance("ful")).toBeNull();
  });
});
