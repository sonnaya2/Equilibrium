/**
 * Integration: RevolutionPanel.run path must summon conjures for necro conduit loadouts.
 * Mirrors the exact UI chain: pickBar -> revoManagedModelled -> packSimBaseFromModel -> runUiRevolution.
 * Solved bars without conjures go through ensureNecroConjuresOnBarIds (silent-drop fix).
 */
import { describe, expect, it } from "vitest";
import { packSimBaseFromModel, runUiRevolution } from "@/combat/solver";
import { DEFAULT_LOADOUT, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { toResolvedCombatModel } from "./toResolvedCombatModel";
import {
  ensureNecroConjuresOnBarIds,
  pickBarForLoadout,
  revoManagedModelled,
  type RevoBarView,
} from "./revoBarResolve";

const NOW = 1_700_000_000_000;

function necroConduitLoadout(): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    style: "necromancy",
    startingAdrenaline: 100,
    equipmentSlots: {
      ...DEFAULT_LOADOUT.equipmentSlots,
      mainhand: "item:omni-guard",
      offhand: "item:soulbound-lantern",
    },
  };
}

/** Same barIds resolution as RevolutionPanel when activeBarIds is null. */
function modelledBarIds(loadout: Loadout, weaponConfiguration: string | undefined): string[] {
  const bar =
    pickBarForLoadout(loadout.style, weaponConfiguration as never) ??
    pickBarForLoadout(loadout.style);
  expect(bar).toBeDefined();
  return revoManagedModelled(bar as RevoBarView, weaponConfiguration as never).map((m) => m.id);
}

describe("RevolutionPanel.run UI path - necro conjures", () => {
  it("wiki reference bar + conduit loadout casts conjure at tick 0 and emits conjureAuto", async () => {
    const loadout = necroConduitLoadout();
    const stats = loadoutStats(loadout, { now: NOW });
    // Conduit gear must report necromancy shape (or dualwield store shape).
    expect(["necromancy", "dualwield"]).toContain(stats.weaponConfiguration);

    const bar =
      pickBarForLoadout("necromancy", stats.weaponConfiguration) ??
      pickBarForLoadout("necromancy", "necromancy") ??
      pickBarForLoadout("necromancy");
    expect(bar).toBeDefined();

    const modelled = revoManagedModelled(bar!, stats.weaponConfiguration);
    const barIds = modelled.map((m) => m.id).filter(Boolean);
    expect(barIds.some((id) => id.startsWith("conjure_"))).toBe(true);

    const combatModel = toResolvedCombatModel(loadout, { now: NOW }, stats);
    expect(["necromancy", "dualwield"]).toContain(combatModel.weaponConfiguration);

    const packed = packSimBaseFromModel(combatModel);
    expect(["necromancy", "dualwield"]).toContain(packed.weaponConfiguration);

    const { summary } = await runUiRevolution(
      {
        loadout: packed,
        barIds,
        style: "necromancy",
        durationTicks: 100,
      },
      { forceMainThread: true },
    );

    expect(summary.ok).toBe(true);
    const conjureAt0 = summary.casts.some(
      (c) =>
        (c.abilityId === "conjure_undead_army" || c.abilityId === "conjure_skeleton_warrior") &&
        c.tick === 0,
    );
    expect(conjureAt0).toBe(true);
    expect(summary.events.filter((e) => e.family === "conjureAuto").length).toBeGreaterThan(0);
  });

  it("solved bar without conjures: inject wiki conjures then Run summons (no silent drop)", async () => {
    const loadout = necroConduitLoadout();
    const stats = loadoutStats(loadout, { now: NOW });
    const combatModel = toResolvedCombatModel(loadout, { now: NOW }, stats);
    const packed = packSimBaseFromModel(combatModel);

    // Solver-like bar that dropped all conjures (only basics).
    const solvedWithoutConjures = ["soul_sap", "touch_of_death"];
    expect(solvedWithoutConjures.every((id) => !id.startsWith("conjure_"))).toBe(true);

    // RevolutionPanel: applySolverBar / effectiveActiveBarIds / modelled ensure path.
    const barIds = ensureNecroConjuresOnBarIds(
      solvedWithoutConjures,
      "necromancy",
      packed.weaponConfiguration,
    );
    expect(barIds.some((id) => id.startsWith("conjure_")), `injected: ${barIds.join(",")}`).toBe(
      true,
    );
    expect(barIds[0]?.startsWith("conjure_")).toBe(true);

    const { summary } = await runUiRevolution(
      {
        loadout: packed,
        barIds,
        style: "necromancy",
        durationTicks: 100,
      },
      { forceMainThread: true },
    );

    expect(summary.ok).toBe(true);
    const conjureAt0 = summary.casts.some(
      (c) =>
        (c.abilityId === "conjure_undead_army" || c.abilityId === "conjure_skeleton_warrior") &&
        c.tick === 0,
    );
    expect(conjureAt0).toBe(true);
    expect(summary.events.filter((e) => e.family === "conjureAuto").length).toBeGreaterThan(0);
  });

  it("modelled ids from pickBar/revoManaged match wiki conjure set for necromancy shape", () => {
    for (const wc of ["necromancy", "dualwield"] as const) {
      const ids = modelledBarIds(necroConduitLoadout(), wc);
      expect(ids.some((id) => id === "conjure_undead_army" || id === "conjure_skeleton_warrior")).toBe(
        true,
      );
    }
  });
});
