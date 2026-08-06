import { describe, expect, it } from "vitest";
import blessingsData from "#shard/league/blessings.json";
import {
  BLESSING_PATHS,
  BLESSING_IDS,
  BLESSING_RESET_COUNT,
  activeBlessings,
  deriveGodTier,
  GOD_TIERS,
  godTierAlignments,
  type BlessingPath,
} from "./blessings";

const O: BlessingPath = "Order";
const B: BlessingPath = "Balance";
const C: BlessingPath = "Chaos";

type Triple = [BlessingPath, BlessingPath, BlessingPath];

function orderings(picks: Triple): Triple[] {
  const want = [...picks].sort().join();
  const out = new Map<string, Triple>();
  for (const a of BLESSING_PATHS)
    for (const b of BLESSING_PATHS)
      for (const c of BLESSING_PATHS) {
        const triple: Triple = [a, b, c];
        if ([...triple].sort().join() === want) out.set(triple.join(), triple);
      }
  return [...out.values()];
}

describe("canonical blessings data contract", () => {
  it("pins god tiers and reset count to confirmed Equilibrium structure", () => {
    expect(GOD_TIERS).toEqual([4, 8]);
    expect(BLESSING_RESET_COUNT).toBe(3);
  });

  it("keeps the compile-time path union in step with data/league/blessings.json", () => {
    expect([...BLESSING_PATHS].sort()).toEqual([...blessingsData.paths].sort());
    expect(GOD_TIERS).toEqual(blessingsData.godTiers);
    expect(BLESSING_RESET_COUNT).toBe(blessingsData.resetCount);
  });

  it("marks exactly tiers 4 and 8 as god tiers in the records", () => {
    expect(blessingsData.records.filter((r) => r.godTier).map((r) => r.tier)).toEqual([4, 8]);
  });

  it("contains every revealed card through God Tier 2", () => {
    expect(blessingsData.records.map((record) => record.choices.length)).toEqual([
      3, 3, 3, 3, 3, 3, 3, 3,
    ]);
    expect(BLESSING_IDS).toHaveLength(24);
    expect(new Set(BLESSING_IDS).size).toBe(BLESSING_IDS.length);
    const lateChoices = blessingsData.records.slice(4).flatMap((record) => record.choices);
    for (const choice of lateChoices) {
      if (choice.id === "havoc-born" || choice.id === "envenomed") continue;
      expect(choice.support).toMatchObject({
        status: "not-modeled",
        mechanicsUnverified: true,
      });
      expect(choice.combat).toEqual({});
    }
    expect(lateChoices.find((choice) => choice.id === "havoc-born")).toMatchObject({
      support: { status: "partially-modeled" },
      combat: { armourMultiplier: 0.75, damageMultiplier: 1.2, maximumLifeMultiplier: 0.75 },
    });
    expect(lateChoices.find((choice) => choice.id === "envenomed")).toMatchObject({
      support: { status: "modeled" },
      combat: {
        poisonDamageBaseBonus: 0.5,
        poisonDamagePerHerbloreLevel: 0.02,
        poisonImmunityDisableTicks: 50,
      },
    });
  });

  it("emits stable ids, support status, and the granted God Tier from Build picks", () => {
    expect(BLESSING_IDS).toEqual(
      blessingsData.records.flatMap((record) => record.choices.map((choice) => choice.id)),
    );
    expect(activeBlessings([B, C, C]).map((choice) => choice.id)).toEqual([
      "big-boned",
      "abyssal-cinders",
      "avernic-rampage",
      "demons-mark",
    ]);
    expect(activeBlessings([B, B, B, B, B, B]).map((choice) => choice.id)).toEqual([
      "big-boned",
      "barkscales",
      "eternal-sustenance",
      "true-equilibrium",
      "tearing-thorns",
      "envenomed",
      "splash-zone",
      "power-archive",
    ]);
    expect(
      activeBlessings([O, O, O]).find((choice) => choice.id === "steadfast-will")?.support,
    ).toMatchObject({
      status: "not-modeled",
      excluded: ["Bash", "Preparation cooldown reduction", "Reflect", "Revenge"],
    });
  });
});

describe("deriveGodTier — all 27 three-pick combinations", () => {
  const cases: { picks: Triple; god: BlessingPath; count: number }[] = [
    { picks: [O, O, O], god: O, count: 1 },
    { picks: [B, B, B], god: B, count: 1 },
    { picks: [C, C, C], god: C, count: 1 },
    { picks: [O, O, B], god: O, count: 3 },
    { picks: [O, O, C], god: O, count: 3 },
    { picks: [B, B, O], god: B, count: 3 },
    { picks: [B, B, C], god: B, count: 3 },
    { picks: [C, C, O], god: C, count: 3 },
    { picks: [C, C, B], god: C, count: 3 },
    { picks: [O, B, C], god: B, count: 6 },
  ];

  it.each(cases)("$picks -> $god across $count orderings", ({ picks, god, count }) => {
    const perms = orderings(picks);
    expect(perms).toHaveLength(count);
    for (const p of perms) expect(deriveGodTier(p)).toBe(god);
  });

  it("the patterns exhaust every ordered combination", () => {
    expect(cases.reduce((n, c) => n + c.count, 0)).toBe(3 ** 3);
  });
});

describe("deriveGodTier — partial picks stay honest", () => {
  it("settles early only on a locked majority", () => {
    expect(deriveGodTier([O, O])).toBe(O);
    expect(deriveGodTier([C, C])).toBe(C);
  });

  it("returns null while any god is still reachable", () => {
    expect(deriveGodTier([])).toBeNull();
    expect(deriveGodTier([O])).toBeNull();
    expect(deriveGodTier([O, B])).toBeNull();
    expect(deriveGodTier([C, O])).toBeNull();
  });
});

describe("godTierAlignments", () => {
  it("derives each god from its own segment: tier 4 <- picks 1-3, tier 8 <- picks 4-6", () => {
    expect(godTierAlignments([O, O, O, C, C, C])).toEqual({ 4: O, 8: C });
    expect(godTierAlignments([B, B, B, O, B, C])).toEqual({ 4: B, 8: B });
    expect(godTierAlignments([C, C, O, O, O, B])).toEqual({ 4: C, 8: O });
  });

  it("reports undecided gods independently per segment", () => {
    expect(godTierAlignments([O, O, B, C])).toEqual({ 4: O, 8: null });
    expect(godTierAlignments([O, C])).toEqual({ 4: null, 8: null });
    expect(godTierAlignments([])).toEqual({ 4: null, 8: null });
  });
});
