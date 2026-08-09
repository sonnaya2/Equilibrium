import { describe, expect, it } from "vitest";
import type { BlessingChoice } from "@/league/blessings";
import {
  BLESSING_DAMAGE_EFFECT_IDS,
  blessingEffectDisplayName,
  blessingEventTypeLabel,
  formatBlessingByEffectLabel,
  isBlessingDamageEffectId,
  isBlessingDamageEvent,
  isBlessingEffectRow,
  lordOfLightAssumptionRows,
  strikingLightAssumptionRows,
  strikingLightBasicCastNote,
  strikingLightBasicRowMark,
  strikingLightChoice,
  temperedHeartAssumptionRows,
} from "./blessingPresentation";

function strikingPlate(overrides: Partial<BlessingChoice["combat"]> = {}): BlessingChoice {
  return {
    id: "striking-light",
    name: "Striking Light",
    path: "Order",
    progressionSlot: 2,
    tier: 2,
    effects: [],
    verified: true,
    support: {
      status: "modeled",
      mechanicsUnverified: true,
      excluded: [],
      assumptions: [],
    },
    combat: {
      basicDamageMultiplier: 1.4,
      light: {
        cooldownTicks: 15,
        abilityDamageBand: [40, 60],
        armourPercent: 2.5,
      },
      ...overrides,
    },
    source: {
      source: "jagex",
      title: "test",
      url: "https://example.test",
      publishedAt: "2026-01-01",
      verifiedAt: "2026-01-01",
    },
  };
}

describe("blessingPresentation", () => {
  it("labels known blessing damage effect ids", () => {
    expect(blessingEffectDisplayName("big-boned")).toBe("Big Boned");
    expect(blessingEffectDisplayName("abyssal-cinders")).toBe("Cinders");
    expect(blessingEffectDisplayName("inferno-of-zamorak")).toBe("Inferno");
    expect(blessingEffectDisplayName("light-of-saradomin")).toBe("Light of Saradomin");
    expect(blessingEffectDisplayName("grasp-of-guthix")).toBe("Grasp of Guthix");
    expect(blessingEffectDisplayName("grasp-of-guthix-max-life")).toBe(
      "Grasp of Guthix · Max life",
    );
    expect(blessingEffectDisplayName("grasp-of-guthix-poison")).toBe("Grasp of Guthix · Poison");
    expect(blessingEffectDisplayName("grasp-of-guthix-big-boned")).toBe(
      "Big Boned · attached to Grasp",
    );
    expect(blessingEffectDisplayName("greater_ricochet")).toBeNull();
  });

  it("recognizes every catalogued blessing damage effect id", () => {
    for (const id of BLESSING_DAMAGE_EFFECT_IDS) {
      expect(isBlessingDamageEffectId(id)).toBe(true);
      expect(blessingEffectDisplayName(id)).toBeTruthy();
    }
  });

  it("marks blessing events as type Blessing (not Hit / Bonus)", () => {
    expect(blessingEventTypeLabel({ family: "blessing", abilityId: "big-boned" })).toBe("Blessing");
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
    expect(isBlessingEffectRow("light-of-saradomin", undefined)).toBe(true);
    expect(formatBlessingByEffectLabel("big-boned", "league-blessing", "Big Boned")).toBe(
      "Blessing · Big Boned",
    );
    expect(
      formatBlessingByEffectLabel("light-of-saradomin", "league-blessing", "Light of Saradomin"),
    ).toBe("Blessing · Light of Saradomin");
    expect(formatBlessingByEffectLabel("inferno-of-zamorak", undefined, "Inferno")).toBe(
      "Blessing · Inferno",
    );
    expect(formatBlessingByEffectLabel("slice", "ability-direct", "Slice")).toBe("Slice");
    expect(
      formatBlessingByEffectLabel("big-boned", "league-blessing", "Blessing · Big Boned"),
    ).toBe("Blessing · Big Boned");
  });

  it("surfaces Striking Light Basic Attacks and modern Basic Attack Light triggers", () => {
    expect(strikingLightChoice([])).toBeUndefined();
    expect(strikingLightAssumptionRows(undefined)).toEqual([]);
    expect(strikingLightBasicCastNote(undefined, { basicAttack: true })).toBeNull();

    const plate = strikingPlate();
    expect(strikingLightChoice([plate])?.id).toBe("striking-light");
    const rows = strikingLightAssumptionRows([plate], 1_000);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([
      "Striking Light basics",
      "+40% damage on basic-category abilities (ability-stage mult; not in base ability damage field)",
    ]);
    expect(rows[1]![0]).toBe("Light of Saradomin");
    expect(rows[1]![1]).toMatch(/40-60% AD/);
    expect(rows[1]![1]).toMatch(/250% armour/);
    expect(rows[1]![1]).toMatch(/2,500 from armour/);
    expect(rows[1]![1]).toMatch(/9\.0s CD/);
    expect(rows[1]![1]).toMatch(/separate hit/);

    expect(strikingLightBasicCastNote([plate], { basicAttack: true })).toBe(
      "Includes Striking Light +40% on this basic",
    );
    expect(strikingLightBasicCastNote([plate], { category: "basic" })).toBe(
      "Includes Striking Light +40% on this basic",
    );
    expect(strikingLightBasicCastNote([plate], { autoAttack: true })).toBeNull();
    expect(strikingLightBasicCastNote([plate], {})).toBeNull();
  });

  it("surfaces Lord of Light and Tempered Heart simulation assumptions", () => {
    const lord = {
      ...strikingPlate(),
      id: "lord-of-light" as const,
      name: "Lord of Light",
      tier: 6,
      combat: {
        light: {
          cooldownTicks: 24,
          abilityDamageBand: [40, 60] as const,
          armourPercent: 2.5,
          strikes: 5,
          maxTargetsPerStrike: 8,
          prayerDamagePerBonus: 0.02,
          healFraction: 0.05,
        },
      },
    };
    const tempered = {
      ...strikingPlate(),
      id: "tempered-heart" as const,
      name: "Tempered Heart",
      tier: 7,
      combat: { passiveAdrenaline: { intervalTicks: 2, amount: 6 } },
    };
    expect(lordOfLightAssumptionRows([lord], 1_000, 10, 12)).toEqual([
      [
        "Lord of Light",
        "5 strikes · 8 targets per strike · multi-target tile overlap approximated by areaTargets · 14.4s independent CD",
      ],
      ["Lord Light hit", "40-60% AD + 250% armour (2,500) · Prayer 10 = ×1.20 · 5% heal"],
    ]);
    expect(lordOfLightAssumptionRows([lord], 1_000, 10, 1)).toEqual([
      [
        "Lord of Light",
        "5 strikes · 1 target per strike · primary-target overlap is an areaTargets:1 scenario · 14.4s independent CD",
      ],
      ["Lord Light hit", "40-60% AD + 250% armour (2,500) · Prayer 10 = ×1.20 · 5% heal"],
    ]);
    expect(temperedHeartAssumptionRows([tempered])).toEqual([
      ["Tempered Heart", "+6 adrenaline every 1.2s (2 ticks) · first pulse at t2"],
    ]);
  });

  it("compact +40% SL mark on category basics and Basic Attacks when Striking Light is active", () => {
    expect(strikingLightBasicRowMark(undefined, { basicAttack: true })).toBeNull();
    expect(strikingLightBasicRowMark([], { basicAttack: true })).toBeNull();

    const plate = strikingPlate();
    expect(strikingLightBasicRowMark([plate], { basicAttack: true })).toBe("+40% SL");
    expect(strikingLightBasicRowMark([plate], { kind: "basic-attack" })).toBe("+40% SL");
    expect(strikingLightBasicRowMark([plate], { category: "basic" })).toBe("+40% SL");
    expect(strikingLightBasicRowMark([plate], { kind: "auto-attack" })).toBeNull();
    // Light of Saradomin is a separate blessing hit - not the ability-stage mult row.
    expect(
      strikingLightBasicRowMark([plate], {
        category: undefined,
        kind: "league-blessing",
      }),
    ).toBeNull();

    const noMult = strikingPlate({ basicDamageMultiplier: undefined });
    expect(strikingLightBasicRowMark([noMult], { basicAttack: true })).toBeNull();
  });

  it("keeps Light of Saradomin display name distinct from Striking Light card", () => {
    expect(blessingEffectDisplayName("light-of-saradomin")).toBe("Light of Saradomin");
    expect(blessingEffectDisplayName("light-of-saradomin")).not.toBe("Striking Light");
    const plate = strikingPlate();
    const rows = strikingLightAssumptionRows([plate], 0);
    expect(rows.map((r) => r[0])).toEqual(["Striking Light basics", "Light of Saradomin"]);
  });
});
