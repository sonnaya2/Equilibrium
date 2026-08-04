import { describe, expect, it } from "vitest";
import type { RegionId } from "@/league";
import { createCastContext } from "../../simulation/simulate";
import { baseInput } from "../../../test/fixtures/inputs";
import { CONSERVATION_OF_ENERGY_REFUND } from "../../../shared/conservationOfEnergy";
import {
  RING_OF_VIGOUR_ITEM_ID,
  RING_OF_VIGOUR_REFUND,
} from "../../../shared/ringOfVigour";
import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import {
  DEFAULT_LOADOUT,
  normalizeLoadout,
} from "../../../../components/combat/loadout/model";
import { loadoutStats } from "../../../../components/combat/loadoutStats";

const assault = baseInput.abilities.find((a) => a.id === "assault")!;
const berserk = baseInput.abilities.find((a) => a.id === "berserk")!;

const instability: AbilitySpec = {
  id: "instability",
  name: "Instability",
  style: "magic",
  category: "enhanced",
  weaponSpecial: true,
  hits: [{ band: { minPct: 120, maxPct: 140 } }],
  adrenaline: { cost: 50 },
};

const claws: AbilitySpec = {
  id: "claws_of_guthix",
  name: "Claws of Guthix",
  style: "magic",
  category: "enhanced",
  weaponSpecial: true,
  hits: [{ band: { minPct: 200, maxPct: 240 } }],
  adrenaline: { cost: 25 },
};

const special30: AbilitySpec = {
  id: "test_special_30",
  name: "Test Special 30",
  style: "melee",
  category: "enhanced",
  weaponSpecial: true,
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
  adrenaline: { cost: 30 },
};

const special60: AbilitySpec = {
  id: "test_special_60",
  name: "Test Special 60",
  style: "melee",
  category: "enhanced",
  weaponSpecial: true,
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
  adrenaline: { cost: 60 },
};

describe("Ring of Vigour - ultimates", () => {
  it("normal ultimate without Vigour leaves 0 after 100-cost from 100", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(0);
  });

  it("Vigour retains 10 after ultimate (refund path)", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);
  });

  it("dual sources still refund only once (ringOfVigour once)", () => {
    // resolveStages OR-resolves ring+passive to one ringOfVigour flag, never double refund.
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(RING_OF_VIGOUR_REFUND);
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(10);
  });

  it("equipped + permanent loadout still only +10 once", () => {
    const loadout = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ring: RING_OF_VIGOUR_ITEM_ID },
      buffs: { ...DEFAULT_LOADOUT.buffs, ringOfVigourPassive: true },
    });
    const stats = loadoutStats(loadout, {
      unlockedRegions: ["misthalin", "anachronia"] as readonly RegionId[],
    });
    expect(stats.adrenaline?.ringOfVigour).toBe(true);

    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: stats.adrenaline,
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(10);
    expect(cast.adrenalineTransaction?.conservationOfEnergyRefund).toBe(0);
  });

  it("cancelled / unaffordable ultimate grants nothing", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 50,
      adrenaline: { ringOfVigour: true },
    });
    const attempt = ctx.performCast(berserk, 0, false);
    expect(attempt.ok).toBe(false);
    expect(ctx.getState().adrenaline).toBe(50);
    expect(ctx.finish().casts).toHaveLength(0);
  });

  it("does not refund on non-ultimates", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.performCast(assault, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(75);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(0);
    expect(cast.adrenalineTransaction?.conservationOfEnergyRefund).toBe(0);
  });
});

describe("Ring of Vigour + Conservation of Energy", () => {
  it("Vigour alone leaves 10 after 100-cost ultimate", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);
  });

  it("CoE alone leaves 10 after 100-cost ultimate", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);
  });

  it("Vigour + CoE leaves 20 (additive, not triple with dual Vigour sources)", () => {
    expect(RING_OF_VIGOUR_REFUND + CONSERVATION_OF_ENERGY_REFUND).toBe(20);
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: {
        conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
        ringOfVigour: true,
      },
    });
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(20);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.adrenalineTransaction?.conservationOfEnergyRefund).toBe(10);
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(10);
    expect(
      (cast.adrenalineTransaction?.conservationOfEnergyRefund ?? 0) +
        (cast.adrenalineTransaction?.ringOfVigourRefund ?? 0),
    ).toBe(20);
  });

  it("respects adrenaline cap when refund would exceed it", () => {
    const ult: AbilitySpec = {
      id: "test_ult_cap",
      name: "Test Ult Cap",
      style: "melee",
      category: "ultimate",
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 50 },
    };
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      abilities: [...baseInput.abilities, ult],
      adrenaline: {
        conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
        ringOfVigour: true,
        relentlessRank: 5,
      },
    });
    expect(ctx.performCast(ult, 0, false, { relentless: true }).ok).toBe(true);
    // Relentless keeps 100; +20 refund clamps at cap 100.
    expect(ctx.getState().adrenaline).toBe(100);
  });
});

describe("Ring of Vigour - special attacks", () => {
  it("50 base -> requirement 45 and spend leaves 55 from 100", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      abilities: [...baseInput.abilities, instability],
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.costOf(instability)).toBe(45);
    expect(ctx.performCast(instability, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(55);
  });

  it("rounding: 25->23, 30->27, 55->50, 60->54 (requirement = spend)", () => {
    const special25 = claws;
    const special55: AbilitySpec = {
      id: "test_special_55",
      name: "Test Special 55",
      style: "melee",
      category: "enhanced",
      weaponSpecial: true,
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 55 },
    };

    for (const [spec, expected, remaining] of [
      [special25, 23, 77],
      [special30, 27, 73],
      [special55, 50, 50],
      [special60, 54, 46],
    ] as const) {
      const ctx = createCastContext({
        ...baseInput,
        startingAdrenaline: 100,
        abilities: [...baseInput.abilities, spec],
        adrenaline: { ringOfVigour: true },
      });
      expect(ctx.costOf(spec)).toBe(expected);
      expect(ctx.performCast(spec, 0, false).ok).toBe(true);
      expect(ctx.getState().adrenaline).toBe(remaining);
    }
  });

  it("requirement and spend use the same reduced cost (cast at 45 adren)", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 45,
      abilities: [...baseInput.abilities, instability],
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.costOf(instability)).toBe(45);
    expect(ctx.performCast(instability, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(0);
  });

  it("without Vigour, 45 adren cannot cast a 50-cost special", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 45,
      abilities: [...baseInput.abilities, instability],
    });
    expect(ctx.costOf(instability)).toBe(50);
    expect(ctx.performCast(instability, 0, false).ok).toBe(false);
    expect(ctx.getState().adrenaline).toBe(45);
  });

  it("EoF special (Claws of Guthix) uses the same 90% resolver", () => {
    // 25 -> 25 - floor(2.5) = 23
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      abilities: [...baseInput.abilities, claws],
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.costOf(claws)).toBe(23);
    expect(ctx.performCast(claws, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(77);
  });

  it("does not reduce non-special ability costs", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.costOf(assault)).toBe(assault.adrenaline?.cost ?? 0);
  });

  it("does not reduce ultimate activation costs", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
    });
    expect(ctx.costOf(berserk)).toBe(100);
  });
});
