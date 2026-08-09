import { describe, expect, it } from "vitest";
import blessingsData from "#shard/league/blessings.json";
import {
  BLESSING_PATHS,
  BLESSING_IDS,
  BLESSING_RESET_COUNT,
  activeBlessings,
  activeTierPassives,
  deriveGodTier,
  GOD_TIERS,
  GOD_TIER_SLOTS,
  godTierAlignments,
  uniqueBlessingPathCount,
  type BlessingChoice,
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
    expect(GOD_TIERS).toEqual([1, 2]);
    expect(GOD_TIER_SLOTS).toEqual([4, 8]);
    expect(BLESSING_RESET_COUNT).toBe(3);
  });

  it("keeps the compile-time path union in step with data/league/blessings.json", () => {
    expect([...BLESSING_PATHS].sort()).toEqual([...blessingsData.paths].sort());
    expect(GOD_TIER_SLOTS).toEqual(blessingsData.godTiers);
    expect(BLESSING_RESET_COUNT).toBe(blessingsData.resetCount);
  });

  it("keeps progression slots separate from public path and God tier numbers", () => {
    expect(blessingsData.records.map((record) => record.progressionSlot)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(blessingsData.records.filter((r) => r.godTier !== null).map((r) => r.godTier)).toEqual([
      1, 2,
    ]);
    expect(blessingsData.records.filter((r) => r.tier !== null).map((r) => r.tier)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("stores only the Tier 4 maximum-adrenaline passive", () => {
    expect(blessingsData.records.find((record) => record.tier === 4)?.passives).toMatchObject([
      { kind: "combat", effect: { type: "maximum-adrenaline", bonusPercent: 25 } },
    ]);
    expect(blessingsData.records.find((record) => record.godTier === 1)?.passives).toEqual([]);
    expect(blessingsData.records.find((record) => record.tier === 5)?.passives).toEqual([]);
    expect(activeTierPassives([O, O, O, B]).map((passive) => passive.id)).toEqual([
      "tier-four-maximum-adrenaline",
    ]);
  });

  it("contains every revealed card through God Tier 2", () => {
    expect(blessingsData.records.map((record) => record.choices.length)).toEqual([
      3, 3, 3, 3, 3, 3, 3, 3,
    ]);
    expect(BLESSING_IDS).toHaveLength(24);
    expect(new Set(BLESSING_IDS).size).toBe(BLESSING_IDS.length);
    const lateChoices = (
      blessingsData.records as unknown as readonly { choices: readonly BlessingChoice[] }[]
    )
      .slice(4)
      .flatMap((record) => record.choices);
    for (const choice of lateChoices) {
      if (
        choice.id === "havoc-born" ||
        choice.id === "higher-power" ||
        choice.id === "true-equilibrium" ||
        choice.id === "lord-of-light" ||
        choice.id === "tempered-heart" ||
        choice.id === "envenomed" ||
        choice.id === "tearing-thorns" ||
        choice.id === "unholy-critual" ||
        choice.id === "perfidious" ||
        choice.id === "genesis-essence" ||
        choice.id === "chaotic-insight"
      ) {
        continue;
      }
      expect(choice.support).toMatchObject({
        status: "not-modeled",
        mechanicsUnverified: true,
      });
      expect(choice.combat).toEqual({});
    }
    expect(lateChoices.find((choice) => choice.id === "havoc-born")).toMatchObject({
      support: { status: "modeled" },
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
    expect(lateChoices.find((choice) => choice.id === "tearing-thorns")).toMatchObject({
      support: { status: "modeled" },
      combat: { tearingThorns: { durationMultiplier: 2, hitsPerGrasp: 5 } },
    });
    expect(lateChoices.find((choice) => choice.id === "unholy-critual")).toMatchObject({
      support: { status: "modeled" },
      combat: { unholyCritual: { chanceBonus: 0.15, effectiveChanceCap: 0.5 } },
    });
    expect(lateChoices.find((choice) => choice.id === "lord-of-light")).toMatchObject({
      support: { status: "partially-modeled" },
      combat: {
        light: {
          cooldownTicks: 24,
          strikes: 5,
          maxTargetsPerStrike: 8,
          prayerDamagePerBonus: 0.02,
          healFraction: 0.05,
        },
      },
    });
    expect(lateChoices.find((choice) => choice.id === "tempered-heart")).toMatchObject({
      support: { status: "modeled" },
      combat: { passiveAdrenaline: { intervalTicks: 2, amount: 6 } },
    });
    expect(lateChoices.find((choice) => choice.id === "true-equilibrium")).toMatchObject({
      support: { status: "modeled", excluded: [] },
      combat: {
        baseAbilityDamagePerUniquePath: 75,
        armourPerUniquePath: 50,
        maximumLifePerUniquePath: 500,
        critChancePerUniquePath: 0.05,
        critDamagePerUniquePath: 0.075,
        prayerBonusPerUniquePath: 5,
      },
    });
    expect(lateChoices.find((choice) => choice.id === "perfidious")).toMatchObject({
      support: { status: "modeled", excluded: [] },
      combat: {
        strikingLightCooldownTicks: 8,
        perfidious: { cindersChanceMultiplier: 5, barkscalesHitsPerTrigger: 2 },
      },
    });
    expect(lateChoices.find((choice) => choice.id === "genesis-essence")).toMatchObject({
      support: { status: "modeled", mechanicsUnverified: true },
      combat: { weaponTierOverride: 120 },
    });
    expect(lateChoices.find((choice) => choice.id === "chaotic-insight")).toMatchObject({
      support: { status: "modeled", mechanicsUnverified: true, excluded: [] },
      combat: { additionalSetPiecesPerItem: 2 },
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
    expect(activeBlessings([C, C, C, C, C, C]).map((choice) => choice.id)).toContain(
      "chaotic-insight",
    );
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
  it("derives each God tier from its own progression segment", () => {
    expect(godTierAlignments([O, O, O, C, C, C])).toEqual({ 1: O, 2: C });
    expect(godTierAlignments([B, B, B, O, B, C])).toEqual({ 1: B, 2: B });
    expect(godTierAlignments([C, C, O, O, O, B])).toEqual({ 1: C, 2: O });
  });

  it("reports undecided gods independently per segment", () => {
    expect(godTierAlignments([O, O, B, C])).toEqual({ 1: O, 2: null });
    expect(godTierAlignments([O, C])).toEqual({ 1: null, 2: null });
    expect(godTierAlignments([])).toEqual({ 1: null, 2: null });
  });
});

describe("uniqueBlessingPathCount", () => {
  it("counts valid T1-T6 paths, including True Equilibrium and excluding blanks", () => {
    expect(uniqueBlessingPathCount([C, C, C, B])).toBe(2);
    expect(
      uniqueBlessingPathCount([
        C,
        "" as BlessingPath,
        "" as BlessingPath,
        B,
        "" as BlessingPath,
        "" as BlessingPath,
      ]),
    ).toBe(2);
    expect(
      uniqueBlessingPathCount([
        C,
        O,
        "" as BlessingPath,
        B,
        "" as BlessingPath,
        "" as BlessingPath,
      ]),
    ).toBe(3);
    expect(uniqueBlessingPathCount([O, B, C, B, O, C])).toBe(3);
    expect(uniqueBlessingPathCount([O, B, C, B, O, C, "" as BlessingPath])).toBe(3);
  });
});
