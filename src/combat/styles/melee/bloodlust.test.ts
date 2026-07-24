import { describe, expect, it } from "vitest";
import {
  activateBerserk,
  bloodlustCap,
  gainBloodlust,
  newBloodlust,
  spendBloodlust,
} from "./bloodlust";

describe("bloodlust", () => {
  it("builds to a cap of 4", () => {
    let s = newBloodlust();
    s = gainBloodlust(s, 1);
    s = gainBloodlust(s, 2);
    s = gainBloodlust(s, 2);
    expect(s.stacks).toBe(4);
    expect(bloodlustCap(s)).toBe(4);
  });

  it("Berserk raises the cap to 8, grants 4 on activation, doubles generation", () => {
    let s = activateBerserk(newBloodlust());
    expect(s.stacks).toBe(4);
    s = gainBloodlust(s, 1);
    expect(s.stacks).toBe(6);
    s = gainBloodlust(s, 2);
    expect(s.stacks).toBe(8);
  });

  it("spending never drops below zero", () => {
    expect(spendBloodlust({ stacks: 2, berserk: false }, 5).stacks).toBe(0);
  });
});
