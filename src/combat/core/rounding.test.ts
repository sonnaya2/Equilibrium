import { describe, expect, it } from "vitest";
import { mulFloor, percentFloor } from "./rounding";

describe("rounding", () => {
  it("floors each step — a chain is not one collapsed multiply", () => {
    const chained = mulFloor(mulFloor(101, 0.9), 2);
    const collapsed = Math.floor(101 * 0.9 * 2);
    expect(chained).toBe(180);
    expect(collapsed).toBe(181);
    expect(chained).not.toBe(collapsed);
  });

  it("percentFloor floors the product", () => {
    expect(percentFloor(1000, 110)).toBe(1100);
    expect(percentFloor(1001, 110)).toBe(1101);
    expect(percentFloor(999, 33)).toBe(329);
  });
});
