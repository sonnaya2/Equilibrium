import { describe, expect, it } from "vitest";
import type { RegionId } from "@/league";
import { simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";
import { createCastContext } from "../simulation/context";
import { baseInput } from "../../test/fixtures/inputs";
import {
  DEFAULT_LOADOUT,
  withArchaeologySelection,
  normalizeLoadout,
} from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { RING_OF_VIGOUR_ITEM_ID } from "../../shared/ringOfVigour";
import { CONSERVATION_OF_ENERGY_REFUND } from "../../shared/conservationOfEnergy";

const regions = [
  "misthalin",
  "kandarin",
  "morytania",
  "forinthry",
  "anachronia",
] as readonly RegionId[];

function statsFor(loadout: ReturnType<typeof normalizeLoadout>) {
  return loadoutStats(loadout, { unlockedRegions: regions });
}

describe("damage sim energy saves (adren economy)", () => {
  it("CoE alone: berserk leaves 10 adren after full dump", () => {
    const loadout = normalizeLoadout(
      withArchaeologySelection(DEFAULT_LOADOUT, ["conservation_of_energy"], 500),
    );
    const stats = statsFor(loadout);
    expect(stats.adrenaline?.ultimateAdrenalineRefund).toBe(10);

    const summary = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rotationOf("berserk", "attack"),
      startingAdrenaline: 100,
      adrenaline: stats.adrenaline,
    });
    expect(summary.error).toBeUndefined();
    const b = summary.casts.find((c) => c.abilityId === "berserk")!;
    expect(b.adrenalineAfter).toBe(10);
  });

  it("RoV equipment: same 10 retain + specials cheaper", () => {
    const loadout = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      equipmentSlots: { ring: RING_OF_VIGOUR_ITEM_ID },
    });
    const stats = statsFor(loadout);
    expect(stats.adrenaline?.ultimateAdrenalineRefund).toBe(10);
    expect(stats.adrenaline?.ringOfVigour).toBe(true);

    const ctx = createCastContext({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      adrenaline: stats.adrenaline,
    });
    const berserk = MELEE_ABILITIES.find((a) => a.id === "berserk")!;
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);
  });

  it("Relentless refund skips spend (energy save)", () => {
    const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
    const ctx = createCastContext({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 5 },
    });
    expect(ctx.performCast(assault, 0, false, { relentless: true }).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(100);
  });

  it("FotS + Invigorating in full simulate rotation", () => {
    const loadout = normalizeLoadout({
      ...withArchaeologySelection(DEFAULT_LOADOUT, ["fury_of_the_small"], 500),
      perks: { ...DEFAULT_LOADOUT.perks, invigorating: 4 },
    });
    const stats = statsFor(loadout);
    const summary = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rotationOf("attack"),
      startingAdrenaline: 0,
      adrenaline: stats.adrenaline,
    });
    expect(summary.casts[0]!.adrenalineAfter).toBeCloseTo(12, 10);
  });

  it("CoE + FotS together under energy budget", () => {
    const loadout = normalizeLoadout(
      withArchaeologySelection(
        DEFAULT_LOADOUT,
        ["fury_of_the_small", "conservation_of_energy"],
        500,
      ),
    );
    expect(loadout.archaeology.selectedIds).toEqual([
      "fury_of_the_small",
      "conservation_of_energy",
    ]);
    const stats = statsFor(loadout);
    expect(stats.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
    expect(stats.adrenaline?.ultimateAdrenalineRefund).toBe(CONSERVATION_OF_ENERGY_REFUND);
  });

  it("CoE leaves 10 after berserk and enables second 100-cost ult sooner", () => {
    const withCoE = normalizeLoadout(
      withArchaeologySelection(DEFAULT_LOADOUT, ["conservation_of_energy"], 500),
    );
    const statsOn = statsFor(withCoE);
    const statsOff = statsFor(DEFAULT_LOADOUT);

    const rot = rotationOf(
      "berserk",
      "attack",
      "attack",
      "attack",
      "attack",
      "attack",
      "attack",
      "attack",
      "attack",
      "attack",
      "attack",
      "attack",
      "berserk",
    );
    const on = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rot,
      startingAdrenaline: 100,
      adrenaline: statsOn.adrenaline,
      autoWeave: false,
    });
    const off = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      rotation: rot,
      startingAdrenaline: 100,
      adrenaline: statsOff.adrenaline,
      autoWeave: false,
    });
    expect(on.error ?? null).toBeNull();
    const firstOn = on.casts.find((c) => c.abilityId === "berserk")!;
    expect(firstOn.adrenalineAfter).toBe(10);
    const onBerserks = on.casts.filter((c) => c.abilityId === "berserk").length;
    const offBerserks = off.casts.filter((c) => c.abilityId === "berserk").length;
    expect(onBerserks).toBe(2);
    expect(offBerserks).toBe(1);
    expect(off.error).toMatch(/adrenaline/i);
  });
});
