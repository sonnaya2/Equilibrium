import { describe, expect, it } from "vitest";
import {
  HEIGHTENED_SENSES_ADRENALINE_BONUS,
  HEIGHTENED_SENSES_ID,
  applyHeightenedSensesCap,
} from "./heightenedSenses";

describe("heightenedSenses", () => {
  it("exports wiki constants", () => {
    expect(HEIGHTENED_SENSES_ID).toBe("heightened_senses");
    expect(HEIGHTENED_SENSES_ADRENALINE_BONUS).toBe(10);
  });

  it("adds 10 to the base cap when active", () => {
    expect(applyHeightenedSensesCap(100, true)).toBe(110);
    expect(applyHeightenedSensesCap(120, true)).toBe(130);
  });

  it("leaves the base cap when inactive", () => {
    expect(applyHeightenedSensesCap(100, false)).toBe(100);
    expect(applyHeightenedSensesCap(120, false)).toBe(120);
  });
});
