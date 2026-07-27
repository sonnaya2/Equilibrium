import { describe, expect, it } from "vitest";
import { ELECTIVE_CAP, canSelectElective, emptyBuild, toggleElective } from "./index";

describe("elective region pick limit", () => {
  it("exposes ELECTIVE_CAP of 3 for UI pips and counters", () => {
    expect(ELECTIVE_CAP).toBe(3);
  });

  it("blocks a fourth elective pick", () => {
    let state = emptyBuild();
    const picks = ["asgarnia", "kandarin", "desert"] as const;
    for (const id of picks) {
      expect(canSelectElective(state, id)).toBe(true);
      state = toggleElective(state, id);
    }
    expect(state.elective).toHaveLength(ELECTIVE_CAP);
    expect(canSelectElective(state, "morytania")).toBe(false);
    const blocked = toggleElective(state, "morytania");
    expect(blocked.elective).toHaveLength(ELECTIVE_CAP);
    expect(blocked.elective).not.toContain("morytania");
  });
});
