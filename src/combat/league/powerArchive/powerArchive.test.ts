import { describe, expect, it } from "vitest";
import {
  POWER_ARCHIVE_EFFECTIVE_MAXIMA,
  POWER_ARCHIVE_PERKS,
  POWER_ARCHIVE_SLOT_CAP,
  archiveEffectiveMax,
  archiveEffectiveRank,
  buildMaxDpsPowerArchiveState,
  canAddPowerArchiveSlot,
  emptyPowerArchiveState,
  equipmentRanksFromLoadoutPerks,
  normalizePowerArchiveState,
  powerArchivePerk,
  resolvePowerArchivePerks,
  withPowerArchiveEffectivePerks,
  withPowerArchiveSlot,
} from "./index";
import { bitingCritChanceBonus } from "@/combat/shared/perks";

describe("Power Archive catalogue", () => {
  it("lists all 29 Power Archive perks", () => {
    expect(POWER_ARCHIVE_PERKS).toHaveLength(29);
    const ids = new Set(POWER_ARCHIVE_PERKS.map((p) => p.id));
    expect(ids.size).toBe(29);
  });

  it("matches League Archive effective maxima from the wiki table", () => {
    // https://runescape.wiki/w/Power_Archive (effective ranks after doubling)
    const expected: Record<string, { standard: number | null; ancient: number | null }> = {
      absorbative: { standard: 6, ancient: 8 },
      aftershock: { standard: 6, ancient: 8 },
      biting: { standard: 6, ancient: 8 },
      "brief-respite": { standard: 6, ancient: 8 },
      bulwark: { standard: 6, ancient: 8 },
      caroming: { standard: 6, ancient: 8 },
      "clear-headed": { standard: 6, ancient: 8 },
      crackling: { standard: 6, ancient: 8 },
      "crystal-shield": { standard: 6, ancient: 8 },
      devoted: { standard: 6, ancient: 8 },
      energising: { standard: 6, ancient: 8 },
      "enhanced-devoted": { standard: 6, ancient: 8 },
      equilibrium: { standard: 6, ancient: 8 },
      eruptive: { standard: 6, ancient: 8 },
      flanking: { standard: 6, ancient: 8 },
      impatient: { standard: 6, ancient: 8 },
      invigorating: { standard: 6, ancient: 8 },
      lucky: { standard: 10, ancient: 12 },
      lunging: { standard: 6, ancient: 8 },
      precise: { standard: 10, ancient: 12 },
      preparation: { standard: 6, ancient: 8 },
      relentless: { standard: null, ancient: 10 },
      ruthless: { standard: null, ancient: 6 },
      scavenging: { standard: 6, ancient: 8 },
      "shield-bashing": { standard: 6, ancient: 8 },
      spendthrift: { standard: 10, ancient: 12 },
      "trophy-takers": { standard: 10, ancient: 12 },
      turtling: { standard: 6, ancient: 8 },
      ultimatums: { standard: 6, ancient: 8 },
    };
    for (const [id, row] of Object.entries(expected)) {
      expect(POWER_ARCHIVE_EFFECTIVE_MAXIMA[id as keyof typeof POWER_ARCHIVE_EFFECTIVE_MAXIMA], id).toEqual(
        row,
      );
    }
  });

  it("keeps Equilibrium and Eruptive as distinct catalogue entries", () => {
    expect(powerArchivePerk("equilibrium").label).toBe("Equilibrium");
    expect(powerArchivePerk("eruptive").label).toBe("Eruptive");
    expect(powerArchivePerk("equilibrium").wikiPath).toBe("Equilibrium");
    expect(powerArchivePerk("eruptive").wikiPath).toBe("Eruptive");
  });

  it("marks defensive/utility perks ui-only and offensive set combat-scoped", () => {
    const offensive = POWER_ARCHIVE_PERKS.filter((p) => p.combatScope === "offensive").map(
      (p) => p.id,
    );
    expect(offensive).toEqual(
      expect.arrayContaining([
        "aftershock",
        "biting",
        "crackling",
        "energising",
        "equilibrium",
        "eruptive",
        "precise",
        "spendthrift",
        "ultimatums",
        "caroming",
        "flanking",
        "lunging",
        "shield-bashing",
        "impatient",
        "invigorating",
        "relentless",
        "ruthless",
      ]),
    );
    expect(offensive).toHaveLength(17);
    expect(powerArchivePerk("absorbative").combatScope).toBe("ui-only");
    expect(powerArchivePerk("lucky").combatScope).toBe("ui-only");
  });
});

describe("Power Archive resolve", () => {
  it("does nothing when archive is inactive", () => {
    const resolved = resolvePowerArchivePerks({
      equipmentRanks: { aftershock: 4 },
      archive: {
        slots: [
          {
            id: "s1",
            shell: "weapon",
            ancient: true,
            perks: [{ perkId: "aftershock", rank: 4 }],
          },
        ],
      },
      archiveActive: false,
    });
    expect(resolved.get("aftershock")).toMatchObject({
      storedRank: 4,
      effectiveRank: 4,
      fromArchive: false,
    });
  });

  it("doubles archive-sourced scaling ranks", () => {
    const resolved = resolvePowerArchivePerks({
      equipmentRanks: {},
      archive: {
        slots: [
          {
            id: "s1",
            shell: "weapon",
            ancient: true,
            perks: [{ perkId: "aftershock", rank: 4 }],
          },
        ],
      },
      archiveActive: true,
    });
    expect(resolved.get("aftershock")).toMatchObject({
      storedRank: 4,
      effectiveRank: 8,
      fromArchive: true,
    });
    expect(archiveEffectiveRank("aftershock", 4, true)).toBe(8);
    expect(archiveEffectiveRank("aftershock", 4, false)).toBe(4);
  });

  it("highest effective rank wins across equipment and archive", () => {
    const resolved = resolvePowerArchivePerks({
      equipmentRanks: { biting: 4 },
      archive: {
        slots: [
          {
            id: "s1",
            shell: "armour",
            ancient: false,
            perks: [{ perkId: "biting", rank: 1 }],
          },
          {
            id: "s2",
            shell: "armour",
            ancient: true,
            perks: [{ perkId: "biting", rank: 3 }],
          },
        ],
      },
      archiveActive: true,
    });
    // equipment 4 vs archive 1→2 vs archive 3→6 → 6 wins
    expect(resolved.get("biting")?.effectiveRank).toBe(6);
    expect(resolved.get("biting")?.fromArchive).toBe(true);
  });

  it("does not stack duplicate archive copies", () => {
    const resolved = resolvePowerArchivePerks({
      equipmentRanks: {},
      archive: {
        slots: Array.from({ length: 5 }, (_, i) => ({
          id: `s${i}`,
          shell: "weapon" as const,
          ancient: true,
          perks: [{ perkId: "eruptive" as const, rank: 4 }],
        })),
      },
      archiveActive: true,
    });
    expect(resolved.get("eruptive")?.effectiveRank).toBe(8);
  });

  it("accepts twenty gizmos and rejects a twenty-first via normalize", () => {
    const slots = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      shell: "weapon" as const,
      ancient: true,
      perks: [{ perkId: "precise" as const, rank: 5 }],
    }));
    const normalized = normalizePowerArchiveState({ slots });
    expect(normalized.slots).toHaveLength(POWER_ARCHIVE_SLOT_CAP);
    expect(canAddPowerArchiveSlot(normalized)).toBe(false);
    const full = withPowerArchiveSlot(normalized, {
      id: "extra",
      shell: "weapon",
      ancient: true,
      perks: [{ perkId: "eruptive", rank: 2 }],
    });
    expect(full.slots).toHaveLength(POWER_ARCHIVE_SLOT_CAP);
  });

  it("round-trips combined two-perk gizmos and empty state", () => {
    expect(emptyPowerArchiveState().slots).toEqual([]);
    const state = normalizePowerArchiveState({
      slots: [
        {
          id: "combo",
          shell: "weapon",
          ancient: true,
          perks: [
            { perkId: "aftershock", rank: 4 },
            { perkId: "eruptive", rank: 2 },
            { perkId: "precise", rank: 5 },
          ],
        },
      ],
    });
    expect(state.slots[0]?.perks).toEqual([
      { perkId: "aftershock", rank: 4 },
      { perkId: "eruptive", rank: 2 },
    ]);
    const again = normalizePowerArchiveState(state);
    expect(again).toEqual(state);
  });

  it("rejects ancient-only perks on standard shells", () => {
    const state = normalizePowerArchiveState({
      slots: [
        {
          id: "std",
          shell: "weapon",
          ancient: false,
          perks: [
            { perkId: "relentless", rank: 5 },
            { perkId: "ruthless", rank: 3 },
            { perkId: "eruptive", rank: 3 },
          ],
        },
      ],
    });
    expect(state.slots[0]?.perks).toEqual([{ perkId: "eruptive", rank: 3 }]);
  });

  it("maps equipment loadout ranks into catalogue ids", () => {
    const ranks = equipmentRanksFromLoadoutPerks({
      aftershock: 4,
      equilibrium: 0,
      eruptive: 2,
      shieldBashing: 3,
    });
    expect(ranks).toEqual({ aftershock: 4, eruptive: 2, "shield-bashing": 3 });
  });

  it("ui-only perks resolve ranks but remain ui-only scoped", () => {
    const resolved = resolvePowerArchivePerks({
      equipmentRanks: {},
      archive: {
        slots: [
          {
            id: "s1",
            shell: "armour",
            ancient: true,
            perks: [{ perkId: "lucky", rank: 6 }],
          },
        ],
      },
      archiveActive: true,
    });
    expect(resolved.get("lucky")).toMatchObject({
      effectiveRank: 12,
      combatScope: "ui-only",
    });
  });

  it("archiveEffectiveMax matches doubled stored maxima", () => {
    expect(archiveEffectiveMax(powerArchivePerk("precise"), false)).toBe(10);
    expect(archiveEffectiveMax(powerArchivePerk("precise"), true)).toBe(12);
    expect(archiveEffectiveMax(powerArchivePerk("relentless"), false)).toBeNull();
    expect(archiveEffectiveMax(powerArchivePerk("relentless"), true)).toBe(10);
  });

  it("buildMaxDpsPowerArchiveState fills offensive perks at ancient max (skips Equilibrium)", () => {
    const state = buildMaxDpsPowerArchiveState({ ancient: true });
    const fillable = POWER_ARCHIVE_PERKS.filter(
      (p) => p.combatScope === "offensive" && p.id !== "equilibrium",
    );
    expect(state.slots.length).toBe(fillable.length);
    expect(state.slots.length).toBeLessThanOrEqual(POWER_ARCHIVE_SLOT_CAP);
    const ids = new Set(state.slots.flatMap((s) => s.perks.map((p) => p.perkId)));
    expect(ids.has("equilibrium")).toBe(false);
    for (const perk of fillable) {
      expect(ids.has(perk.id), perk.id).toBe(true);
    }
    expect(state.slots.every((s) => s.ancient)).toBe(true);
    const resolved = resolvePowerArchivePerks({
      equipmentRanks: {},
      archive: state,
      archiveActive: true,
    });
    expect(resolved.get("caroming")?.effectiveRank).toBe(8);
    expect(resolved.get("precise")?.effectiveRank).toBe(12);
    expect(resolved.get("aftershock")?.effectiveRank).toBe(8);
    expect(resolved.get("relentless")?.effectiveRank).toBe(10);
    expect(resolved.get("ruthless")?.effectiveRank).toBe(6);
    expect(resolved.get("equilibrium")).toBeUndefined();
  });

  it("buildMaxDpsPowerArchiveState can opt in Equilibrium", () => {
    const state = buildMaxDpsPowerArchiveState({ ancient: true, includeEquilibrium: true });
    const ids = new Set(state.slots.flatMap((s) => s.perks.map((p) => p.perkId)));
    expect(ids.has("equilibrium")).toBe(true);
  });

  it("buildMaxDpsPowerArchiveState standard fill skips Relentless and Ruthless", () => {
    const state = buildMaxDpsPowerArchiveState({ ancient: false });
    const ids = new Set(state.slots.flatMap((s) => s.perks.map((p) => p.perkId)));
    expect(ids.has("relentless")).toBe(false);
    expect(ids.has("ruthless")).toBe(false);
    expect(ids.has("equilibrium")).toBe(false);
    expect(state.slots.every((s) => !s.ancient)).toBe(true);
    const caroming = state.slots.find((s) => s.perks.some((p) => p.perkId === "caroming"));
    expect(caroming?.perks[0]?.rank).toBe(3);
    const precise = state.slots.find((s) => s.perks.some((p) => p.perkId === "precise"));
    expect(precise?.perks[0]?.rank).toBe(5);
    const resolved = resolvePowerArchivePerks({
      equipmentRanks: {},
      archive: state,
      archiveActive: true,
    });
    expect(resolved.get("caroming")?.effectiveRank).toBe(6);
    expect(resolved.get("precise")?.effectiveRank).toBe(10);
    expect(resolved.get("relentless")).toBeUndefined();
    expect(resolved.get("ruthless")).toBeUndefined();
  });

  it("clears L20 flags when archive effective rank wins over equipment", () => {
    const basePerks = {
      equilibrium: 0,
      eruptive: 0,
      biting: 4,
      bitingLevel20: true,
      invigorating: 0,
      impatient: 4,
      impatientLevel20: true,
      ultimatums: 0,
      lunging: 0,
      caroming: 0,
      energising: 0,
      crackling: 0,
      aftershock: 0,
      relentless: 4,
      relentlessLevel20: true,
      precise: 0,
      flanking: 0,
      shieldBashing: 0,
      spendthrift: 0,
      ruthless: 0,
    };
    const loadout = {
      perks: basePerks,
      powerArchive: normalizePowerArchiveState({
        slots: [
          {
            id: "bit",
            shell: "armour",
            ancient: true,
            perks: [{ perkId: "biting", rank: 4 }],
          },
          {
            id: "imp",
            shell: "armour",
            ancient: true,
            perks: [{ perkId: "impatient", rank: 4 }],
          },
          {
            id: "rel",
            shell: "weapon",
            ancient: true,
            perks: [{ perkId: "relentless", rank: 4 }],
          },
        ],
      }),
    };
    // archive 4→8 beats equipment 4; L20 must not apply to archive ranks
    const overlaid = withPowerArchiveEffectivePerks(loadout, true);
    expect(overlaid.perks.biting).toBe(8);
    expect(overlaid.perks.bitingLevel20).toBe(false);
    expect(overlaid.perks.impatient).toBe(8);
    expect(overlaid.perks.impatientLevel20).toBe(false);
    expect(overlaid.perks.relentless).toBe(8);
    expect(overlaid.perks.relentlessLevel20).toBe(false);
    expect(bitingCritChanceBonus(overlaid.perks.biting, overlaid.perks.bitingLevel20)).toBe(
      0.16,
    );
    expect(bitingCritChanceBonus(8, true)).toBeCloseTo(0.176, 10);

    // equipment wins: keep L20
    const equipmentWins = withPowerArchiveEffectivePerks(
      {
        perks: basePerks,
        powerArchive: normalizePowerArchiveState({
          slots: [
            {
              id: "bit-low",
              shell: "armour",
              ancient: false,
              perks: [{ perkId: "biting", rank: 1 }],
            },
          ],
        }),
      },
      true,
    );
    // equipment 4 vs archive 1→2 → equipment wins
    expect(equipmentWins.perks.biting).toBe(4);
    expect(equipmentWins.perks.bitingLevel20).toBe(true);
    expect(bitingCritChanceBonus(equipmentWins.perks.biting, equipmentWins.perks.bitingLevel20)).toBeCloseTo(
      0.088,
      10,
    );
  });
});
