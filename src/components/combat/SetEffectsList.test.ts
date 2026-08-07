import { describe, expect, it } from "vitest";
import { setEffectsSummary } from "@/combat/shared/equipment";
import { setEffectCountLabel } from "./SetEffectsList";

describe("Set Bonuses reporting", () => {
  it("reports physical and effective set-piece totals separately", () => {
    const summary = setEffectsSummary({
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
      pieceContribution: { piecesPerItem: 3 },
    })[0]!;

    expect(setEffectCountLabel(summary)).toBe("3 equipped · 9 effective pieces");
  });
});
