import { describe, expect, it } from "vitest";
import type { BlessingPath } from "@/league/blessings";
import { DEFAULT_LOADOUT, normalizeLoadout, type Loadout } from "./loadout/model";
import { loadoutStats, type LoadoutStatsOptions } from "./loadoutStats";
import {
  POWER_ARCHIVE_PERKS,
  POWER_ARCHIVE_SLOT_CAP,
  normalizePowerArchiveState,
} from "@/combat/league/powerArchive";

const BALANCE_GOD2: readonly BlessingPath[] = [
  "Balance",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
];

function withArchive(
  slots: Loadout["powerArchive"]["slots"],
  blessing: boolean,
): { loadout: Loadout; options: LoadoutStatsOptions } {
  const loadout: Loadout = {
    ...DEFAULT_LOADOUT,
    powerArchive: normalizePowerArchiveState({ slots }),
  };
  return {
    loadout,
    options: { blessingPicks: blessing ? BALANCE_GOD2 : [] },
  };
}

describe("Power Archive loadout combat wiring", () => {
  it("does nothing when the blessing is not selected", () => {
    const { loadout, options } = withArchive(
      [
        {
          id: "s1",
          shell: "weapon",
          ancient: true,
          perks: [{ perkId: "aftershock", rank: 4 }],
        },
      ],
      false,
    );
    const off = loadoutStats(loadout, options);
    const base = loadoutStats(DEFAULT_LOADOUT, options);
    expect(off.procs?.aftershockRank ?? 0).toBe(0);
    expect(off.base).toBe(base.base);
  });

  it("doubles Aftershock archive ranks when Power Archive is active", () => {
    const { loadout, options } = withArchive(
      [
        {
          id: "s1",
          shell: "weapon",
          ancient: true,
          perks: [{ perkId: "aftershock", rank: 4 }],
        },
      ],
      true,
    );
    const stats = loadoutStats(loadout, options);
    expect(stats.league.blessingIds.has("power-archive")).toBe(true);
    expect(stats.procs?.aftershockRank).toBe(8);
  });

  it("keeps equipment Aftershock when higher than archive effective", () => {
    const loadout: Loadout = {
      ...DEFAULT_LOADOUT,
      perks: { ...DEFAULT_LOADOUT.perks, aftershock: 4 },
      powerArchive: normalizePowerArchiveState({
        slots: [
          {
            id: "s1",
            shell: "weapon",
            ancient: false,
            perks: [{ perkId: "aftershock", rank: 1 }],
          },
        ],
      }),
    };
    const stats = loadoutStats(loadout, { blessingPicks: BALANCE_GOD2 });
    // equipment 4 vs archive 1→2 → 4 wins
    expect(stats.procs?.aftershockRank).toBe(4);
  });

  it("Equilibrium Archive rank blocks crits and raises AD", () => {
    const loadout: Loadout = {
      ...DEFAULT_LOADOUT,
      powerArchive: normalizePowerArchiveState({
        slots: [
          {
            id: "s1",
            shell: "armour",
            ancient: true,
            perks: [{ perkId: "equilibrium", rank: 4 }],
          },
        ],
      }),
    };
    const off = loadoutStats(loadout, {});
    const on = loadoutStats(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(off.critsDisabled).toBe(false);
    expect(on.critsDisabled).toBe(true);
    expect(on.critChance).toBe(0);
    expect(on.base).toBeGreaterThan(off.base);
  });

  it("Equilibrium and Eruptive remain distinct under Archive", () => {
    const eqOnly: Loadout = {
      ...DEFAULT_LOADOUT,
      powerArchive: normalizePowerArchiveState({
        slots: [
          {
            id: "eq",
            shell: "weapon",
            ancient: true,
            perks: [{ perkId: "equilibrium", rank: 4 }],
          },
        ],
      }),
    };
    const erOnly: Loadout = {
      ...DEFAULT_LOADOUT,
      powerArchive: normalizePowerArchiveState({
        slots: [
          {
            id: "er",
            shell: "weapon",
            ancient: true,
            perks: [{ perkId: "eruptive", rank: 4 }],
          },
        ],
      }),
    };
    const eq = loadoutStats(eqOnly, { blessingPicks: BALANCE_GOD2 });
    const er = loadoutStats(erOnly, { blessingPicks: BALANCE_GOD2 });
    expect(eq.critsDisabled).toBe(true);
    expect(er.critsDisabled).toBe(false);
    expect(eq.base).not.toBe(er.base);
  });

  it("round-trips powerArchive through normalizeLoadout for all 29 perks", () => {
    const slots = POWER_ARCHIVE_PERKS.map((perk, i) => {
      const ancient = perk.ancientMaxStored != null;
      const max = ancient ? perk.ancientMaxStored! : perk.standardMaxStored!;
      const shell =
        perk.gizmoKind === "armour" ? ("armour" as const) : ("weapon" as const);
      return {
        id: `p-${perk.id}`,
        shell,
        ancient: perk.standardMaxStored == null ? true : ancient && i % 2 === 0,
        perks: [{ perkId: perk.id, rank: Math.max(1, Math.min(max, 2)) }],
      };
    });
    // Cap to 20 slots for the bot; still cover 20 distinct perks in the round-trip.
    const capped = slots.slice(0, POWER_ARCHIVE_SLOT_CAP);
    const raw = {
      ...DEFAULT_LOADOUT,
      powerArchive: { slots: capped },
    };
    const normalized = normalizeLoadout(raw);
    expect(normalized.powerArchive.slots.length).toBe(POWER_ARCHIVE_SLOT_CAP);
    const again = normalizeLoadout(normalized);
    expect(again.powerArchive).toEqual(normalized.powerArchive);
  });

  it("rejects a twenty-first gizmo on normalize", () => {
    const slots = Array.from({ length: 25 }, (_, i) => ({
      id: `s${i}`,
      shell: "weapon" as const,
      ancient: true,
      perks: [{ perkId: "precise" as const, rank: 5 }],
    }));
    const normalized = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      powerArchive: { slots },
    });
    expect(normalized.powerArchive.slots).toHaveLength(20);
  });

  it("ui-only Archive perks do not inject combat modifiers", () => {
    const loadout: Loadout = {
      ...DEFAULT_LOADOUT,
      powerArchive: normalizePowerArchiveState({
        slots: [
          {
            id: "lucky",
            shell: "armour",
            ancient: true,
            perks: [{ perkId: "lucky", rank: 6 }],
          },
        ],
      }),
    };
    const off = loadoutStats(DEFAULT_LOADOUT, { blessingPicks: BALANCE_GOD2 });
    const on = loadoutStats(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(on.base).toBe(off.base);
    expect(on.procs?.aftershockRank ?? 0).toBe(0);
    expect(on.procs?.cracklingRank ?? 0).toBe(0);
    expect(on.critChance).toBe(off.critChance);
  });
});
