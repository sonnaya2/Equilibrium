import { describe, expect, it } from "vitest";
import { calculateLeagueAbility } from "@/combat/league/damage";
import { resolveLeagueRules } from "@/combat/league/ruleset";
import { CONSERVATION_OF_ENERGY_REFUND } from "@/combat/shared/conservationOfEnergy";
import { RING_OF_VIGOUR_ITEM_ID } from "@/combat/shared/ringOfVigour";
import { isRingOfVigourWorn } from "@/combat/shared/ringOfVigour";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { engineSpecs } from "@/combat/abilities/registry";
import {
  analysisAdrenalineBreakdownRows,
  analysisAdrenalineTransaction,
  adrenEconomyAssumptionRows,
  adrenEconomyFingerprint,
  netAdrenalineDelta,
} from "./adrenalinePresentation";
import { loadoutStats } from "./loadoutStats";
import {
  DEFAULT_LOADOUT,
  equipmentIdList,
  toggleUnlockPin,
  type Loadout,
} from "./useLoadout";

const emptyLeague = resolveLeagueRules({ ruleset: "base" });
const base: Loadout = { ...DEFAULT_LOADOUT };

const berserk = engineSpecs.get("berserk")!;
const attack = engineSpecs.get("attack")!;
const rend = engineSpecs.get("rend")!;

const special: AbilitySpec = {
  id: "instability",
  name: "Instability",
  style: "magic",
  category: "enhanced",
  weaponSpecial: true,
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
  adrenaline: { cost: 50 },
};

function previewDelta(ability: AbilitySpec, adren: Parameters<typeof calculateLeagueAbility>[1]["adrenaline"]) {
  const delta = calculateLeagueAbility(ability, {
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    modifiers: [],
    context: { style: ability.style, ruleset: "base" },
    rules: emptyLeague,
    adrenaline: adren,
  }).adrenalineDelta;
  if (delta === undefined) throw new Error("expected league adrenalineDelta");
  return delta;
}

describe("adrenalinePresentation", () => {
  it("matches calculateLeagueAbility delta for basic attacks with FotS + Invigorating + AJ", () => {
    const adren = {
      basicAdrenalineFlatBonus: 1,
      basicGainMultiplier: 1.2,
      abilityGainMultiplier: 1.5,
    };
    // attack is autoAttack: Invigorating multiplies basic attacks only.
    // (9 + 1) * 1.2 * 1.5 = 18
    const tx = analysisAdrenalineTransaction(attack, adren);
    expect(tx.furyOfTheSmallGain).toBe(1);
    expect(tx.totalAbilityGain).toBeCloseTo(18, 10);
    expect(netAdrenalineDelta(tx)).toBeCloseTo(previewDelta(attack, adren), 10);
  });

  it("separates CoE and RoV on ultimates (explicit fields only)", () => {
    const adren = {
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
      ringOfVigour: true,
    };
    const tx = analysisAdrenalineTransaction(berserk, adren);
    expect(tx.conservationOfEnergyRefund).toBe(10);
    expect(tx.ringOfVigourRefund).toBe(10);
    expect(netAdrenalineDelta(tx)).toBeCloseTo(previewDelta(berserk, adren), 10);

    const rows = analysisAdrenalineBreakdownRows(tx);
    expect(rows.some((r) => r.label === "Conservation of Energy" && r.value.includes("+10"))).toBe(
      true,
    );
    expect(rows.some((r) => r.label === "Ring of Vigour" && r.value.includes("+10"))).toBe(true);
  });

  it("shows listed vs effective cost for weapon specials under Vigour", () => {
    const withRoV = analysisAdrenalineTransaction(special, { ringOfVigour: true });
    expect(withRoV.listedCost).toBe(50);
    expect(withRoV.effectiveCost).toBe(45);
    expect(netAdrenalineDelta(withRoV)).toBe(-45);
    expect(netAdrenalineDelta(withRoV)).toBeCloseTo(
      previewDelta(special, { ringOfVigour: true }),
      10,
    );

    const costRow = analysisAdrenalineBreakdownRows(withRoV).find((r) => r.label === "Cost");
    expect(costRow?.value).toContain("listed 50%");
    expect(costRow?.value).toContain("effective 45%");
  });

  it("assumption rows list CoE and RoV separately from conservationOfEnergyRefund", () => {
    const stats = loadoutStats(
      {
        ...base,
        equipmentSlots: { ...base.equipmentSlots, ring: RING_OF_VIGOUR_ITEM_ID },
        archaeology: { selectedIds: ["conservation_of_energy"], energyCap: 500 },
        buffs: { ...base.buffs, conservationOfEnergy: false },
      },
      { unlockedRegions: ["kandarin"] },
    );
    const rows = adrenEconomyAssumptionRows(stats);
    expect(rows.some(([label]) => label === "Conservation of Energy")).toBe(true);
    expect(rows.some(([label, value]) => label === "Ring of Vigour" && String(value).includes("+10"))).toBe(
      true,
    );
    // Must not invent a single "Ultimate adren retain" reverse-engineered line.
    expect(rows.some(([label]) => label === "Ultimate adren retain")).toBe(false);
  });

  it("loadout path: CoE + FotS + RoV resolve the same rules for Arch / Analysis", () => {
    const loadout: Loadout = {
      ...base,
      equipmentSlots: { ...base.equipmentSlots, ring: RING_OF_VIGOUR_ITEM_ID },
      archaeology: {
        selectedIds: ["conservation_of_energy", "fury_of_the_small"],
        energyCap: 500,
      },
      buffs: { ...base.buffs, conservationOfEnergy: false, furyOfTheSmall: false },
      perks: { ...base.perks, invigorating: 4 },
    };
    const stats = loadoutStats(loadout, { unlockedRegions: ["kandarin"] });

    expect(stats.adrenaline?.conservationOfEnergyRefund).toBe(CONSERVATION_OF_ENERGY_REFUND);
    expect(stats.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
    expect(stats.adrenaline?.ringOfVigour).toBe(true);
    expect(
      (stats.adrenaline as { ultimateAdrenalineRefund?: number } | undefined)
        ?.ultimateAdrenalineRefund,
    ).toBeUndefined();

    const ultTx = analysisAdrenalineTransaction(berserk, stats.adrenaline);
    expect(ultTx.conservationOfEnergyRefund).toBe(10);
    expect(ultTx.ringOfVigourRefund).toBe(10);
    expect(netAdrenalineDelta(ultTx)).toBeCloseTo(
      previewDelta(berserk, stats.adrenaline),
      10,
    );

    const basicTx = analysisAdrenalineTransaction(rend, stats.adrenaline);
    expect(basicTx.furyOfTheSmallGain).toBe(1);
    // Ability basics: FotS yes, Invigorating no (autos only).
    expect(basicTx.invigoratingMultiplier).toBe(1);
    expect(netAdrenalineDelta(basicTx)).toBeCloseTo(
      previewDelta(rend, stats.adrenaline),
      10,
    );

    const autoTx = analysisAdrenalineTransaction(attack, stats.adrenaline);
    expect(autoTx.invigoratingMultiplier).toBeCloseTo(1.2, 10);
    expect(netAdrenalineDelta(autoTx)).toBeCloseTo(
      previewDelta(attack, stats.adrenaline),
      10,
    );
  });

  it("fingerprint changes when CoE, FotS, or ring toggles", () => {
    const bare = loadoutStats(base);
    const withCoe = loadoutStats({
      ...base,
      archaeology: { selectedIds: ["conservation_of_energy"], energyCap: 500 },
    });
    const withRing = loadoutStats({
      ...base,
      equipmentSlots: { ...base.equipmentSlots, ring: RING_OF_VIGOUR_ITEM_ID },
    });
    const withFotS = loadoutStats({
      ...base,
      archaeology: { selectedIds: ["fury_of_the_small"], energyCap: 500 },
    });

    expect(adrenEconomyFingerprint(withCoe)).not.toBe(adrenEconomyFingerprint(bare));
    expect(adrenEconomyFingerprint(withRing)).not.toBe(adrenEconomyFingerprint(bare));
    expect(adrenEconomyFingerprint(withFotS)).not.toBe(adrenEconomyFingerprint(bare));
    expect(adrenEconomyFingerprint(withCoe)).not.toBe(adrenEconomyFingerprint(withRing));
  });
});

describe("BuffsPanel ring worn vs unlock pin", () => {
  it("isRingOfVigourWorn is false for unlock pin alone", () => {
    const pinned = toggleUnlockPin(base, RING_OF_VIGOUR_ITEM_ID);
    expect(pinned.equipmentIds.includes(RING_OF_VIGOUR_ITEM_ID)).toBe(true);
    expect(equipmentIdList(pinned.equipmentSlots)).not.toContain(RING_OF_VIGOUR_ITEM_ID);
    expect(isRingOfVigourWorn(equipmentIdList(pinned.equipmentSlots))).toBe(false);

    // Pin must not activate loadout Vigour by itself (no passive, no Anachronia ring path).
    const stats = loadoutStats(pinned, { unlockedRegions: ["misthalin"] });
    expect(stats.adrenaline?.ringOfVigour).toBeUndefined();
  });

  it("equipping ring slot activates Vigour without unlock pin", () => {
    const worn: Loadout = {
      ...base,
      equipmentSlots: { ...base.equipmentSlots, ring: RING_OF_VIGOUR_ITEM_ID },
    };
    expect(isRingOfVigourWorn(equipmentIdList(worn.equipmentSlots))).toBe(true);
    const stats = loadoutStats(worn, { unlockedRegions: ["misthalin"] });
    expect(stats.adrenaline?.ringOfVigour).toBe(true);
  });

  it("permanent passive needs Anachronia; pin does not substitute", () => {
    const passiveOnly = loadoutStats(
      { ...base, buffs: { ...base.buffs, ringOfVigourPassive: true } },
      { unlockedRegions: ["misthalin"] },
    );
    expect(passiveOnly.adrenaline?.ringOfVigour).toBeUndefined();

    const passiveAnach = loadoutStats(
      { ...base, buffs: { ...base.buffs, ringOfVigourPassive: true } },
      { unlockedRegions: ["anachronia"] },
    );
    expect(passiveAnach.adrenaline?.ringOfVigour).toBe(true);
  });
});
