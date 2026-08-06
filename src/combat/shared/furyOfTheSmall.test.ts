import { describe, expect, it } from "vitest";
import {
  FURY_OF_THE_SMALL_EXTRA_ADRENALINE,
  FURY_OF_THE_SMALL_ID,
  furyOfTheSmallQualifies,
} from "./furyOfTheSmall";

describe("furyOfTheSmall", () => {
  it("exports wiki constants", () => {
    expect(FURY_OF_THE_SMALL_ID).toBe("fury_of_the_small");
    expect(FURY_OF_THE_SMALL_EXTRA_ADRENALINE).toBe(1);
  });

  it("qualifies adrenaline-generating Basic abilities", () => {
    expect(furyOfTheSmallQualifies({ category: "basic", adrenaline: { gain: 9 } })).toBe(true);
    expect(furyOfTheSmallQualifies({ category: "threshold", adrenaline: { gain: 2 } })).toBe(false);
  });

  it("rejects non-basics, zero gain, and missing gain", () => {
    expect(furyOfTheSmallQualifies({ category: "threshold", adrenaline: { gain: 9 } })).toBe(false);
    expect(furyOfTheSmallQualifies({ category: "ultimate", adrenaline: { gain: 9 } })).toBe(false);
    expect(furyOfTheSmallQualifies({ category: "basic", adrenaline: { gain: 0 } })).toBe(false);
    expect(furyOfTheSmallQualifies({ category: "basic" })).toBe(false);
  });
});
