import { describe, expect, it } from "vitest";
import { activeEquipmentEffects, setEffectsSummary } from "@/combat/shared/equipment";
import type { ChromaticChoirSetSummary } from "@/combat/styles/ranged/chromaticChoir";
import {
  chromaticChoirRuntimeLines,
  dracolichRuntimeLines,
  setEffectCountLabel,
} from "./SetEffectsList";

function choirSummary(
  partial: Partial<ChromaticChoirSetSummary> &
    Pick<ChromaticChoirSetSummary, "procChance" | "gems" | "thresholds">,
): ChromaticChoirSetSummary {
  return {
    setId: "sirenic",
    physicalPieces: 2,
    effectivePieces: 2,
    crossbowEligible: true,
    mixed: false,
    ...partial,
  };
}

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

  it("reports Chromatic Choir mixed, crossbow gate, and gem lines", () => {
    expect(
      chromaticChoirRuntimeLines(
        choirSummary({
          setId: null,
          mixed: true,
          physicalPieces: 3,
          effectivePieces: 0,
          crossbowEligible: false,
          procChance: 0,
          thresholds: { two: false, three: false },
          gems: [],
        }),
      ),
    ).toEqual(["Mixed Sirenic / Elite - inactive"]);

    expect(
      chromaticChoirRuntimeLines(
        choirSummary({
          crossbowEligible: false,
          procChance: 0,
          thresholds: { two: true, three: false },
          gems: ["dragonstone"],
        }),
      ),
    ).toEqual(["Needs crossbow"]);

    expect(
      chromaticChoirRuntimeLines(
        choirSummary({
          procChance: 0.06,
          thresholds: { two: true, three: false },
          gems: ["dragonstone"],
        }),
      ),
    ).toEqual(["Choir 6% · Dragonstone"]);

    expect(
      chromaticChoirRuntimeLines(
        choirSummary({
          setId: "elite-sirenic",
          procChance: 0.12,
          thresholds: { two: true, three: true },
          gems: ["dragonstone", "onyx", "hydrix"],
        }),
      ),
    ).toEqual(["Choir 12% · Dragonstone / Onyx / Hydrix"]);
  });

  it("reports core-resolved Chromatic Choir from active equipment effects", () => {
    const two = activeEquipmentEffects({
      style: "ranged",
      equipmentSlots: {
        twohand: "item:eldritch-crossbow",
        body: "item:sirenic-hauberk",
        legs: "item:sirenic-chaps",
      },
    });
    expect(chromaticChoirRuntimeLines(two.chromaticChoir!)).toEqual(["Choir 6% · Dragonstone"]);

    const threeElite = activeEquipmentEffects({
      style: "ranged",
      equipmentSlots: {
        twohand: "item:eldritch-crossbow",
        helmet: "item:elite-sirenic-mask",
        body: "item:elite-sirenic-hauberk",
        legs: "item:elite-sirenic-chaps",
      },
    });
    expect(chromaticChoirRuntimeLines(threeElite.chromaticChoir!)).toEqual([
      "Choir 12% · Dragonstone / Onyx / Hydrix",
    ]);

    const bowGated = activeEquipmentEffects({
      style: "ranged",
      equipmentSlots: {
        twohand: "item:noxious-longbow",
        body: "item:sirenic-hauberk",
        legs: "item:sirenic-chaps",
      },
    });
    expect(chromaticChoirRuntimeLines(bowGated.chromaticChoir!)).toEqual(["Needs crossbow"]);
  });
});
