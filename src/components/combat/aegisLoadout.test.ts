import { describe, expect, it, vi } from "vitest";
import type { EquipmentRecord } from "@/combat/data/records";

/**
 * Teragard's Aegis resolved through a real Setup loadout (stale off-hand and
 * Fortitude interactions). Armour values are chosen so the qualifying total is
 * exactly 1,000 without a shield.
 */
const RECORDS: Record<string, EquipmentRecord> = {
  "mock:2h": {
    id: "mock:2h",
    name: "Mock greataxe",
    sources: [],
    slot: "twohand",
    tier: 90,
    style: "melee",
    bonuses: {},
  },
  "mock:mainhand": {
    id: "mock:mainhand",
    name: "Mock sword",
    sources: [],
    slot: "mainhand",
    tier: 90,
    style: "melee",
    bonuses: {},
  },
  "mock:deathguard": {
    id: "mock:deathguard",
    name: "Mock death guard",
    sources: [],
    slot: "mainhand",
    tier: 90,
    style: "necromancy",
    bonuses: {},
  },
  "mock:conduit": {
    id: "mock:conduit",
    name: "Mock conduit",
    sources: [],
    slot: "offhand",
    tier: 90,
    style: "necromancy",
    bonuses: {},
  },
  "mock:shield": {
    id: "mock:shield",
    name: "Mock shield",
    sources: [],
    slot: "offhand",
    tier: 90,
    style: "melee",
    shield: true,
    bonuses: { armour: 200 },
  },
  "mock:defender": {
    id: "mock:defender",
    name: "Mock defender",
    sources: [],
    slot: "offhand",
    tier: 90,
    style: "melee",
    defender: true,
    bonuses: { armour: 120 },
  },
  "mock:body-1000": {
    id: "mock:body-1000",
    name: "Mock body",
    sources: [],
    slot: "body",
    tier: 90,
    style: "melee",
    armourClass: "tank",
    bonuses: { armour: 1_000 },
  },
};

vi.mock("@/combat/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/combat/data")>();
  return { ...actual, equipmentById: (id: string) => RECORDS[id] ?? actual.equipmentById(id) };
});

const { loadoutStats } = await import("./loadoutStats");
const { DEFAULT_LOADOUT } = await import("./useLoadout");
type Loadout = import("./useLoadout").Loadout;

const ORDER = ["Order", "Order", "Order"] as const;

const aegisOf = (loadout: Partial<Loadout>, basis: "equipment" | "total-rating" = "equipment") =>
  loadoutStats(
    {
      ...DEFAULT_LOADOUT,
      style: "melee",
      ...loadout,
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        ...loadout.buffs,
        aegisArmourBasis: basis,
      },
    } as Loadout,
    { blessingPicks: [...ORDER] },
  );

describe("Aegis through a Setup loadout", () => {
  it.each([
    ["no off-hand", { twohand: "mock:2h", body: "mock:body-1000" }, 250, "none"],
    [
      "a stale shield under a two-handed weapon",
      { twohand: "mock:2h", offhand: "mock:shield", body: "mock:body-1000" },
      250,
      "none",
    ],
    [
      "a stale defender under a two-handed weapon",
      { twohand: "mock:2h", offhand: "mock:defender", body: "mock:body-1000" },
      250,
      "none",
    ],
    [
      "a genuine defender",
      { mainhand: "mock:mainhand", offhand: "mock:defender", body: "mock:body-1000" },
      560,
      "defender",
    ],
    [
      "a genuine shield",
      { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body-1000" },
      900,
      "shield",
    ],
  ])("resolves %s", (_name, equipmentSlots, expected, offhand) => {
    const stats = aegisOf({ equipmentSlots });
    expect(stats.leagueBaseAbilityDamageBonus).toBe(expected);
    expect(stats.aegis.offhand).toBe(offhand);
  });

  it("gives a Necromancy death guard plus conduit the plain 25%", () => {
    const stats = aegisOf({
      style: "necromancy",
      equipmentSlots: { mainhand: "mock:deathguard", offhand: "mock:conduit" },
    });
    expect(stats.aegis.offhand).toBe("none");
    expect(stats.aegis.armourPercent).toBe(0.25);
  });

  it("gives a manual-weapon loadout with no real shield the plain 25%", () => {
    const stats = aegisOf({
      weaponConfiguration: "shield" as Loadout["weaponConfiguration"],
      baseDamage: { mode: "manual", manualValue: 2_000 },
      equipmentSlots: { body: "mock:body-1000" },
    });
    expect(stats.aegis.offhand).toBe("none");
    expect(stats.leagueBaseAbilityDamageBonus).toBe(250);
    expect(stats.base).toBe(2_250);
  });

  it("adds to manual base ability damage rather than multiplying final damage", () => {
    const shielded = aegisOf({
      baseDamage: { mode: "manual", manualValue: 2_000 },
      equipmentSlots: { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body-1000" },
    });
    expect(shielded.base).toBe(2_000 + 900);
  });

  it("equipment basis is identical with Fortitude off and on", () => {
    const slots = { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body-1000" };
    const off = aegisOf({ equipmentSlots: slots }, "equipment");
    const on = aegisOf(
      {
        equipmentSlots: slots,
        buffs: { ...DEFAULT_LOADOUT.buffs, fortitude: true },
      },
      "equipment",
    );
    expect(on.leagueBaseAbilityDamageBonus).toBe(off.leagueBaseAbilityDamageBonus);
    expect(on.base).toBe(off.base);
    expect(on.defence.blockArmourRating).toBeGreaterThan(off.defence.blockArmourRating);
    expect(on.life.temporaryMaxLife).toBeGreaterThan(off.life.temporaryMaxLife);
    expect(on.defence.totalArmour).not.toBe(on.defence.blockArmourRating);
    expect(on.aegis.qualifyingArmour).toBe(on.defence.totalArmour);
    expect(on.aegis.basis).toBe("equipment");
    expect(on.aegis.excludedBlockArmour).toBe(
      on.defence.blockArmourRating - on.defence.totalArmour,
    );
  });

  it("total-rating basis includes Fortitude block share (default product mode)", () => {
    const slots = { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body-1000" };
    const off = aegisOf({ equipmentSlots: slots }, "total-rating");
    const on = aegisOf(
      {
        equipmentSlots: slots,
        buffs: { ...DEFAULT_LOADOUT.buffs, fortitude: true },
      },
      "total-rating",
    );
    expect(on.aegis.basis).toBe("total-rating");
    expect(on.aegis.qualifyingArmour).toBe(on.defence.blockArmourRating);
    expect(on.leagueBaseAbilityDamageBonus).toBeGreaterThan(off.leagueBaseAbilityDamageBonus);
  });

  it("switching a shield for a two-handed weapon drops the multiplier without clearing the slot", () => {
    const withShield = aegisOf({
      equipmentSlots: { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body-1000" },
    });
    const switched = aegisOf({
      equipmentSlots: {
        mainhand: "mock:mainhand",
        offhand: "mock:shield",
        twohand: "mock:2h",
        body: "mock:body-1000",
      },
    });
    expect(withShield.aegis.offhand).toBe("shield");
    expect(switched.aegis.offhand).toBe("none");
    expect(switched.leagueBaseAbilityDamageBonus).toBe(250);
    // The shield's own armour left the total as well, so the two agree.
    expect(switched.defence.totalArmour).toBe(1_000);
    expect(withShield.defence.totalArmour).toBe(1_200);
  });

  it("switching a defender for a two-handed weapon drops the multiplier too", () => {
    const switched = aegisOf({
      equipmentSlots: {
        mainhand: "mock:mainhand",
        offhand: "mock:defender",
        twohand: "mock:2h",
        body: "mock:body-1000",
      },
    });
    expect(switched.aegis.offhand).toBe("none");
    expect(switched.leagueBaseAbilityDamageBonus).toBe(250);
  });

  it("reports nothing without the blessing", () => {
    const stats = loadoutStats({
      ...DEFAULT_LOADOUT,
      style: "melee",
      equipmentSlots: { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body-1000" },
    } as Loadout);
    expect(stats.leagueBaseAbilityDamageBonus).toBe(0);
    expect(stats.aegis.armourPercent).toBe(0);
  });
});

describe("Barkscales through a Setup loadout", () => {
  it("stays scenario-dependent until the target states an incoming cadence", () => {
    const stats = loadoutStats(
      { ...DEFAULT_LOADOUT, style: "melee", equipmentSlots: { body: "mock:body-1000" } } as Loadout,
      { blessingPicks: ["Order", "Balance", "Balance"] },
    );
    expect(stats.barkscales.support).toBe("scenario-dependent");
    expect(stats.barkscales.triggers).toBeNull();
    expect(stats.barkscales.missingInputs).toContain("Incoming qualifying-hit interval");
    expect(stats.barkscales.perHit).toBe(100);
  });

  it("resolves once the target supplies one", () => {
    const stats = loadoutStats(
      {
        ...DEFAULT_LOADOUT,
        style: "melee",
        equipmentSlots: { body: "mock:body-1000" },
        target: { defenceLevel: 80, affinity: "same", incomingHitIntervalSeconds: 6 },
      } as Loadout,
      { blessingPicks: ["Order", "Balance", "Balance"] },
    );
    expect(stats.barkscales.support).toBe("modeled");
    expect(stats.barkscales.qualifyingHits).toBe(10);
    expect(stats.barkscales.triggers).toBe(2);
  });
});
