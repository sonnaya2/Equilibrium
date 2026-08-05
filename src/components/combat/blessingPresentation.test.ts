import { describe, expect, it } from "vitest";
import {
  BLESSING_DAMAGE_EFFECT_IDS,
  blessingEffectDisplayName,
  blessingEventTypeLabel,
  formatBlessingByEffectLabel,
  isBlessingDamageEffectId,
  isBlessingDamageEvent,
  isBlessingEffectRow,
} from "./blessingPresentation";

describe("blessingPresentation", () => {
  it("labels known blessing damage effect ids", () => {
    expect(blessingEffectDisplayName("big-boned")).toBe("Big Boned");
    expect(blessingEffectDisplayName("abyssal-cinders")).toBe("Cinders");
    expect(blessingEffectDisplayName("inferno-of-zamorak")).toBe("Inferno");
    expect(blessingEffectDisplayName("light-of-saradomin")).toBe("Striking Light");
    expect(blessingEffectDisplayName("grasp-of-guthix")).toBe("Grasp of Guthix");
    expect(blessingEffectDisplayName("greater_ricochet")).toBeNull();
  });

  it("recognizes every catalogued blessing damage effect id", () => {
    for (const id of BLESSING_DAMAGE_EFFECT_IDS) {
      expect(isBlessingDamageEffectId(id)).toBe(true);
      expect(blessingEffectDisplayName(id)).toBeTruthy();
    }
  });

  it("marks blessing events as type Blessing (not Hit / Bonus)", () => {
    expect(
      blessingEventTypeLabel({ family: "blessing", abilityId: "big-boned" }),
    ).toBe("Blessing");
    expect(
      blessingEventTypeLabel({ family: "hit", blessingId: "big-boned", abilityId: "big-boned" }),
    ).toBe("Blessing");
    expect(blessingEventTypeLabel({ family: "hit", abilityId: "inferno-of-zamorak" })).toBe(
      "Blessing",
    );
    expect(blessingEventTypeLabel({ family: "hit", abilityId: "dismember" })).toBeNull();
  });

  it("detects blessing damage events for family, blessingId, or effect id", () => {
    expect(isBlessingDamageEvent({ family: "blessing", abilityId: "x" })).toBe(true);
    expect(isBlessingDamageEvent({ family: "hit", blessingId: "big-boned" })).toBe(true);
    expect(isBlessingDamageEvent({ family: "hit", abilityId: "grasp-of-guthix" })).toBe(true);
    expect(isBlessingDamageEvent({ family: "hit", abilityId: "slice" })).toBe(false);
  });

  it("prefixes byEffect labels for league-blessing rows", () => {
    expect(isBlessingEffectRow("big-boned", "league-blessing")).toBe(true);
    expect(isBlessingEffectRow("slice", "ability-direct")).toBe(false);
    expect(formatBlessingByEffectLabel("big-boned", "league-blessing", "Big Boned")).toBe(
      "Blessing · Big Boned",
    );
    expect(formatBlessingByEffectLabel("inferno-of-zamorak", undefined, "Inferno")).toBe(
      "Blessing · Inferno",
    );
    expect(formatBlessingByEffectLabel("slice", "ability-direct", "Slice")).toBe("Slice");
    expect(
      formatBlessingByEffectLabel("big-boned", "league-blessing", "Blessing · Big Boned"),
    ).toBe("Blessing · Big Boned");
  });
});
