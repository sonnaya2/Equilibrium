import { describe, expect, it, vi } from "vitest";
import { aggregateEquipmentStats, type EquipmentStatTotals } from "./equipmentStats";
import type { EquipmentRecord } from "../data/records";

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
  "mock:conduit": {
    id: "mock:conduit",
    name: "Mock conduit",
    sources: [],
    slot: "offhand",
    tier: 90,
    style: "necromancy",
    bonuses: {},
  },
  "mock:body": {
    id: "mock:body",
    name: "Mock body",
    sources: [],
    slot: "body",
    tier: 90,
    style: "melee",
    armourClass: "tank",
    bonuses: { armour: 800 },
  },
};

vi.mock("../data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data")>();
  return { ...actual, equipmentById: (id: string) => RECORDS[id] ?? actual.equipmentById(id) };
});

const { resolvedEquipmentSlots, wieldedOffhandKind } = await import("./equipment");

const totals = (equipmentSlots: Record<string, string>): EquipmentStatTotals =>
  aggregateEquipmentStats({ style: "melee", equipmentSlots }, (id) => RECORDS[id]);

describe("canonical equipped state", () => {
  it("suppresses a stored main-hand and off-hand while a two-handed weapon is equipped", () => {
    const slots = { twohand: "mock:2h", mainhand: "mock:mainhand", offhand: "mock:shield" };
    expect(resolvedEquipmentSlots({ equipmentSlots: slots })).toEqual({ twohand: "mock:2h" });
  });

  it("keeps both hands when no two-handed weapon is equipped", () => {
    const slots = { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body" };
    expect(resolvedEquipmentSlots({ equipmentSlots: slots })).toEqual(slots);
  });

  it("drops null and undefined slots rather than carrying empty keys", () => {
    expect(
      resolvedEquipmentSlots({ equipmentSlots: { mainhand: "mock:mainhand", offhand: null } }),
    ).toEqual({ mainhand: "mock:mainhand" });
  });
});

describe("wielded off-hand classification", () => {
  it.each([
    ["empty off-hand", { twohand: "mock:2h" }, null],
    ["stale shield under a two-hander", { twohand: "mock:2h", offhand: "mock:shield" }, null],
    ["stale defender under a two-hander", { twohand: "mock:2h", offhand: "mock:defender" }, null],
    ["genuine defender", { mainhand: "mock:mainhand", offhand: "mock:defender" }, "defender"],
    ["genuine shield", { mainhand: "mock:mainhand", offhand: "mock:shield" }, "shield"],
    ["Necromancy conduit", { mainhand: "mock:mainhand", offhand: "mock:conduit" }, null],
    ["main-hand alone", { mainhand: "mock:mainhand" }, null],
    ["nothing equipped", {}, null],
  ])("resolves %s", (_name, equipmentSlots, expected) => {
    expect(wieldedOffhandKind({ equipmentSlots })).toBe(expected);
  });

  it("never reads an ability-granted shield effect as a wielded shield", () => {
    // Necromancy's Bone Shield puts no item in the off-hand, so nothing an
    // ability does can reach this classification: it is item metadata only.
    expect(wieldedOffhandKind({ equipmentSlots: { mainhand: "mock:mainhand" } })).toBeNull();
    expect(wieldedOffhandKind({ equipmentIds: ["mock:shield"] })).toBeNull();
  });
});

describe("stat aggregation agrees with the resolved state", () => {
  it("ignores a stale shield's armour exactly as it ignores it for the wielded check", () => {
    const stale = { twohand: "mock:2h", offhand: "mock:shield", body: "mock:body" };
    expect(totals(stale).armour).toBe(800);
    expect(wieldedOffhandKind({ equipmentSlots: stale })).toBeNull();
  });

  it("counts a genuinely wielded shield in both", () => {
    const wielded = { mainhand: "mock:mainhand", offhand: "mock:shield", body: "mock:body" };
    expect(totals(wielded).armour).toBe(1_000);
    expect(wieldedOffhandKind({ equipmentSlots: wielded })).toBe("shield");
  });
});
