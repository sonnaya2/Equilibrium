import { describe, expect, it } from "vitest";
import type { SetPieceContributionModifier } from "../../shared/equipment";
import type { WeaponClass } from "../../data/records";
import {
  chromaticChoirActive,
  chromaticChoirGemStream,
  chromaticChoirGemWeight,
  chromaticChoirGems,
  chromaticChoirProcStream,
  chromaticChoirSetSummary,
  type ChromaticChoirGem,
  type ChromaticChoirSetSummary,
} from "./chromaticChoir";

function setCounts(sirenic = 0, elite = 0): Map<string, number> {
  const map = new Map<string, number>();
  if (sirenic > 0) map.set("sirenic", sirenic);
  if (elite > 0) map.set("elite-sirenic", elite);
  return map;
}

function itemCounts(sirenic = 0, elite = 0): Map<string, number> {
  return setCounts(sirenic, elite);
}

function summary(
  physicalSirenic: number,
  physicalElite = 0,
  weaponClass: WeaponClass | null = "crossbow",
  contribution: SetPieceContributionModifier | undefined = undefined,
  items?: { sirenic?: number; elite?: number },
): ChromaticChoirSetSummary {
  const itemsSirenic = items?.sirenic ?? physicalSirenic;
  const itemsElite = items?.elite ?? physicalElite;
  return chromaticChoirSetSummary(
    setCounts(physicalSirenic, physicalElite),
    itemCounts(itemsSirenic, itemsElite),
    contribution,
    weaponClass,
  );
}

describe("chromaticChoirSetSummary", () => {
  it("resolves physical and effective pieces for base and elite sets", () => {
    const one = summary(1);
    const two = summary(2);
    const three = summary(3);
    const fiveElite = summary(0, 5);

    expect(one).toMatchObject({
      setId: "sirenic",
      physicalPieces: 1,
      effectivePieces: 1,
      mixed: false,
      procChance: 0,
      thresholds: { two: false, three: false },
      gems: [],
    });
    expect(two).toMatchObject({
      setId: "sirenic",
      physicalPieces: 2,
      effectivePieces: 2,
      procChance: 0.06,
      thresholds: { two: true, three: false },
      gems: ["dragonstone"],
    });
    expect(three).toMatchObject({
      setId: "sirenic",
      physicalPieces: 3,
      effectivePieces: 3,
      procChance: 0.06,
      thresholds: { two: true, three: true },
      gems: ["dragonstone", "onyx", "hydrix"],
    });
    expect(fiveElite).toMatchObject({
      setId: "elite-sirenic",
      physicalPieces: 5,
      effectivePieces: 5,
      procChance: 0.12,
      thresholds: { two: true, three: true },
      gems: ["dragonstone", "onyx", "hydrix"],
    });
  });

  it("uses 12% for elite and 6% for base when active", () => {
    expect(summary(2).procChance).toBe(0.06);
    expect(summary(3).procChance).toBe(0.06);
    expect(summary(0, 2).procChance).toBe(0.12);
    expect(summary(0, 3).procChance).toBe(0.12);
  });

  it("deactivates mixed sirenic and elite-sirenic", () => {
    const mixed = summary(2, 1);
    expect(mixed).toMatchObject({
      setId: null,
      physicalPieces: 3,
      effectivePieces: 0,
      mixed: true,
      crossbowEligible: false,
      procChance: 0,
      thresholds: { two: false, three: false },
      gems: [],
    });
    expect(chromaticChoirActive(mixed)).toBe(false);
  });

  it("requires crossbow; bows and other classes gate procChance to 0", () => {
    const xbow = summary(3, 0, "crossbow");
    const bow = summary(3, 0, "bow");
    const thrown = summary(3, 0, "thrown");
    const none = summary(3, 0, null);

    expect(xbow.crossbowEligible).toBe(true);
    expect(xbow.procChance).toBe(0.06);
    expect(chromaticChoirActive(xbow)).toBe(true);

    for (const gated of [bow, thrown, none]) {
      expect(gated.crossbowEligible).toBe(false);
      expect(gated.procChance).toBe(0);
      expect(gated.thresholds.two).toBe(true);
      expect(gated.gems).toEqual(["dragonstone", "onyx", "hydrix"]);
      expect(chromaticChoirActive(gated)).toBe(false);
      expect(chromaticChoirGems(gated)).toEqual([]);
    }
  });

  it("lists dragonstone only at 2pc and all three gems at 3pc", () => {
    expect(summary(2).gems).toEqual(["dragonstone"]);
    expect(summary(0, 2).gems).toEqual(["dragonstone"]);
    expect(summary(3).gems).toEqual(["dragonstone", "onyx", "hydrix"]);
    expect(summary(0, 3).gems).toEqual(["dragonstone", "onyx", "hydrix"]);
  });

  it("applies league additionalPiecesPerItem via effectiveSetPieces", () => {
    const contrib: SetPieceContributionModifier = { additionalPiecesPerItem: 2 };
    const one = summary(1, 0, "crossbow", contrib);
    const two = summary(2, 0, "crossbow", contrib);

    expect(one).toMatchObject({
      physicalPieces: 1,
      effectivePieces: 3,
      procChance: 0.06,
      thresholds: { two: true, three: true },
      gems: ["dragonstone", "onyx", "hydrix"],
    });
    expect(two).toMatchObject({
      physicalPieces: 2,
      effectivePieces: 6,
      thresholds: { two: true, three: true },
    });

    const eliteOne = summary(0, 1, "crossbow", contrib);
    expect(eliteOne.procChance).toBe(0.12);
    expect(eliteOne.effectivePieces).toBe(3);
  });
});

describe("chromaticChoir helpers", () => {
  it("is active only with crossbow, procChance > 0, and 2pc threshold", () => {
    expect(chromaticChoirActive(undefined)).toBe(false);
    expect(chromaticChoirActive(summary(1))).toBe(false);
    expect(chromaticChoirActive(summary(2))).toBe(true);
    expect(chromaticChoirActive(summary(2, 0, "bow"))).toBe(false);
    expect(chromaticChoirActive(summary(1, 1))).toBe(false);
  });

  it("returns gems only when active", () => {
    expect(chromaticChoirGems(undefined)).toEqual([]);
    expect(chromaticChoirGems(summary(2))).toEqual(["dragonstone"]);
    expect(chromaticChoirGems(summary(3))).toEqual(["dragonstone", "onyx", "hydrix"]);
    expect(chromaticChoirGems(summary(3, 0, "bow"))).toEqual([]);
  });

  it("weights gems 1 for single gem and 1/3 for three-gem pick", () => {
    const two = summary(2);
    const three = summary(3);
    const gems: ChromaticChoirGem[] = ["dragonstone", "onyx", "hydrix"];

    expect(chromaticChoirGemWeight(two, "dragonstone")).toBe(1);
    expect(chromaticChoirGemWeight(two, "onyx")).toBe(0);
    expect(chromaticChoirGemWeight(two, "hydrix")).toBe(0);

    for (const gem of gems) {
      expect(chromaticChoirGemWeight(three, gem)).toBeCloseTo(1 / 3, 10);
    }
    expect(gems.reduce((sum, gem) => sum + chromaticChoirGemWeight(three, gem), 0)).toBeCloseTo(
      1,
      10,
    );

    expect(chromaticChoirGemWeight(undefined, "dragonstone")).toBe(0);
    expect(chromaticChoirGemWeight(summary(3, 0, "bow"), "dragonstone")).toBe(0);
  });

  it("builds distinct stochastic stream keys", () => {
    expect(chromaticChoirProcStream(4, 1)).toBe("chromatic-choir:proc:4:1");
    expect(chromaticChoirGemStream(4, 1)).toBe("chromatic-choir:gem:4:1");
    expect(chromaticChoirProcStream(0, 0)).not.toBe(chromaticChoirGemStream(0, 0));
  });
});
