import { describe, expect, it } from "vitest";
import {
  ARCHAEOLOGY_RELICS,
  canSelectRelic,
  hasAnachronia,
  isRelicActive,
  MONOLITH_ACTIVE_LIMIT,
  MONOLITH_ENERGY_DEFAULT,
  MONOLITH_ENERGY_EXTENDED,
  MONOLITH_EXTENDED_REGION,
  relicById,
  resolveMonolithEnergyCap,
  sanitizeArchaeologyState,
  sanitizeSelectedRelics,
  toggleArchaeologyRelic,
  totalEnergyUsed,
} from "./archaeologyRelics";
import {
  DEFAULT_LOADOUT,
  normalizeLoadout,
  withArchaeologySelection,
  withLoadoutBuffs,
} from "@/components/combat/loadout/model";
import { loadoutStats } from "@/components/combat/loadoutStats";

describe("ARCHAEOLOGY_RELICS registry", () => {
  it("lists every expected relic with energyCost and requiredRegions", () => {
    expect(ARCHAEOLOGY_RELICS.length).toBe(33);
    for (const relic of ARCHAEOLOGY_RELICS) {
      expect(relic.id.length).toBeGreaterThan(0);
      expect(relic.name.length).toBeGreaterThan(0);
      expect(relic.energyCost).toBeGreaterThan(0);
      expect(Array.isArray(relic.requiredRegions)).toBe(true);
      expect(relic.implementation === "full" || relic.implementation === "energy-only").toBe(
        true,
      );
    }
  });

  it("marks the four combat relics as full implementation", () => {
    const full = ARCHAEOLOGY_RELICS.filter((r) => r.implementation === "full").map((r) => r.id);
    expect(full.sort()).toEqual(
      [
        "berserkers_fury",
        "conservation_of_energy",
        "fury_of_the_small",
        "heightened_senses",
      ].sort(),
    );
  });

  it("pins energy costs and regions for the four full combat relics", () => {
    expect(relicById("berserkers_fury")).toMatchObject({
      energyCost: 250,
      requiredRegions: ["morytania"],
      implementation: "full",
    });
    expect(relicById("fury_of_the_small")).toMatchObject({
      energyCost: 150,
      requiredRegions: ["kandarin"],
      implementation: "full",
    });
    expect(relicById("heightened_senses")).toMatchObject({
      energyCost: 350,
      requiredRegions: ["morytania"],
      implementation: "full",
    });
    expect(relicById("conservation_of_energy")).toMatchObject({
      energyCost: 350,
      requiredRegions: ["kandarin"],
      implementation: "full",
    });
  });

  it("looks up by id", () => {
    expect(relicById("berserkers_fury")?.energyCost).toBe(250);
    expect(relicById("nope")).toBeUndefined();
  });
});

describe("monolith energy cap", () => {
  it("defaults to 500 without Anachronia", () => {
    expect(MONOLITH_ENERGY_DEFAULT).toBe(500);
    expect(hasAnachronia(["misthalin", "kandarin"])).toBe(false);
    expect(
      resolveMonolithEnergyCap({ unlockedRegions: ["misthalin"], requestedCap: 650 }),
    ).toBe(MONOLITH_ENERGY_DEFAULT);
  });

  it("auto-enables 650 when Anachronia is unlocked", () => {
    expect(MONOLITH_EXTENDED_REGION).toBe("anachronia");
    expect(hasAnachronia(["anachronia"])).toBe(true);
    expect(
      resolveMonolithEnergyCap({ unlockedRegions: ["anachronia"], requestedCap: null }),
    ).toBe(MONOLITH_ENERGY_EXTENDED);
    expect(
      resolveMonolithEnergyCap({ unlockedRegions: ["anachronia"], requestedCap: 500 }),
    ).toBe(MONOLITH_ENERGY_EXTENDED);
  });

  it("forces 500 and trims when Anachronia is removed", () => {
    const heavy = ["heightened_senses", "conservation_of_energy"]; // 700
    const state = sanitizeArchaeologyState(
      { selectedIds: heavy, energyCap: 650 },
      ["misthalin"],
    );
    expect(state.energyCap).toBe(500);
    expect(totalEnergyUsed(state.selectedIds)).toBeLessThanOrEqual(500);
  });
});

describe("energy selection helpers", () => {
  it("sums energy and ignores unknowns / duplicates", () => {
    expect(totalEnergyUsed(["font_of_life", "font_of_life", "ghost"])).toBe(50);
    expect(totalEnergyUsed(["berserkers_fury", "fury_of_the_small"])).toBe(400);
  });

  it("trims over-budget selections from the end", () => {
    // 350 + 350 = 700 > 500 -> drop last
    const cleaned = sanitizeSelectedRelics({
      selectedIds: ["heightened_senses", "conservation_of_energy"],
      energyCap: 500,
      unlockedRegions: [],
    });
    expect(cleaned).toEqual(["heightened_senses"]);
  });

  it("drops unknown ids", () => {
    expect(
      sanitizeSelectedRelics({
        selectedIds: ["font_of_life", "not_a_relic"],
        energyCap: 500,
        unlockedRegions: [],
      }),
    ).toEqual(["font_of_life"]);
  });

  it("toggles when legal and no-ops when over budget", () => {
    const withFury = toggleArchaeologyRelic({
      relicId: "berserkers_fury",
      selectedIds: [],
      energyCap: 500,
    });
    expect(withFury).toEqual(["berserkers_fury"]);
    expect(isRelicActive(withFury, "berserkers_fury")).toBe(true);

    const off = toggleArchaeologyRelic({
      relicId: "berserkers_fury",
      selectedIds: withFury,
      energyCap: 500,
    });
    expect(off).toEqual([]);

    // 350 remaining after heightened_senses; conservation is also 350 - ok; add another 250 no
    const base = ["heightened_senses"];
    expect(
      canSelectRelic({ relicId: "conservation_of_energy", selectedIds: base, energyCap: 500 }),
    ).toBe(false);
    expect(
      toggleArchaeologyRelic({
        relicId: "berserkers_fury",
        selectedIds: base,
        energyCap: 500,
      }),
    ).toEqual(base);
  });
});


describe("monolith active slot limit", () => {
  it("exports MONOLITH_ACTIVE_LIMIT of 3", () => {
    expect(MONOLITH_ACTIVE_LIMIT).toBe(3);
  });

  it("cannot select a 4th relic under energy budget", () => {
    // three 50-cost relics = 150 <= 500
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(totalEnergyUsed(three)).toBe(150);
    expect(
      canSelectRelic({ relicId: "ring_of_luck", selectedIds: three, energyCap: 500 }),
    ).toBe(false);
    expect(
      toggleArchaeologyRelic({
        relicId: "ring_of_luck",
        selectedIds: three,
        energyCap: 500,
      }),
    ).toEqual(three);
  });

  it("sanitize trims to 3 from the end", () => {
    const four = [
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
      "ring_of_luck",
    ];
    expect(
      sanitizeSelectedRelics({
        selectedIds: four,
        energyCap: 500,
        unlockedRegions: [],
      }),
    ).toEqual(["font_of_life", "shadows_grace", "unexpected_diplomacy"]);
  });

  it("deselect still works when at 3", () => {
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(
      canSelectRelic({ relicId: "font_of_life", selectedIds: three, energyCap: 500 }),
    ).toBe(true);
    expect(
      toggleArchaeologyRelic({
        relicId: "font_of_life",
        selectedIds: three,
        energyCap: 500,
      }),
    ).toEqual(["shadows_grace", "unexpected_diplomacy"]);
  });

  it("ignores unknown ids when counting active slots", () => {
    // raw length is 3 but only 2 known; room for one more
    const withJunk = ["font_of_life", "ghost", "not_a_relic"];
    expect(
      canSelectRelic({ relicId: "shadows_grace", selectedIds: withJunk, energyCap: 500 }),
    ).toBe(true);
    const threeKnownPlusJunk = [
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
      "ghost",
    ];
    expect(
      canSelectRelic({
        relicId: "ring_of_luck",
        selectedIds: threeKnownPlusJunk,
        energyCap: 500,
      }),
    ).toBe(false);
  });

  it("energy and slot limits both apply", () => {
    // 3 small under energy still capped at 3
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(totalEnergyUsed(three) + 50).toBeLessThanOrEqual(500);
    expect(
      canSelectRelic({ relicId: "ring_of_luck", selectedIds: three, energyCap: 500 }),
    ).toBe(false);

    // 2 large fill energy before slots: heightened 350 + conservation 350 fails energy first
    const twoHeavy = ["heightened_senses"];
    expect(
      canSelectRelic({
        relicId: "conservation_of_energy",
        selectedIds: twoHeavy,
        energyCap: 500,
      }),
    ).toBe(false);

    // sanitizeArchaeologyState also applies slot trim via sanitizeSelectedRelics
    const state = sanitizeArchaeologyState(
      {
        selectedIds: [
          "font_of_life",
          "shadows_grace",
          "unexpected_diplomacy",
          "ring_of_luck",
        ],
        energyCap: 500,
      },
      ["misthalin"],
    );
    expect(state.selectedIds).toHaveLength(3);
    expect(state.selectedIds).toEqual([
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
    ]);
  });
});

describe("loadout archaeology persistence", () => {
  it("defaults empty archaeology at 500 energy", () => {
    expect(DEFAULT_LOADOUT.archaeology).toEqual({ selectedIds: [], energyCap: 500 });
    expect(normalizeLoadout(null).archaeology).toEqual({ selectedIds: [], energyCap: 500 });
  });

  it("migrates legacy berserkersFury buff into selectedIds", () => {
    const next = normalizeLoadout({
      buffs: { berserkersFury: true },
    });
    expect(next.archaeology.selectedIds).toContain("berserkers_fury");
    expect(next.buffs.berserkersFury).toBe(true);
  });

  it("syncs full-modeled buffs from selectedIds", () => {
    const next = withArchaeologySelection(
      DEFAULT_LOADOUT,
      ["fury_of_the_small", "heightened_senses"],
      500,
    );
    expect(next.buffs.furyOfTheSmall).toBe(true);
    expect(next.buffs.heightenedSenses).toBe(true);
    expect(next.buffs.berserkersFury).toBe(false);
    expect(next.buffs.conservationOfEnergy).toBe(false);
  });

  it("keeps berserkersFury buff toggle in lockstep with selection", () => {
    const on = withLoadoutBuffs(DEFAULT_LOADOUT, { berserkersFury: true });
    expect(on.archaeology.selectedIds).toContain("berserkers_fury");
    expect(on.buffs.berserkersFury).toBe(true);
    const off = withLoadoutBuffs(on, { berserkersFury: false });
    expect(off.archaeology.selectedIds).not.toContain("berserkers_fury");
    expect(off.buffs.berserkersFury).toBe(false);
  });

  it("sanitizes invalid energyCap and over-budget on normalize", () => {
    const next = normalizeLoadout({
      archaeology: {
        energyCap: 999,
        selectedIds: ["heightened_senses", "conservation_of_energy", "berserkers_fury"],
      },
    });
    expect(next.archaeology.energyCap).toBe(500);
    expect(totalEnergyUsed(next.archaeology.selectedIds)).toBeLessThanOrEqual(500);
  });

  it("trims 4 selectedIds to MONOLITH_ACTIVE_LIMIT on normalizeLoadout", () => {
    const four = [
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
      "ring_of_luck",
    ];
    expect(totalEnergyUsed(four)).toBeLessThanOrEqual(500);
    const next = normalizeLoadout({
      archaeology: { energyCap: 500, selectedIds: four },
    });
    expect(next.archaeology.selectedIds).toHaveLength(MONOLITH_ACTIVE_LIMIT);
    expect(next.archaeology.selectedIds).toEqual([
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
    ]);
  });
});

describe("loadoutStats archaeology active limit", () => {
  it("prefers full combat relics over energy-only when over the 3-slot limit", () => {
    // 3 cheap fillers + berserkers_fury last; drop energy-only so BF stays active.
    const four = [
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
      "berserkers_fury",
    ];
    const loadout = normalizeLoadout({
      archaeology: { energyCap: 500, selectedIds: four },
      buffs: { berserkersFury: true },
    });
    const rawFour = {
      ...loadout,
      archaeology: { energyCap: 500 as const, selectedIds: four },
      buffs: { ...loadout.buffs, berserkersFury: true },
    };
    const stats = loadoutStats(rawFour, {
      unlockedRegions: ["misthalin", "morytania", "desert"],
    });
    expect(stats.berserkersFury.active).toBe(true);

    // Fury of the Small also survives when mixed with three energy-only fillers.
    const withFotS = loadoutStats(
      {
        ...loadout,
        archaeology: {
          energyCap: 500 as const,
          selectedIds: [
            "font_of_life",
            "shadows_grace",
            "unexpected_diplomacy",
            "fury_of_the_small",
          ],
        },
        buffs: { ...loadout.buffs, furyOfTheSmall: true, berserkersFury: false },
      },
      { unlockedRegions: ["misthalin", "kandarin", "desert"] },
    );
    expect(withFotS.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
  });
});
