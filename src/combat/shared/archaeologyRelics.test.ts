import { describe, expect, it } from "vitest";
import {
  ARCHAEOLOGY_RELICS,
  archaeologySelectBlockReason,
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
  tryToggleArchaeologyRelic,
} from "./archaeologyRelics";
import {
  applyArchaeologyToggle,
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

  it("CoE 350 + Fury 150 is exactly valid at 500", () => {
    const pair = ["conservation_of_energy", "fury_of_the_small"];
    expect(totalEnergyUsed(pair)).toBe(500);
    expect(
      canSelectRelic({
        relicId: "fury_of_the_small",
        selectedIds: ["conservation_of_energy"],
        energyCap: 500,
      }),
    ).toBe(true);
    const result = tryToggleArchaeologyRelic({
      relicId: "fury_of_the_small",
      selectedIds: ["conservation_of_energy"],
      energyCap: 500,
    });
    expect(result).toEqual({
      ok: true,
      action: "selected",
      selectedIds: ["conservation_of_energy", "fury_of_the_small"],
    });
    expect(
      sanitizeSelectedRelics({ selectedIds: pair, energyCap: 500 }),
    ).toEqual(pair);
  });

  it("repair sanitize trims over-budget selections from the end", () => {
    // 350 + 350 = 700 > 500 -> drop last (repair path only)
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

  it("tryToggle accepts/deselects and rejects without silent drop", () => {
    const withFury = tryToggleArchaeologyRelic({
      relicId: "berserkers_fury",
      selectedIds: [],
      energyCap: 500,
    });
    expect(withFury).toEqual({
      ok: true,
      action: "selected",
      selectedIds: ["berserkers_fury"],
    });
    expect(isRelicActive(withFury.selectedIds, "berserkers_fury")).toBe(true);

    const off = tryToggleArchaeologyRelic({
      relicId: "berserkers_fury",
      selectedIds: withFury.selectedIds,
      energyCap: 500,
    });
    expect(off).toEqual({ ok: true, action: "deselected", selectedIds: [] });

    // HS 350 leaves 150 free; CoE is 350 -> energy reject, list unchanged
    const base = ["heightened_senses"];
    expect(
      archaeologySelectBlockReason({
        relicId: "conservation_of_energy",
        selectedIds: base,
        energyCap: 500,
      }),
    ).toBe("energy_limit");
    expect(
      tryToggleArchaeologyRelic({
        relicId: "conservation_of_energy",
        selectedIds: base,
        energyCap: 500,
      }),
    ).toEqual({
      ok: false,
      reason: "energy_limit",
      selectedIds: base,
    });
    expect(
      tryToggleArchaeologyRelic({
        relicId: "berserkers_fury",
        selectedIds: base,
        energyCap: 500,
      }),
    ).toEqual({
      ok: false,
      reason: "energy_limit",
      selectedIds: base,
    });
  });

  it("toggleArchaeologyRelic is selectedIds-only wrapper", () => {
    expect(
      toggleArchaeologyRelic({
        relicId: "berserkers_fury",
        selectedIds: [],
        energyCap: 500,
      }),
    ).toEqual(["berserkers_fury"]);
    expect(
      toggleArchaeologyRelic({
        relicId: "conservation_of_energy",
        selectedIds: ["heightened_senses"],
        energyCap: 500,
      }),
    ).toEqual(["heightened_senses"]);
  });
});

describe("monolith active slot limit", () => {
  it("exports MONOLITH_ACTIVE_LIMIT of 3", () => {
    expect(MONOLITH_ACTIVE_LIMIT).toBe(3);
  });

  it("rejects a 4th relic under energy budget without dropping others", () => {
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(totalEnergyUsed(three)).toBe(150);
    expect(
      canSelectRelic({ relicId: "ring_of_luck", selectedIds: three, energyCap: 500 }),
    ).toBe(false);
    expect(
      archaeologySelectBlockReason({
        relicId: "ring_of_luck",
        selectedIds: three,
        energyCap: 500,
      }),
    ).toBe("active_slot_limit");
    expect(
      tryToggleArchaeologyRelic({
        relicId: "ring_of_luck",
        selectedIds: three,
        energyCap: 500,
      }),
    ).toEqual({
      ok: false,
      reason: "active_slot_limit",
      selectedIds: three,
    });
  });

  it("repair sanitize trims to 3 from the end", () => {
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
      tryToggleArchaeologyRelic({
        relicId: "font_of_life",
        selectedIds: three,
        energyCap: 500,
      }),
    ).toEqual({
      ok: true,
      action: "deselected",
      selectedIds: ["shadows_grace", "unexpected_diplomacy"],
    });
  });

  it("ignores unknown ids when counting active slots", () => {
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
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(totalEnergyUsed(three) + 50).toBeLessThanOrEqual(500);
    expect(
      canSelectRelic({ relicId: "ring_of_luck", selectedIds: three, energyCap: 500 }),
    ).toBe(false);

    const twoHeavy = ["heightened_senses"];
    expect(
      canSelectRelic({
        relicId: "conservation_of_energy",
        selectedIds: twoHeavy,
        energyCap: 500,
      }),
    ).toBe(false);

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

  it("derives full-modeled buffs FROM selectedIds after load", () => {
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

  it("toggle off Fury stays off after normalize", () => {
    const on = withArchaeologySelection(DEFAULT_LOADOUT, ["fury_of_the_small"], 500);
    expect(on.buffs.furyOfTheSmall).toBe(true);
    const { loadout: off } = applyArchaeologyToggle(on, "fury_of_the_small", 500);
    expect(off.archaeology.selectedIds).not.toContain("fury_of_the_small");
    expect(off.buffs.furyOfTheSmall).toBe(false);
    const reloaded = normalizeLoadout(off);
    expect(reloaded.archaeology.selectedIds).not.toContain("fury_of_the_small");
    expect(reloaded.buffs.furyOfTheSmall).toBe(false);
  });

  it("applyArchaeologyToggle rejects over budget without mutating neighbors", () => {
    const base = withArchaeologySelection(DEFAULT_LOADOUT, ["heightened_senses"], 500);
    const { loadout, result } = applyArchaeologyToggle(base, "conservation_of_energy", 500);
    expect(result).toEqual({
      ok: false,
      reason: "energy_limit",
      selectedIds: ["heightened_senses"],
    });
    expect(loadout).toBe(base);
    expect(loadout.archaeology.selectedIds).toEqual(["heightened_senses"]);
  });

  it("CoE + Fury both stay selected at 500 after normalize", () => {
    const next = normalizeLoadout(
      withArchaeologySelection(
        DEFAULT_LOADOUT,
        ["conservation_of_energy", "fury_of_the_small"],
        500,
      ),
    );
    expect(next.archaeology.selectedIds).toEqual([
      "conservation_of_energy",
      "fury_of_the_small",
    ]);
    expect(next.buffs.conservationOfEnergy).toBe(true);
    expect(next.buffs.furyOfTheSmall).toBe(true);
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

  it("trims 4 selectedIds to MONOLITH_ACTIVE_LIMIT on normalizeLoadout (repair)", () => {
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

  it("preserves selection order; does not reorder on normalize", () => {
    const order = ["fury_of_the_small", "font_of_life", "shadows_grace"];
    const next = normalizeLoadout({
      archaeology: { energyCap: 500, selectedIds: order },
    });
    expect(next.archaeology.selectedIds).toEqual(order);
  });
});

describe("loadoutStats archaeology active limit", () => {
  it("with unlockedRegions trims 4 relics from the end (selection order)", () => {
    // 3 cheap + berserkers_fury last; sanitize pops last so BF is inactive.
    const four = [
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
      "berserkers_fury",
    ];
    const loadout = normalizeLoadout({
      archaeology: { energyCap: 500, selectedIds: four },
    });
    const rawFour = {
      ...loadout,
      archaeology: { energyCap: 500 as const, selectedIds: four },
      // Stale buff must not revive a trimmed relic.
      buffs: { ...loadout.buffs, berserkersFury: true },
    };
    const stats = loadoutStats(rawFour, {
      unlockedRegions: ["misthalin", "morytania", "desert"],
    });
    expect(stats.berserkersFury.active).toBe(false);

    const keepFury = {
      ...loadout,
      archaeology: {
        energyCap: 500 as const,
        selectedIds: ["font_of_life", "shadows_grace", "berserkers_fury"],
      },
      buffs: { ...loadout.buffs, berserkersFury: false },
    };
    const withFury = loadoutStats(keepFury, {
      unlockedRegions: ["misthalin", "morytania", "desert"],
    });
    expect(withFury.berserkersFury.active).toBe(true);
  });

  it("buff flag alone never reactivates a relic", () => {
    const stats = loadoutStats(
      {
        ...DEFAULT_LOADOUT,
        archaeology: { selectedIds: [], energyCap: 500 },
        buffs: { ...DEFAULT_LOADOUT.buffs, furyOfTheSmall: true },
      },
      { unlockedRegions: ["misthalin", "kandarin"] },
    );
    expect(stats.adrenaline?.basicAdrenalineFlatBonus).toBeUndefined();
  });
});
