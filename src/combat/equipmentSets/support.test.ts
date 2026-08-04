import { describe, expect, it } from "vitest";
import { SET_SUPPORT_BY_ID, setEffectSupport } from "./support";

describe("equipmentSets/support", () => {
  it("maps known catalogue sets and defaults missing ids to none", () => {
    expect(setEffectSupport({ id: "tectonic" })).toBe("modeled");
    expect(setEffectSupport({ id: "elite-tectonic" })).toBe("modeled");
    expect(setEffectSupport({ id: "sirenic" })).toBe("not-modeled");
    expect(setEffectSupport({ id: "trimmed-masterwork" })).toBe("outgoing-only");
    expect(setEffectSupport({ id: "unknown-set-xyz" })).toBe("none");
    expect(setEffectSupport(undefined)).toBe("not-modeled");
  });

  it("does not invent support for grouping tags (igneous / leng)", () => {
    expect(SET_SUPPORT_BY_ID.igneous).toBeUndefined();
    expect(SET_SUPPORT_BY_ID.leng).toBeUndefined();
    expect(setEffectSupport({ id: "igneous" })).toBe("none");
    expect(setEffectSupport({ id: "leng" })).toBe("none");
  });
});
