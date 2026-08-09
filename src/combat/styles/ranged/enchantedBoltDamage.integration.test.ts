import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";

function directHits(result: ReturnType<typeof simulate>) {
  return result.events.filter(
    (event) => event.family === "hit" && !event.attached && event.originKind === "direct",
  );
}

describe("damage-only enchanted bolts", () => {
  it("mixes Opal's sourced chance into each eligible hit without stochastic lanes", () => {
    const result = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("opal"),
      rotation: rotationOf("ranged_attack"),
    });
    const hit = directHits(result)[0]!;

    expect(hit.damage).toMatchObject({ min: 900, max: 1210 });
    expect(hit.damage.expected).toBeCloseTo(1004.9776119402985, 10);
    expect(result.rng?.lanes ?? 1).toBe(1);
  });

  it("stacks the passive Ranged cape and Elite Seers' chance modifiers", () => {
    const result = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("opal"),
      enchantedBoltChanceModifiers: { rangedCape: true, eliteSeersVillage: true },
      rotation: rotationOf("ranged_attack"),
    });

    expect(directHits(result)[0]!.damage.expected).toBeCloseTo(1008.3623880597015, 10);
    expect(result.rng?.lanes ?? 1).toBe(1);
  });

  it.each([
    ["water", 1007.476368159204, 900, 1265],
    ["fire", 992.476368159204, 765, 1100],
  ] as const)(
    "applies Pearl's %s weakness modifier",
    (elementalWeakness, expected, minimum, maximum) => {
      const result = simulate({
        ...rangedInput,
        ammunition: testRangedAmmunition("pearl"),
        targetClassification: { elementalWeakness },
        rotation: rotationOf("ranged_attack"),
      });

      expect(directHits(result)[0]!.damage).toMatchObject({ min: minimum, max: maximum });
      expect(directHits(result)[0]!.damage.expected).toBeCloseTo(expected, 10);
      expect(result.rng?.lanes ?? 1).toBe(1);
    },
  );

  it("fails closed when Pearl's elemental weakness is not known", () => {
    const result = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("pearl"),
      targetClassification: { elementalWeakness: "unknown" },
      rotation: rotationOf("ranged_attack"),
    });
    const reference = simulate({ ...rangedInput, rotation: rotationOf("ranged_attack") });

    expect(directHits(result)[0]!.damage).toEqual(directHits(reference)[0]!.damage);
  });

  it("rolls per Rapid Fire hit and rejects Corruption Shot bleed ticks", () => {
    const rapidFire = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      ammunition: testRangedAmmunition("opal"),
      rotation: rotationOf("rapid_fire"),
    });
    const rapidReference = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      rotation: rotationOf("rapid_fire"),
    });
    const boltHits = directHits(rapidFire);
    const referenceHits = directHits(rapidReference);

    expect(boltHits).toHaveLength(8);
    for (let index = 0; index < boltHits.length; index++) {
      expect(referenceHits[index]!.damage.expected).toBe(800);
      expect(boltHits[index]!.damage.expected).toBeCloseTo(803.9777227722773, 10);
    }

    const corruption = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      ammunition: testRangedAmmunition("opal"),
      rotation: rotationOf("corruption_shot"),
    });
    const corruptionReference = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      rotation: rotationOf("corruption_shot"),
    });
    expect(corruption.events.map((event) => event.damage)).toEqual(
      corruptionReference.events.map((event) => event.damage),
    );
  });
});
