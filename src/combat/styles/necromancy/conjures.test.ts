import { describe, expect, it } from "vitest";
import {
  CONJURE_IDS,
  CONJURES_CANNOT_CRIT,
  conjureActive,
  dismissConjure,
  newConjures,
  summonConjure,
} from "./conjures";

describe("conjures", () => {
  it("summons each spirit once and dismisses cleanly", () => {
    let state = newConjures();
    state = summonConjure(state, "vengeful_ghost");
    state = summonConjure(state, "vengeful_ghost");
    expect(state.active).toEqual(["vengeful_ghost"]);
    state = summonConjure(state, "putrid_zombie");
    expect(conjureActive(state, "putrid_zombie")).toBe(true);
    state = dismissConjure(state, "vengeful_ghost");
    expect(conjureActive(state, "vengeful_ghost")).toBe(false);
  });

  it("lists the four sourced spirits and the no-crit engine rule", () => {
    expect(CONJURE_IDS).toEqual([
      "skeleton_warrior",
      "vengeful_ghost",
      "putrid_zombie",
      "phantom_guardian",
    ]);
    expect(CONJURES_CANNOT_CRIT).toBe(true);
  });
});
