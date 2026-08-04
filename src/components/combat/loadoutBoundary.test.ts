import { describe, expect, it } from "vitest";
import { baseAbilityDamage } from "@/combat/core/abilityDamage";
import { loadoutStats, sumBreakdown } from "./loadoutStats";
import { DEFAULT_LOADOUT, type Loadout, normalizeLoadout } from "./loadout/model";
import {
  equippedWeaponTier,
  loadoutWeaponConfig,
  loadoutBase,
} from "./loadout/weaponConfiguration";
import {
  validateArmour,
  validateIncomingHitInterval,
  validateProbability,
  validateScenarioDuration,
} from "@/combat/shared/domainValidators";

const base: Loadout = { ...DEFAULT_LOADOUT };

describe("manual defender half-tier semantics", () => {
  it("uses half-tier off-hand contribution without a real defender item", () => {
    const defenderShape: Loadout = {
      ...base,
      weaponConfiguration: "defender",
      weaponTier: 90,
      offhandTier: 90,
    };
    const dual: Loadout = {
      ...base,
      weaponConfiguration: "dualwield",
      weaponTier: 90,
      offhandTier: 90,
    };
    expect(loadoutWeaponConfig(defenderShape)).toMatchObject({
      kind: "mainhand",
      weapon: { tier: 90 },
      offhand: { tier: 45 },
    });
    expect(loadoutWeaponConfig(dual)).toMatchObject({
      offhand: { tier: 90 },
    });
    expect(loadoutBase(defenderShape)).toBeLessThan(loadoutBase(dual));
    expect(loadoutBase(defenderShape)).toBe(
      baseAbilityDamage(120, {
        kind: "mainhand",
        style: "melee",
        weapon: { tier: 90 },
        offhand: { tier: 45 },
        styleBonus: 0,
      }),
    );
  });
});

describe("canonical two-handed weapon slots", () => {
  it("ignores stale main-hand under a two-handed weapon for tier + accuracy", () => {
    const loadout: Loadout = {
      ...base,
      equipmentSlots: {
        twohand: "item:noxious-scythe",
        mainhand: "item:drygore-longsword",
        offhand: "item:kalphite-defender",
      },
    };
    expect(equippedWeaponTier(loadout)).toBe(90);
    const stats = loadoutStats(loadout, { blessingPicks: ["Order"] });
    expect(stats.weaponConfiguration).toBe("twohand");
    expect(stats.aegis.offhand).toBe("none");
    expect(stats.aegis.armourPercent).toBe(0.25);
  });
});

describe("manual accuracy is a final Damage Potential override", () => {
  it("does not apply defender accuracy mult to the no-target slider", () => {
    const defender: Loadout = {
      ...base,
      accuracy: 50,
      equipmentSlots: {
        mainhand: "item:drygore-longsword",
        offhand: "item:kalphite-defender",
      },
    };
    const stats = loadoutStats(defender);
    expect(stats.dp).toBe(0.5);
    expect(stats.damagePotentialSource).toBe("manual override");
    // Rating path still multiplies; only the slider is final.
    expect(stats.accuracyRating).toBeGreaterThan(0);
  });
});

describe("presentation reconciles with engine inputs", () => {
  it("base ability damage breakdown sums to stats.base", () => {
    const stats = loadoutStats(
      {
        ...base,
        equipmentSlots: { body: "item:torva-platebody" },
      },
      { blessingPicks: ["Order", "Order", "Order"] },
    );
    expect(sumBreakdown(stats.baseAbilityDamageBreakdown)).toBe(stats.base);
    expect(stats.base).toBe(
      loadoutBase({ ...base, equipmentSlots: { body: "item:torva-platebody" } }) +
        stats.leagueBaseAbilityDamageBonus,
    );
  });

  it("armour breakdown equals totalArmour and Aegis qualifying armour", () => {
    const stats = loadoutStats(
      {
        ...base,
        equipmentSlots: { body: "item:torva-platebody" },
        buffs: { ...base.buffs, fortitude: true },
      },
      { blessingPicks: ["Order"] },
    );
    expect(sumBreakdown(stats.armourBreakdown)).toBe(stats.defence.totalArmour);
    expect(stats.aegis.qualifyingArmour).toBe(stats.defence.totalArmour);
    expect(stats.aegis.excludedBlockArmour).toBe(
      stats.defence.blockArmourRating - stats.defence.totalArmour,
    );
    expect(sumBreakdown(stats.armourRatingBreakdown)).toBe(stats.defence.blockArmourRating);
  });

  it("life and league maximum life share Powerburst ordering with Big Boned", () => {
    const now = 50_000;
    const loadout: Loadout = {
      ...base,
      buffs: { ...base.buffs, powerburstOfVitalityUntil: now + 6000 },
    };
    const stats = loadoutStats(loadout, {
      now,
      blessingPicks: ["Balance"],
    });
    // UI life is doubled; league stores undoubled (already ×1.5 Big Boned).
    expect(stats.life.temporaryMaxLife).toBe(stats.league.maximumLife * 2);
    expect(stats.life.normalMaxLife).toBe(14_850);
    expect(stats.league.maximumLife).toBe(14_850);
    expect(stats.league.powerburstUntilTick).toBe(10);
  });

  it("max adrenaline matches Adrenaline Junkie resolution", () => {
    const stats = loadoutStats(base, { blessingPicks: ["Chaos"] });
    expect(stats.maxAdrenaline).toBe(150);
  });
});

describe("Barkscales unavailable is never zero damage", () => {
  it("marks no-scenario with null triggers, not zero", () => {
    const stats = loadoutStats(base, { blessingPicks: ["Order", "Balance"] });
    expect(stats.barkscales.support).toBe("scenario-dependent");
    expect(stats.barkscales.unavailability).toBe("no-scenario");
    expect(stats.barkscales.triggers).toBeNull();
    expect(stats.barkscales.mitigatedDamage).toBeNull();
  });

  it("rejects invalid interval and duration", () => {
    // normalizeLoadout drops non-positive intervals so persisted loadouts stay honest.
    const cleaned = normalizeLoadout({
      ...base,
      target: {
        defenceLevel: 80,
        affinity: "same",
        incomingHitIntervalSeconds: -3,
      },
    });
    expect(cleaned.target?.incomingHitIntervalSeconds).toBeUndefined();
    const stats = loadoutStats(cleaned, { blessingPicks: ["Order", "Balance"] });
    expect(stats.barkscales.support).toBe("scenario-dependent");
    expect(stats.barkscales.triggers).toBeNull();

    expect(validateIncomingHitInterval(-1).ok).toBe(false);
    expect(validateIncomingHitInterval(Number.NaN).ok).toBe(false);
    expect(validateScenarioDuration(0).ok).toBe(false);
    expect(validateScenarioDuration(60).ok).toBe(true);
  });
});

describe("domain validators", () => {
  it("rejects NaN and out-of-range domain values", () => {
    expect(validateArmour(Number.NaN).ok).toBe(false);
    expect(validateArmour(-1).ok).toBe(false);
    expect(validateArmour(500).ok).toBe(true);
    expect(validateProbability(1.2).ok).toBe(false);
    expect(validateProbability(0.5).ok).toBe(true);
  });
});

describe("saved loadout migration preserves gear and blessings boundary", () => {
  it("normalizes a legacy loadout without dropping equipment or style", () => {
    const legacy = normalizeLoadout({
      base: 2000,
      style: "melee",
      level: 99,
      weaponTier: 90,
      equipmentSlots: { mainhand: "item:drygore-longsword" },
    });
    expect(legacy.baseDamage.mode).toBe("automatic"); // legacy base value preserved; mode freezes on demand
    expect(legacy.baseDamage.manualValue).toBe(2000);
    expect(legacy.equipmentSlots.mainhand).toBe("item:drygore-longsword");
    expect(legacy.weaponConfiguration).toBe("mainhand");
  });
});

describe("Big Boned product default", () => {
  it("includes +50% max life with no opt-out gate when the blessing is picked", () => {
    const withBb = loadoutStats(base, { blessingPicks: ["Balance"] });
    const without = loadoutStats(base);
    expect(withBb.life.normalMaxLife).toBe(Math.floor(without.life.normalMaxLife * 1.5));
    expect(withBb.league.blessingIds.has("big-boned")).toBe(true);
  });
});
