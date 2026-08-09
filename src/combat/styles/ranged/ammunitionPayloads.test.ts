import { describe, expect, it } from "vitest";
import {
  baneAccuracyModifier,
  baneSourceHitModifier,
  dragonstoneCanHitTarget,
  dragonstoneSeparateHitDamage,
  dragonstoneSeparateHitExpected,
  dragonstoneSeparateHitPayload,
  emeraldPoisonHit,
  emeraldExternalPoisonMultiplier,
  fulAccuracyModifier,
  fulSourceHitModifier,
  jasAccuracyModifier,
  jasSourceHitModifier,
  onyxHealingAmount,
  onyxSourceHitModifier,
  opalSourceHitModifier,
  pearlSourceHitModifier,
  pernixMaximumHitBandPayload,
  resolveRangedAmmunitionHitEffects,
  resolveDiamondSourceHit,
  rubyBloodForfeitPayload,
  rubyRecoilDamage,
  unsupportedBoltSupport,
} from "./ammunitionPayloads";

describe("ranged ammunition source-hit payloads", () => {
  it("resolves one eligible hit payload without reopening attached or recursive hits", () => {
    const ammunition = {
      projectile: {
        itemId: "item:test-ful-arrows",
        label: "Test Ful arrows",
        family: "arrows" as const,
        statTier: 100,
        mechanicId: "ful" as const,
        support: { status: "modeled" as const, label: "Modeled" },
      },
      quiver: null,
      weaponCapability: { mode: "optional" as const, acceptedFamily: "arrows" as const },
      effectiveStatTier: 100,
    };
    const direct = resolveRangedAmmunitionHitEffects({
      ammunition,
      style: "ranged",
      provenance: { kind: "player_direct" },
      attackKind: "ability",
    });
    expect(direct).toMatchObject({
      mechanicId: "ful",
      sourceHitMultiplier: 1.15,
      damagePotentialDelta: -0.1,
    });
    expect(
      resolveRangedAmmunitionHitEffects({
        ammunition,
        style: "ranged",
        provenance: { kind: "attached" },
        attackKind: "ability",
      }),
    ).toMatchObject({ sourceHitMultiplier: 1, damagePotentialDelta: 0 });
  });

  it("lets BotLG opt into ammunition without enabling generic proc routing", () => {
    const ammunition = {
      projectile: {
        itemId: "item:test-ful-arrows",
        label: "Test Ful arrows",
        family: "arrows" as const,
        statTier: 100,
        mechanicId: "ful" as const,
        support: { status: "modeled" as const, label: "Modeled" },
      },
      quiver: null,
      weaponCapability: { mode: "optional" as const, acceptedFamily: "arrows" as const },
      effectiveStatTier: 100,
    };
    expect(
      resolveRangedAmmunitionHitEffects({
        ammunition,
        style: "ranged",
        provenance: { kind: "botlg_perfect_equilibrium" },
        attackOrigin: "botlg",
        attackKind: "ability",
      }),
    ).toMatchObject({ sourceHitMultiplier: 1.15, damagePotentialDelta: -0.1 });
    expect(
      resolveRangedAmmunitionHitEffects({
        ammunition,
        style: "ranged",
        provenance: { kind: "equipment_proc" },
        attackOrigin: "botlg",
        attackKind: "ability",
      }),
    ).toMatchObject({ sourceHitMultiplier: 1, damagePotentialDelta: 0 });
  });

  it("describes Ful's ability-only damage and pre-cap accuracy changes", () => {
    expect(fulSourceHitModifier("ability")).toMatchObject({
      kind: "source-hit-multiplier",
      multiplier: 1.15,
      appliesTo: "ability",
    });
    expect(fulSourceHitModifier("auto").multiplier).toBe(1);
    expect(fulAccuracyModifier("ability")).toMatchObject({
      mode: "additive-fraction",
      additiveHitChanceFraction: -0.1,
      stage: "pre-cap",
    });
    const fulAccuracy = fulAccuracyModifier("ability")!;
    expect(Math.min(1, 1.2 + fulAccuracy.additiveHitChanceFraction)).toBe(1);
    expect(Math.min(1, 0.95 + fulAccuracy.additiveHitChanceFraction)).toBeCloseTo(0.85, 10);
    expect(fulAccuracyModifier("auto")).toBeNull();
  });

  it("keeps Jas and ordinary bane damage and accuracy as independent descriptors", () => {
    expect(jasSourceHitModifier("dragon", "jas-dragonbane")).toMatchObject({ multiplier: 1.3 });
    expect(jasSourceHitModifier("demon", "jas-dragonbane")).toBeNull();
    expect(jasAccuracyModifier("dragon", "jas-dragonbane")).toMatchObject({
      mode: "additive-fraction",
      additiveHitChanceFraction: 0.2,
    });
    expect(baneSourceHitModifier("dragon", "dragonbane", "ability")).toMatchObject({
      multiplier: 1.25,
    });
    expect(baneSourceHitModifier("dragon", "dragonbane", "auto")).toMatchObject({
      multiplier: 1.4,
    });
    expect(baneAccuracyModifier("other", "dragonbane")).toBeNull();
    expect(baneAccuracyModifier("dragon", "dragonbane")).toMatchObject({
      additiveHitChanceFraction: 0.3,
    });
  });

  it("changes only the maximum band by a floored ability-maximum addition", () => {
    expect(pernixMaximumHitBandPayload(0.2, 103)).toMatchObject({
      applies: true,
      roundedAddition: 4,
      fractionOfAbilityMaximum: 0.04,
    });
    expect(pernixMaximumHitBandPayload(0.25, 103).applies).toBe(false);
    expect(pernixMaximumHitBandPayload(1.4, 103).targetHealthFraction).toBe(1);
    expect(pernixMaximumHitBandPayload(null, 103).applies).toBe(false);
  });

  it("keeps Opal and Pearl effects on the triggering hit", () => {
    expect(opalSourceHitModifier()).toMatchObject({ multiplier: 1.1 });
    expect(pearlSourceHitModifier("water")).toMatchObject({ multiplier: 1.15 });
    expect(pearlSourceHitModifier("fire")).toMatchObject({ multiplier: 0.85 });
    expect(pearlSourceHitModifier("unknown")).toBeNull();
  });

  it("models Ruby as additive ability damage with current-life recoil", () => {
    expect(rubyBloodForfeitPayload(0)).toMatchObject({
      kind: "ability-damage-additive",
      additiveAbilityDamageFraction: 0.25,
      roundedStage: "existing-ranged-pipeline",
    });
    expect(rubyBloodForfeitPayload(0.5).additiveAbilityDamageFraction).toBeCloseTo(0.75, 10);
    expect(rubyBloodForfeitPayload(1).additiveAbilityDamageFraction).toBe(1.25);
    expect(rubyBloodForfeitPayload(2).targetHealthFraction).toBe(1);
    expect(rubyRecoilDamage(10_001)).toBe(500);
    expect(rubyRecoilDamage(4_001)).toBe(200);
  });

  it("routes active Diamond, Ruby, and Onyx payloads into the shared hit result", () => {
    const ammunition = {
      projectile: {
        itemId: "item:test-enchanted-bolts",
        label: "Test enchanted bolts",
        family: "bolts" as const,
        statTier: 95,
        mechanicId: "diamond" as const,
        support: { status: "modeled" as const, label: "Modeled" },
      },
      quiver: null,
      weaponCapability: { mode: "optional" as const, acceptedFamily: "bolts" as const },
      effectiveStatTier: 95,
    };
    expect(
      resolveRangedAmmunitionHitEffects({
        ammunition,
        style: "ranged",
        provenance: { kind: "player_direct" },
        attackKind: "ability",
        enchantedBoltProcActive: true,
      }),
    ).toMatchObject({ maximumHitBandFraction: 0, accuracyOverride: 1 });
    expect(
      resolveRangedAmmunitionHitEffects({
        ammunition: {
          ...ammunition,
          projectile: { ...ammunition.projectile, mechanicId: "ruby" as const },
        },
        style: "ranged",
        provenance: { kind: "player_direct" },
        attackKind: "ability",
        targetHealthFraction: 0.5,
        enchantedBoltProcActive: true,
      }).abilityDamageFraction,
    ).toBeCloseTo(0.75, 10);
    expect(
      resolveRangedAmmunitionHitEffects({
        ammunition: {
          ...ammunition,
          projectile: { ...ammunition.projectile, mechanicId: "onyx" as const },
        },
        style: "ranged",
        provenance: { kind: "player_direct" },
        attackKind: "ability",
        enchantedBoltProcActive: true,
      }).sourceHitMultiplier,
    ).toBe(1.25);
  });

  it("keeps Diamond damage partial until the modern band rule is proven", () => {
    expect(resolveDiamondSourceHit()).toEqual({
      kind: "partial",
      perfectAccuracy: true,
      damageIncreaseModeled: false,
      support: expect.objectContaining({ status: "partially-modeled" }),
    });
  });

  it("uses original Onyx damage potential for capped healing", () => {
    expect(onyxSourceHitModifier()).toMatchObject({ multiplier: 1.25 });
    expect(onyxHealingAmount(8001)).toBe(2000);
    expect(onyxHealingAmount(20_000)).toBe(2500);
  });

  it("keeps Dragonstone as an immune-gated separate hit", () => {
    expect(dragonstoneSeparateHitPayload()).toMatchObject({
      kind: "separate-hit",
      fractionOfTriggeringHit: 0.25,
      reTriggersAmmunition: false,
    });
    expect(dragonstoneSeparateHitDamage(401)).toBe(100);
    expect(
      dragonstoneCanHitTarget({ targetIsDragon: false, targetHasDragonfireImmunity: false }),
    ).toBe(true);
    expect(
      dragonstoneCanHitTarget({ targetIsDragon: true, targetHasDragonfireImmunity: false }),
    ).toBe(false);
    expect(
      dragonstoneCanHitTarget({ targetIsDragon: false, targetHasDragonfireImmunity: true }),
    ).toBe(false);
  });

  it("transforms each Dragonstone source outcome before its independent cap", () => {
    const distribution = [
      { damage: 399, weight: 0.5 },
      { damage: 403, weight: 0.5 },
    ];
    expect(dragonstoneSeparateHitExpected(distribution, 1, 30_000)).toBe(99.5);
    expect(
      dragonstoneSeparateHitExpected(
        [
          { damage: 10_000, weight: 0.5 },
          { damage: 30_000, weight: 0.5 },
        ],
        1,
        4_000,
      ),
    ).toBe(3_250);
  });

  it("does not use the weapon-poison potion tier for Emerald", () => {
    const base = {
      potionUntilTick: 1_000,
      kwuarmPotency: 0 as const,
      cinderbane: false,
      blowpipe: false,
      laniakea: false,
    };
    expect(emeraldExternalPoisonMultiplier({ ...base, potion: "none" })).toBe(
      emeraldExternalPoisonMultiplier({ ...base, potion: "weapon-plus-plus-plus" }),
    );
  });

  it("models Emerald as one poison-type payload without scheduler refresh", () => {
    expect(emeraldPoisonHit(1001)).toMatchObject({
      kind: "poison-hit",
      min: 20,
      max: 40,
      persistentWeaponPoisonScheduler: false,
    });
  });

  it("labels Jade, Topaz, and Sapphire without inventing outgoing DPS", () => {
    expect(unsupportedBoltSupport("jade")?.status).toBe("unsupported");
    expect(unsupportedBoltSupport("topaz")?.status).toBe("unsupported");
    expect(unsupportedBoltSupport("sapphire")?.status).toBe("unsupported");
  });
});
