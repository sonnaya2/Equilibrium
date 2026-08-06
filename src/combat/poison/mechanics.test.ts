import { describe, expect, it } from "vitest";
import {
  activeEvolvingToxinStacks,
  evolvingToxinMultiplier,
  kwuarmPoisonMultiplier,
  nextEvolvingToxin,
  normalizeKwuarmPotency,
  playerPoisonDamage,
  poisonTierCoefficient,
  resolvePoisonApplication,
  weaponPoisonDurationTicks,
  type PlayerPoisonProfile,
} from "./mechanics";

const profile = (patch: Partial<PlayerPoisonProfile> = {}): PlayerPoisonProfile => ({
  potion: "none",
  potionUntilTick: 0,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
  bik: false,
  targetPoisonImmune: false,
  vulnerability: false,
  ...patch,
});

describe("player poison mechanics", () => {
  it("matches the sourced tier damage table and decay fixtures", () => {
    expect([1, 2, 3, 4, 5].map((tier) => poisonTierCoefficient(tier as 1 | 2 | 3 | 4 | 5))).toEqual(
      [0.2, 0.25, 0.3, 0.35, 0.4],
    );
    const expected = [
      [13, 19.5, 26],
      [16.25, 24.375, 32.5],
      [19.5, 29.25, 39],
      [22.75, 34.125, 45.5],
      [26, 39, 52],
    ];
    for (let tier = 1; tier <= 5; tier++) {
      const band = playerPoisonDamage(100, tier as 1 | 2 | 3 | 4 | 5, 0, 1, 1);
      expect(band.min).toBeCloseTo(expected[tier - 1]![0]!, 10);
      expect(band.expected).toBeCloseTo(expected[tier - 1]![1]!, 10);
      expect(band.max).toBeCloseTo(expected[tier - 1]![2]!, 10);
    }
    expect(playerPoisonDamage(100, 4, 1, 1, 1)).toEqual({
      min: 22.225,
      expected: 33.3375,
      max: 44.45,
    });
    const hit18 = playerPoisonDamage(100, 4, 17, 1, 1);
    expect(hit18.min).toBeCloseTo(13.825, 10);
    expect(hit18.expected).toBeCloseTo(20.7375, 10);
    expect(hit18.max).toBeCloseTo(27.65, 10);
  });

  it("resolves potion, Cinderbane, blowpipe, and Laniakea as one source", () => {
    expect(resolvePoisonApplication(profile(), 0)).toBeNull();
    expect(resolvePoisonApplication(profile({ cinderbane: true }), 0)?.effectiveTier).toBe(2);
    const potionTiers = [
      ["weapon", 1],
      ["weapon-plus", 2],
      ["weapon-plus-plus", 3],
      ["weapon-plus-plus-plus", 4],
    ] as const;
    for (const [potion, tier] of potionTiers) {
      const input = profile({ potion, potionUntilTick: 1_200 });
      expect(resolvePoisonApplication(input, 0)?.effectiveTier).toBe(tier);
      expect(resolvePoisonApplication({ ...input, cinderbane: true }, 0)?.effectiveTier).toBe(
        tier + 1,
      );
    }
    const blowpipe = resolvePoisonApplication(profile({ blowpipe: true }), 0)!;
    expect(blowpipe).toMatchObject({
      effectiveTier: 1,
      procChance: 0.125,
      cadenceTicks: 8,
      hitBudget: 36,
      sourceDamageMultiplier: 0.5,
    });
    expect(
      resolvePoisonApplication(profile({ blowpipe: true, cinderbane: true }), 0)?.effectiveTier,
    ).toBe(2);
    expect(resolvePoisonApplication(profile({ laniakea: true }), 0)).toBeNull();
    expect(
      resolvePoisonApplication(
        profile({ potion: "weapon", potionUntilTick: 250, laniakea: true }),
        0,
      ),
    ).toMatchObject({ procChance: 0.175, sourceDamageMultiplier: 1.05 });
  });

  it("honors potion expiry, Kwuarm potency, and poison immunity", () => {
    expect(weaponPoisonDurationTicks("weapon")).toBe(250);
    expect(weaponPoisonDurationTicks("weapon-plus")).toBe(500);
    expect(weaponPoisonDurationTicks("weapon-plus-plus")).toBe(1_000);
    expect(weaponPoisonDurationTicks("weapon-plus-plus-plus")).toBe(1_200);
    expect(
      resolvePoisonApplication(profile({ potion: "weapon", potionUntilTick: 250 }), 249),
    ).not.toBeNull();
    expect(
      resolvePoisonApplication(profile({ potion: "weapon", potionUntilTick: 250 }), 250),
    ).toBeNull();
    expect(
      [0, 1, 2, 3, 4].map((value) => kwuarmPoisonMultiplier(value as 0 | 1 | 2 | 3 | 4)),
    ).toEqual([1, 1.025, 1.05, 1.075, 1.1]);
    expect(normalizeKwuarmPotency(-1)).toBe(0);
    expect(normalizeKwuarmPotency(2.5)).toBe(0);
    expect(normalizeKwuarmPotency(5)).toBe(0);
    expect(
      resolvePoisonApplication(
        profile({ potion: "weapon", potionUntilTick: 250, targetPoisonImmune: true }),
        0,
      ),
    ).toBeNull();
  });

  it("caps and expires Evolving Toxin at the half-open boundary", () => {
    expect(evolvingToxinMultiplier(0)).toBe(1);
    expect(evolvingToxinMultiplier(1)).toBe(1.03);
    expect(evolvingToxinMultiplier(150)).toBe(5.5);
    expect(nextEvolvingToxin(150, 50, 10)).toEqual({ stacks: 150, expiresAtTick: 60 });
    expect(activeEvolvingToxinStacks(20, 50, 49)).toBe(20);
    expect(activeEvolvingToxinStacks(20, 50, 50)).toBe(0);
    expect(nextEvolvingToxin(20, 50, 50)).toEqual({ stacks: 1, expiresAtTick: 100 });
  });
});
