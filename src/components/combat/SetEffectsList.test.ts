import { describe, expect, it } from "vitest";
import { activeEquipmentEffects, setEffectsSummary } from "@/combat/shared/equipment";
import { dracolichRuntimeLines, setEffectCountLabel } from "./SetEffectsList";

describe("Set Bonuses reporting", () => {
  it("reports physical and effective set-piece totals separately", () => {
    const summary = setEffectsSummary({
      equipmentSlots: {
        helmet: "item:tectonic-helm",
        body: "item:tectonic-body",
        legs: "item:tectonic-legs",
      },
      pieceContribution: { additionalPiecesPerItem: 2 },
    })[0]!;

    expect(setEffectCountLabel(summary)).toBe("3 equipped · 9 effective pieces");
    expect(setEffectCountLabel({ pieces: 1, effectivePieces: 1 })).toBe(
      "1 equipped · 1 effective piece",
    );
  });

  it("reports core-resolved Dracolich payout and threshold state", () => {
    const effects = activeEquipmentEffects({
      style: "ranged",
      equipmentSlots: {
        twohand: "item:noxious-longbow",
        body: "item:dracolich-body",
      },
      pieceContribution: { additionalPiecesPerItem: 2 },
    });

    expect(dracolichRuntimeLines(effects.dracolich!)).toEqual([
      "Rapid Fire: +0.6 adrenaline each 0.6s Rapid Fire iteration",
      "Infusion thresholds: 3-piece active · 4-piece inactive · 5-piece inactive",
      "Bow infusion: +20% ranged critical strike chance for 5 ticks from channel completion",
    ]);
  });
});
