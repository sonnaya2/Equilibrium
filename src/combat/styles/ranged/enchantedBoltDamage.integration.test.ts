import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import {
  envenomedPoisonDamageMultiplier,
  leagueModifiers,
  resolveLeagueRules,
} from "../../league/ruleset";
import { rangedInput } from "../../test/fixtures/inputs";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";
import { vulnerabilityModifier } from "../../shared/vulnerability";
import { resolveAmmunitionProfile } from "./ammunitionProfile";
import type { RangedAmmunitionMechanicId } from "../../data/ammunition";

function boltAmmunition(
  mechanicId: Extract<
    RangedAmmunitionMechanicId,
    "jade" | "topaz" | "sapphire" | "emerald" | "ruby" | "diamond" | "dragonstone" | "onyx"
  >,
  family: "bolts" = "bolts",
  statTier = family === "bolts" ? 95 : 70,
) {
  const projectile = resolveAmmunitionProfile({
    id: `item:test-${mechanicId}-${family}`,
    label: `Test ${mechanicId} ${family}`,
    family,
    statTier,
    mechanicId,
    support: { status: "modeled", label: "Test fixture" },
  });
  if (!projectile) throw new Error(`missing ${mechanicId} test bolt`);
  return {
    projectile,
    quiver: null,
    weaponCapability: { mode: "optional" as const, acceptedFamily: family },
    effectiveStatTier: statTier,
  };
}

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

  it.each([0.35, 0.8])("uses Diamond perfect accuracy while leaving damage increase partial at DP %s", (accuracy) => {
    const reference = simulate({
      ...rangedInput,
      accuracy,
      rotation: rotationOf("ranged_attack"),
    });
    const diamond = simulate({
      ...rangedInput,
      accuracy,
      ammunition: boltAmmunition("diamond"),
      rotation: rotationOf("ranged_attack"),
    });
    expect(diamond.events.find((event) => event.originKind === "direct")!.damage.expected).toBeGreaterThan(
      reference.events.find((event) => event.originKind === "direct")!.damage.expected,
    );
    expect(diamond.rng?.lanes ?? 1).toBe(1);
  });

  it("schedules Emerald as one poison hit, with immunity and poison modifiers", () => {
    const emerald = simulate({
      ...rangedInput,
      ammunition: boltAmmunition("emerald"),
      rotation: rotationOf("ranged_attack"),
    });
    const poison = emerald.events.find((event) => event.abilityId === "ammunition:emerald");
    expect(poison).toMatchObject({
      family: "proc",
      originKind: "poison",
      procEligible: false,
      recursionAllowed: false,
      provenance: { kind: "equipment_proc", detail: "emerald" },
    });
    expect(poison?.expectedActivations).toBe(0.55);
    expect(poison?.damage.expected).toBeGreaterThan(0);

    const bakriminel = simulate({
      ...rangedInput,
      ammunition: {
        projectile: {
          itemId: "item:emerald-bakriminel-bolts-e",
          label: "Emerald bakriminel bolts (e)",
          family: "bolts",
          statTier: 95,
          mechanicId: "emerald",
          support: { status: "modeled", label: "Poison-hit mechanic" },
        },
        quiver: null,
        weaponCapability: { mode: "required", acceptedFamily: "bolts" },
        effectiveStatTier: 95,
      },
      rotation: rotationOf("ranged_attack"),
    });
    const bakriminelPoison = bakriminel.events.find(
      (event) => event.abilityId === "ammunition:emerald",
    );
    expect(bakriminelPoison?.damage.expected).toBeCloseTo(poison?.damage.expected ?? 0, 10);
    expect(
      bakriminel.analysis.byEffect.find((row) => row.id === "ammunition:emerald")?.totalDamage,
    ).toBeGreaterThan(0);

    const immune = simulate({
      ...rangedInput,
      ammunition: boltAmmunition("emerald"),
      targetPoisonImmune: true,
      rotation: rotationOf("ranged_attack"),
    });
    expect(immune.events.some((event) => event.abilityId === "ammunition:emerald")).toBe(false);

    const cinderbanes = simulate({
      ...rangedInput,
      ammunition: boltAmmunition("emerald"),
      playerPoison: {
        potion: "none",
        potionUntilTick: 0,
        kwuarmPotency: 0,
        cinderbane: true,
        blowpipe: false,
        laniakea: false,
      },
      rotation: rotationOf("ranged_attack"),
    });
    expect(cinderbanes.totalExpected).toBeGreaterThan(emerald.totalExpected);
  });

  it("buffs Emerald Magical Poison with Envenomed and lands on poison-immune targets", () => {
    const envenomed = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Chaos", "Order", "Chaos", "Order", "Order", "Balance"],
      },
      { herbloreLevel: 99 },
    );
    const poisonMods = leagueModifiers(envenomed).filter(
      (modifier) => modifier.appliesToPlayerPoison === true,
    );
    // 1.5 + 0.02*99 = 3.48; mulFloor trims the band before chance weighting.
    expect(envenomedPoisonDamageMultiplier(envenomed)).toBeCloseTo(3.48, 5);

    const plain = simulate({
      ...rangedInput,
      ammunition: boltAmmunition("emerald"),
      rotation: rotationOf("ranged_attack"),
    });
    // League ruleset is carried only on `league`; emerald must still see Envenomed.
    const buffed = simulate({
      ...rangedInput,
      league: envenomed,
      context: { style: "ranged" },
      playerPoisonModifiers: poisonMods,
      ammunition: boltAmmunition("emerald"),
      rotation: rotationOf("ranged_attack"),
    });
    const plainPoison =
      plain.events.find((event) => event.abilityId === "ammunition:emerald")?.damage.expected ?? 0;
    const buffedPoison =
      buffed.events.find((event) => event.abilityId === "ammunition:emerald")?.damage.expected ?? 0;
    expect(plainPoison).toBeGreaterThan(0);
    expect(buffedPoison).toBeGreaterThan(plainPoison * 3.4);

    const immuneWithEnvenomed = simulate({
      ...rangedInput,
      league: envenomed,
      context: { style: "ranged" },
      playerPoisonModifiers: poisonMods,
      ammunition: boltAmmunition("emerald"),
      targetPoisonImmune: true,
      rotation: rotationOf("ranged_attack"),
    });
    const immunePoison = immuneWithEnvenomed.events.find(
      (event) => event.abilityId === "ammunition:emerald",
    );
    expect(immunePoison?.damage.expected).toBeCloseTo(buffedPoison, 8);
  });

  it("adds Big Boned after Emerald poison modifiers", () => {
    const league = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance"] },
      { maximumLife: 10_000 },
    );
    const vulnerability = vulnerabilityModifier();
    const result = simulate({
      ...rangedInput,
      league,
      context: { style: "ranged", ruleset: "equilibrium" },
      modifiers: [vulnerability],
      playerPoisonModifiers: [vulnerability],
      playerPoison: {
        potion: "none",
        potionUntilTick: 0,
        kwuarmPotency: 4,
        cinderbane: true,
        blowpipe: false,
        laniakea: false,
      },
      ammunition: boltAmmunition("emerald"),
      rotation: rotationOf("ranged_attack"),
    });
    const emerald = result.events.find((event) => event.abilityId === "ammunition:emerald");
    const bigBoned = emerald?.components?.find((component) => component.id === "big-boned");
    const poisonDamage = (raw: number) => Math.floor(Math.floor(raw * 1.375) * 1.1);
    const mean = (min: number, max: number) => {
      let total = 0;
      for (let damage = min; damage <= max; damage++) total += poisonDamage(damage);
      return total / (max - min + 1);
    };
    const hostExpected = mean(20, 40) * 0.55;
    const bigBonedExpected = 500 * 0.55;
    const combinedExpected = hostExpected + bigBonedExpected;

    expect(emerald?.damage.expected).toBeCloseTo(combinedExpected, 10);
    expect(bigBoned?.damage.expected).toBeCloseTo(bigBonedExpected, 10);
    expect(bigBoned?.analysis?.expectedActivations).toBe(0.55);
    expect(
      result.analysis.byEffect.find((effect) => effect.id === "ammunition:emerald")?.bonusDamage,
    ).toBeCloseTo(bigBonedExpected, 10);

    const immune = simulate({
      ...rangedInput,
      league,
      context: { style: "ranged", ruleset: "equilibrium" },
      ammunition: boltAmmunition("emerald"),
      targetPoisonImmune: true,
      rotation: rotationOf("ranged_attack"),
    });
    expect(immune.events.some((event) => event.abilityId === "ammunition:emerald")).toBe(false);
    expect(immune.analysis.byEffect.some((effect) => effect.id === "ammunition:emerald")).toBe(
      false,
    );
  });

  it("keeps Jade, Topaz, and Sapphire control effects explicit", () => {
    for (const mechanicId of ["jade", "topaz", "sapphire"] as const) {
      const withBolt = simulate({
        ...rangedInput,
        ammunition: boltAmmunition(mechanicId),
        rotation: rotationOf("ranged_attack"),
      });
      const reference = simulate({ ...rangedInput, rotation: rotationOf("ranged_attack") });
      expect(withBolt.totalExpected).toBe(reference.totalExpected);
      expect(withBolt.events.some((event) => event.abilityId.startsWith("ammunition:"))).toBe(
        false,
      );
    }
  });

  it("routes ordinary and bakriminel bolts through the same Dragonstone payload", () => {
    const ordinary = simulate({
      ...rangedInput,
      ammunition: boltAmmunition("dragonstone", "bolts", 70),
      rotation: rotationOf("ranged_attack"),
    });
    const bakriminel = simulate({
      ...rangedInput,
      ammunition: boltAmmunition("dragonstone", "bolts", 95),
      rotation: rotationOf("ranged_attack"),
    });
    const ordinaryProc = ordinary.events.find((event) => event.abilityId === "ammunition:dragonstone");
    const bakriminelProc = bakriminel.events.find((event) => event.abilityId === "ammunition:dragonstone");
    expect(ordinaryProc?.damage.expected).toBe(bakriminelProc?.damage.expected);
    expect(ordinaryProc).toMatchObject({
      family: "proc",
      derivedFrom: expect.any(Number),
      provenance: { kind: "equipment_proc", detail: "dragonstone" },
      procEligible: false,
      recursionAllowed: false,
    });
    const immune = simulate({
      ...rangedInput,
      ammunition: boltAmmunition("dragonstone"),
      targetClassification: { dragonfireImmune: true },
      rotation: rotationOf("ranged_attack"),
    });
    expect(immune.events.some((event) => event.abilityId === "ammunition:dragonstone")).toBe(false);
  });
});
