import { describe, expect, it } from "vitest";
import { ammunitionAppliedEffectId, rangedEffectDisplayName } from "./ammunitionEffects";

describe("ranged ammunition presentation", () => {
  it("uses player-facing names for Perfect Equilibrium and modeled arrow effects", () => {
    expect(rangedEffectDisplayName("perfect_equilibrium")).toBe("Perfect Equilibrium");
    expect(rangedEffectDisplayName("puncture")).toBe("Splintering arrows · Puncture damage");
    expect(rangedEffectDisplayName("ammunition:bik")).toBe("Bik arrows · Evolving Toxin");
    expect(rangedEffectDisplayName("ammunition:wen-icy-precision")).toBe(
      "Wen arrows · Icy Precision",
    );
  });

  it("keeps ordinary arrows unlabelled while retaining crossbow bolt labels", () => {
    expect(ammunitionAppliedEffectId("ordinary")).toBeNull();
    expect(ammunitionAppliedEffectId("none")).toBeNull();
    expect(ammunitionAppliedEffectId("opal")).toBe("ammunition:opal");
    expect(rangedEffectDisplayName("ammunition:opal")).toBe("Opal bolts · Lucky Lightning");
  });
});
