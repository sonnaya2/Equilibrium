import { describe, expect, it } from "vitest";
import {
  ARCHAEOLOGY_RELICS,
  archaeologyRejectLabel,
  archaeologySelectBlockReason,
  hasAnachronia,
  isRelicActive,
  MONOLITH_ACTIVE_LIMIT,
  MONOLITH_ENERGY_ANTIQUARIAN,
  MONOLITH_ENERGY_DEFAULT,
  MONOLITH_ENERGY_EXTENDED,
  MONOLITH_EXTENDED_REGION,
  relicById,
  relicRegionsMet,
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
      expect(relic.implementation === "full" || relic.implementation === "energy-only").toBe(true);
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
    expect(resolveMonolithEnergyCap({ unlockedRegions: ["misthalin"], requestedCap: 650 })).toBe(
      MONOLITH_ENERGY_DEFAULT,
    );
  });

  it("auto-enables 650 when Anachronia is unlocked", () => {
    expect(MONOLITH_EXTENDED_REGION).toBe("anachronia");
    expect(hasAnachronia(["anachronia"])).toBe(true);
    expect(resolveMonolithEnergyCap({ unlockedRegions: ["anachronia"], requestedCap: null })).toBe(
      MONOLITH_ENERGY_EXTENDED,
    );
    expect(resolveMonolithEnergyCap({ unlockedRegions: ["anachronia"], requestedCap: 500 })).toBe(
      MONOLITH_ENERGY_EXTENDED,
    );
  });

  it("forces 500 and trims when Anachronia is removed", () => {
    const heavy = ["heightened_senses", "conservation_of_energy"]; // 700
    const state = sanitizeArchaeologyState({ selectedIds: heavy, energyCap: 650 }, ["misthalin"]);
    expect(state.energyCap).toBe(500);
    expect(totalEnergyUsed(state.selectedIds)).toBeLessThanOrEqual(500);
  });

  it("Antiquarian raises cap to 1000 over Anachronia", () => {
    expect(
      resolveMonolithEnergyCap({
        unlockedRegions: ["anachronia"],
        leagueRelics: ["Antiquarian"],
      }),
    ).toBe(MONOLITH_ENERGY_ANTIQUARIAN);
    expect(
      resolveMonolithEnergyCap({
        unlockedRegions: ["misthalin"],
        leagueRelics: ["Antiquarian"],
      }),
    ).toBe(MONOLITH_ENERGY_ANTIQUARIAN);
  });

  it("Antiquarian bypasses region gates and keeps 3-slot limit", () => {
    expect(
      archaeologySelectBlockReason({
        relicId: "berserkers_fury",
        selectedIds: [],
        energyCap: 500,
        unlockedRegions: ["misthalin"],
      }),
    ).toBe("region_locked");
    expect(
      archaeologySelectBlockReason({
        relicId: "berserkers_fury",
        selectedIds: [],
        energyCap: 1000,
        unlockedRegions: ["misthalin"],
        ignoreRegionGates: true,
      }),
    ).toBeNull();
    const state = sanitizeArchaeologyState(
      {
        selectedIds: ["berserkers_fury", "heightened_senses", "fury_of_the_small"],
        energyCap: 1000,
      },
      ["misthalin"],
      ["Antiquarian"],
    );
    expect(state.energyCap).toBe(1000);
    expect(state.selectedIds).toHaveLength(3);
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
      archaeologySelectBlockReason({
        relicId: "fury_of_the_small",
        selectedIds: ["conservation_of_energy"],
        energyCap: 500,
      }),
    ).toBeNull();
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
    expect(sanitizeSelectedRelics({ selectedIds: pair, energyCap: 500 })).toEqual(pair);
  });

  it("repair sanitize trims over-budget selections from the end", () => {
    // 350 + 350 = 700 > 500 -> drop last (repair path only)
    const cleaned = sanitizeSelectedRelics({
      selectedIds: ["heightened_senses", "conservation_of_energy"],
      energyCap: 500,
    });
    expect(cleaned).toEqual(["heightened_senses"]);
  });

  it("drops unknown ids", () => {
    expect(
      sanitizeSelectedRelics({
        selectedIds: ["font_of_life", "not_a_relic"],
        energyCap: 500,
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
    const four = ["font_of_life", "shadows_grace", "unexpected_diplomacy", "ring_of_luck"];
    expect(
      sanitizeSelectedRelics({
        selectedIds: four,
        energyCap: 500,
      }),
    ).toEqual(["font_of_life", "shadows_grace", "unexpected_diplomacy"]);
  });

  it("deselect still works when at 3", () => {
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(
      archaeologySelectBlockReason({
        relicId: "font_of_life",
        selectedIds: three,
        energyCap: 500,
      }),
    ).toBeNull();
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
      archaeologySelectBlockReason({
        relicId: "shadows_grace",
        selectedIds: withJunk,
        energyCap: 500,
      }),
    ).toBeNull();
    const threeKnownPlusJunk = ["font_of_life", "shadows_grace", "unexpected_diplomacy", "ghost"];
    expect(
      archaeologySelectBlockReason({
        relicId: "ring_of_luck",
        selectedIds: threeKnownPlusJunk,
        energyCap: 500,
      }),
    ).toBe("active_slot_limit");
  });

  it("energy and slot limits both apply", () => {
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(totalEnergyUsed(three) + 50).toBeLessThanOrEqual(500);
    expect(
      archaeologySelectBlockReason({
        relicId: "ring_of_luck",
        selectedIds: three,
        energyCap: 500,
      }),
    ).toBe("active_slot_limit");

    const twoHeavy = ["heightened_senses"];
    expect(
      archaeologySelectBlockReason({
        relicId: "conservation_of_energy",
        selectedIds: twoHeavy,
        energyCap: 500,
      }),
    ).toBe("energy_limit");

    const state = sanitizeArchaeologyState(
      {
        selectedIds: ["font_of_life", "shadows_grace", "unexpected_diplomacy", "ring_of_luck"],
        energyCap: 500,
      },
      ["misthalin", "desert", "morytania"],
    );
    expect(state.selectedIds).toHaveLength(3);
    expect(state.selectedIds).toEqual(["font_of_life", "shadows_grace", "unexpected_diplomacy"]);
  });
});

describe("region gates (requiredRegions)", () => {
  const FULL_COMBAT: readonly {
    id: string;
    region: "morytania" | "kandarin";
  }[] = [
    { id: "berserkers_fury", region: "morytania" },
    { id: "fury_of_the_small", region: "kandarin" },
    { id: "heightened_senses", region: "morytania" },
    { id: "conservation_of_energy", region: "kandarin" },
  ];

  it("relicRegionsMet requires ALL requiredRegions", () => {
    const deathWard = relicById("death_ward")!;
    expect(relicRegionsMet(deathWard, ["kandarin"])).toBe(false);
    expect(relicRegionsMet(deathWard, ["asgarnia"])).toBe(false);
    expect(relicRegionsMet(deathWard, ["kandarin", "asgarnia"])).toBe(true);
    expect(relicRegionsMet(deathWard, [])).toBe(false);
  });

  it("select without region is region_locked for each full combat relic", () => {
    for (const { id } of FULL_COMBAT) {
      expect(
        archaeologySelectBlockReason({
          relicId: id,
          selectedIds: [],
          energyCap: 500,
          unlockedRegions: ["misthalin"],
        }),
      ).toBe("region_locked");
      expect(
        tryToggleArchaeologyRelic({
          relicId: id,
          selectedIds: [],
          energyCap: 500,
          unlockedRegions: ["misthalin"],
        }),
      ).toEqual({
        ok: false,
        reason: "region_locked",
        selectedIds: [],
      });
    }
  });

  it("select with required region is ok for each full combat relic", () => {
    for (const { id, region } of FULL_COMBAT) {
      expect(
        archaeologySelectBlockReason({
          relicId: id,
          selectedIds: [],
          energyCap: 500,
          unlockedRegions: [region],
        }),
      ).toBeNull();
      expect(
        tryToggleArchaeologyRelic({
          relicId: id,
          selectedIds: [],
          energyCap: 500,
          unlockedRegions: [region],
        }),
      ).toEqual({
        ok: true,
        action: "selected",
        selectedIds: [id],
      });
    }
  });

  it("sanitize drops locked persisted relics when unlockedRegions provided", () => {
    const persisted = FULL_COMBAT.map((r) => r.id);
    expect(
      sanitizeSelectedRelics({
        selectedIds: persisted,
        energyCap: 650,
        unlockedRegions: ["misthalin"],
      }),
    ).toEqual([]);
    expect(
      sanitizeSelectedRelics({
        selectedIds: persisted,
        energyCap: 650,
        unlockedRegions: ["morytania"],
      }),
    ).toEqual(["berserkers_fury", "heightened_senses"]);
    expect(
      sanitizeSelectedRelics({
        selectedIds: persisted,
        energyCap: 650,
        unlockedRegions: ["kandarin"],
      }),
    ).toEqual(["fury_of_the_small", "conservation_of_energy"]);
    expect(
      sanitizeSelectedRelics({
        selectedIds: ["berserkers_fury", "fury_of_the_small"],
        energyCap: 500,
        unlockedRegions: ["morytania", "kandarin"],
      }),
    ).toEqual(["berserkers_fury", "fury_of_the_small"]);
  });

  it("sanitize omits region filter when unlockedRegions is omitted", () => {
    expect(
      sanitizeSelectedRelics({
        selectedIds: ["berserkers_fury", "fury_of_the_small"],
        energyCap: 500,
      }),
    ).toEqual(["berserkers_fury", "fury_of_the_small"]);
  });

  it("select order is unknown then region_locked then slots then energy", () => {
    expect(
      archaeologySelectBlockReason({
        relicId: "not_a_relic",
        selectedIds: [],
        energyCap: 500,
        unlockedRegions: [],
      }),
    ).toBe("unknown_relic");
    expect(
      archaeologySelectBlockReason({
        relicId: "berserkers_fury",
        selectedIds: [],
        energyCap: 500,
        unlockedRegions: ["misthalin"],
      }),
    ).toBe("region_locked");
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(
      archaeologySelectBlockReason({
        relicId: "berserkers_fury",
        selectedIds: three,
        energyCap: 500,
        unlockedRegions: ["misthalin", "morytania", "desert"],
      }),
    ).toBe("active_slot_limit");
    expect(
      archaeologySelectBlockReason({
        relicId: "conservation_of_energy",
        selectedIds: ["heightened_senses"],
        energyCap: 500,
        unlockedRegions: ["morytania", "kandarin"],
      }),
    ).toBe("energy_limit");
  });

  it("archaeologyRejectLabel covers region_locked", () => {
    expect(archaeologyRejectLabel("region_locked")).toMatch(/region/i);
  });

  it("energy and 3-slot still apply when region is unlocked", () => {
    const three = ["font_of_life", "shadows_grace", "unexpected_diplomacy"];
    expect(
      tryToggleArchaeologyRelic({
        relicId: "berserkers_fury",
        selectedIds: three,
        energyCap: 500,
        unlockedRegions: ["misthalin", "desert", "morytania"],
      }),
    ).toEqual({
      ok: false,
      reason: "active_slot_limit",
      selectedIds: three,
    });
    expect(
      tryToggleArchaeologyRelic({
        relicId: "conservation_of_energy",
        selectedIds: ["heightened_senses"],
        energyCap: 500,
        unlockedRegions: ["morytania", "kandarin"],
      }),
    ).toEqual({
      ok: false,
      reason: "energy_limit",
      selectedIds: ["heightened_senses"],
    });
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

  it("buff cannot enable CoE without kandarin", () => {
    const blocked = withLoadoutBuffs(DEFAULT_LOADOUT, { conservationOfEnergy: true }, [
      "misthalin",
    ]);
    expect(blocked.archaeology.selectedIds).not.toContain("conservation_of_energy");
    expect(blocked.buffs.conservationOfEnergy).toBe(false);

    const allowed = withLoadoutBuffs(DEFAULT_LOADOUT, { conservationOfEnergy: true }, ["kandarin"]);
    expect(allowed.archaeology.selectedIds).toContain("conservation_of_energy");
    expect(allowed.buffs.conservationOfEnergy).toBe(true);
  });

  it("buff cannot enable FotS/HS/Fury without required regions", () => {
    const blocked = withLoadoutBuffs(
      DEFAULT_LOADOUT,
      {
        furyOfTheSmall: true,
        heightenedSenses: true,
        berserkersFury: true,
      },
      ["misthalin"],
    );
    expect(blocked.archaeology.selectedIds).toEqual([]);
    expect(blocked.buffs).toMatchObject({
      furyOfTheSmall: false,
      heightenedSenses: false,
      berserkersFury: false,
    });

    // HS 350 + BF 250 = 600 > 500: both region-ok but energy still gates.
    const withMoryBoth = withLoadoutBuffs(
      DEFAULT_LOADOUT,
      { heightenedSenses: true, berserkersFury: true },
      ["morytania"],
    );
    expect(withMoryBoth.archaeology.selectedIds).toEqual(["berserkers_fury"]);
    expect(withMoryBoth.buffs.berserkersFury).toBe(true);
    expect(withMoryBoth.buffs.heightenedSenses).toBe(false);

    const withMoryHs = withLoadoutBuffs(DEFAULT_LOADOUT, { heightenedSenses: true }, ["morytania"]);
    expect(withMoryHs.archaeology.selectedIds).toEqual(["heightened_senses"]);
    expect(withMoryHs.buffs.heightenedSenses).toBe(true);
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

  it("applyArchaeologyToggle ignores raw region-locked ids (matches ArchPanel display)", () => {
    // Raw still holds Berserker's Fury (morytania) after regions drop; UI sanitize shows [].
    const dirty: typeof DEFAULT_LOADOUT = {
      ...DEFAULT_LOADOUT,
      archaeology: { selectedIds: ["berserkers_fury"], energyCap: 500 },
      buffs: { ...DEFAULT_LOADOUT.buffs, berserkersFury: true },
    };
    const unlocked = ["kandarin"] as const;
    const display = sanitizeArchaeologyState(dirty.archaeology, unlocked);
    expect(display.selectedIds).toEqual([]);

    // Click Fury of the Small: select against sanitized base, do not keep locked BF.
    const { loadout: on, result: selectResult } = applyArchaeologyToggle(
      dirty,
      "fury_of_the_small",
      500,
      unlocked,
    );
    expect(selectResult).toEqual({
      ok: true,
      action: "selected",
      selectedIds: ["fury_of_the_small"],
    });
    expect(on.archaeology.selectedIds).toEqual(["fury_of_the_small"]);
    expect(on.buffs.furyOfTheSmall).toBe(true);
    expect(on.buffs.berserkersFury).toBe(false);

    // Click locked BF: UI shows unselected; toggle must not "deselect" raw - reject region_locked.
    const { loadout: lockedClick, result: lockedResult } = applyArchaeologyToggle(
      dirty,
      "berserkers_fury",
      500,
      unlocked,
    );
    expect(lockedResult).toEqual({
      ok: false,
      reason: "region_locked",
      selectedIds: [],
    });
    expect(lockedClick).toBe(dirty);
  });

  it("applyArchaeologyToggle energy budget ignores ghost locked energy", () => {
    // Raw BF 250 + ghost; display free 500. CoE 350 must fit without energy_limit from BF.
    const dirty: typeof DEFAULT_LOADOUT = {
      ...DEFAULT_LOADOUT,
      archaeology: { selectedIds: ["berserkers_fury"], energyCap: 500 },
    };
    const unlocked = ["kandarin"] as const;
    const { loadout, result } = applyArchaeologyToggle(
      dirty,
      "conservation_of_energy",
      500,
      unlocked,
    );
    expect(result.ok).toBe(true);
    expect(loadout.archaeology.selectedIds).toEqual(["conservation_of_energy"]);
    expect(totalEnergyUsed(loadout.archaeology.selectedIds)).toBe(350);
  });

  it("withArchaeologySelection strips region-locked when unlockedRegions passed", () => {
    const next = withArchaeologySelection(
      DEFAULT_LOADOUT,
      ["berserkers_fury", "fury_of_the_small"],
      500,
      ["kandarin"],
    );
    expect(next.archaeology.selectedIds).toEqual(["fury_of_the_small"]);
    expect(next.buffs.berserkersFury).toBe(false);
    expect(next.buffs.furyOfTheSmall).toBe(true);
  });

  it("CoE + Fury both stay selected at 500 after normalize", () => {
    const next = normalizeLoadout(
      withArchaeologySelection(
        DEFAULT_LOADOUT,
        ["conservation_of_energy", "fury_of_the_small"],
        500,
      ),
    );
    expect(next.archaeology.selectedIds).toEqual(["conservation_of_energy", "fury_of_the_small"]);
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
    const four = ["font_of_life", "shadows_grace", "unexpected_diplomacy", "ring_of_luck"];
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
    const four = ["font_of_life", "shadows_grace", "unexpected_diplomacy", "berserkers_fury"];
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
