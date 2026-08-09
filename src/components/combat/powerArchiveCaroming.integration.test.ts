/**
 * End-to-end: Power Archive Caroming stored 4 -> effective 8 must raise GRico.
 * Regression for "I set Caroming 8 and GRico damage didn't move."
 */
import { describe, expect, it } from "vitest";
import type { BlessingPath } from "@/league/blessings";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import { simulate } from "@/combat/engine/simulation/simulate";
import { rotationOf } from "@/combat/engine/simulation/contracts";
import {
  buildSimulationInputBase,
  toManualSimulateInput,
} from "@/combat/model/simulationBase";
import { applyCaromingToRicochetHits } from "@/combat/styles/ranged/caroming";
import { caromingRicochetBonus } from "@/combat/shared/perks";
import { RANGED_ABILITIES } from "@/combat/styles/ranged/abilities";
import { DEFAULT_LOADOUT, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { resolveLoadoutCombat } from "./toResolvedCombatModel";
import { normalizePowerArchiveState } from "@/combat/league/powerArchive";

const BALANCE_GOD2: readonly BlessingPath[] = [
  "Balance",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
];

function archiveLoadout(storedCaroming: number, ancient = true): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    style: "ranged",
    // Equipment perks intentionally leave caroming at 0 - only Archive.
    powerArchive: normalizePowerArchiveState({
      slots: [
        {
          id: "carom",
          shell: "weapon",
          ancient,
          perks: [{ perkId: "caroming", rank: storedCaroming }],
        },
      ],
    }),
  };
}

describe("Power Archive Caroming → Greater Ricochet", () => {
  it("formula: rank 8 is +32 AD% per hit (not capped at 4)", () => {
    expect(caromingRicochetBonus(8)).toBeCloseTo(0.32, 10);
    const base = RANGED_ABILITIES.find((a) => a.id === "greater_ricochet")!.hits;
    const r4 = applyCaromingToRicochetHits(base, 4);
    const r8 = applyCaromingToRicochetHits(base, 8);
    expect(r4[0]!.band.minPct).toBe(base[0]!.band.minPct + 16);
    expect(r8[0]!.band.minPct).toBe(base[0]!.band.minPct + 32);
    expect(r8[0]!.band.minPct).toBeGreaterThan(r4[0]!.band.minPct);
  });

  it("loadoutStats exposes effective caromingRank for UI assumptions", () => {
    const loadout = archiveLoadout(4);
    const stats = loadoutStats(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(stats.league.blessingIds.has("power-archive")).toBe(true);
    expect(stats.caromingRank).toBe(8);
    expect(stats.procs?.aftershockRank ?? 0).toBe(0);
  });

  it("Archive stored 4 becomes model.caromingRank 8 when Power Archive is active", () => {
    const loadout = archiveLoadout(4);
    const off = resolveLoadoutCombat(loadout, {});
    const on = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(off.model.caromingRank).toBe(0);
    expect(on.model.caromingRank).toBe(8);
    expect(on.stats.league.blessingIds.has("power-archive")).toBe(true);
  });

  it("equipment Caroming 4 alone is NOT doubled (only Archive-stored ranks double)", () => {
    const loadout: Loadout = {
      ...DEFAULT_LOADOUT,
      style: "ranged",
      perks: { ...DEFAULT_LOADOUT.perks, caroming: 4 },
    };
    const withBlessing = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
    // Blessing active but no stored Archive gizmo → rank stays 4.
    expect(withBlessing.model.caromingRank).toBe(4);
  });

  it("GRico expected damage rises from Caroming 0 → 4 → 8", () => {
    const loadout = archiveLoadout(4);
    const plain = resolveLoadoutCombat(loadout, {});
    const r4equip = resolveLoadoutCombat(
      { ...DEFAULT_LOADOUT, style: "ranged", perks: { ...DEFAULT_LOADOUT.perks, caroming: 4 } },
      {},
    );
    const r8archive = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });

    expect(plain.model.caromingRank).toBe(0);
    expect(r4equip.model.caromingRank).toBe(4);
    expect(r8archive.model.caromingRank).toBe(8);

    const catalogue = resolveAbilityCatalogue({});
    const sim = (model: typeof plain.model) =>
      simulate(
        toManualSimulateInput(buildSimulationInputBase(model, catalogue), {
          rotation: rotationOf("greater_ricochet"),
        }),
      );

    const s0 = sim(plain.model);
    const s4 = sim(r4equip.model);
    const s8 = sim(r8archive.model);

    const hits = (summary: typeof s0) =>
      summary.events.filter(
        (e) => e.abilityId === "greater_ricochet" && e.family === "hit" && !e.attached,
      );

    const h0 = hits(s0);
    const h4 = hits(s4);
    const h8 = hits(s8);
    expect(h0.length).toBeGreaterThan(0);
    expect(h4.length).toBe(h0.length);
    expect(h8.length).toBe(h0.length);

    const total = (hs: typeof h0) => hs.reduce((s, e) => s + e.damage.expected, 0);
    const t0 = total(h0);
    const t4 = total(h4);
    const t8 = total(h8);

    expect(t4).toBeGreaterThan(t0);
    expect(t8).toBeGreaterThan(t4);
  });

  it("normalize rejects stored Caroming 8 on ancient gizmo (craft max 4)", () => {
    const loadout = archiveLoadout(8, true);
    // normalize clamps to ancient max stored 4
    expect(loadout.powerArchive.slots[0]?.perks[0]?.rank).toBe(4);
    const on = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(on.model.caromingRank).toBe(8);
  });
});
