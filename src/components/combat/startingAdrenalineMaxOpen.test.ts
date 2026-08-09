import { describe, expect, it } from "vitest";
import { loadoutStats } from "./loadoutStats";
import { DEFAULT_LOADOUT } from "./useLoadout";
import { toResolvedCombatModel } from "./toResolvedCombatModel";
import {
  buildSimulationInputBase,
  buildManualStatSimulationInputBase,
} from "@/combat/model";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import { createRuntime } from "@/combat/engine/runtime/runtime";

const t4Picks = ["Order", "Order", "Order", "Order"] as const;

describe("startingAdrenaline max open", () => {
  it("preserves T4 tierPassives and starts at 125 on the full loadout path", () => {
    const options = { blessingPicks: [...t4Picks] };
    const stats = loadoutStats(DEFAULT_LOADOUT, options);
    expect(stats.maxAdrenaline).toBe(125);
    expect(stats.startingAdrenaline).toBe(125);

    const model = toResolvedCombatModel(DEFAULT_LOADOUT, options, stats);
    expect(model.startingAdrenaline).toBe(125);
    expect(model.diagnostics.maxAdrenaline).toBe(125);
    expect(model.league.tierPassives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "tier-four-maximum-adrenaline" }),
      ]),
    );

    const catalogue = resolveAbilityCatalogue();
    const simBase = buildSimulationInputBase(model, catalogue);
    const rt = createRuntime(simBase);
    expect(rt.state.adrenalineCap).toBe(125);
    expect(rt.state.adrenaline).toBe(125);
  });

  it("rejects start above cap when league is absent", () => {
    const catalogue = resolveAbilityCatalogue();
    expect(() =>
      createRuntime(
        buildManualStatSimulationInputBase(
          { base: 1000, level: 99, accuracy: 1, critChance: 0 },
          catalogue,
          { startingAdrenaline: 125 },
        ),
      ),
    ).toThrow(/startingAdrenaline outside 0-100: 125/);
  });

  it("manual-stat scaffold carries league so T4 start 125 is legal", () => {
    const stats = loadoutStats(DEFAULT_LOADOUT, { blessingPicks: [...t4Picks] });
    expect(stats.startingAdrenaline).toBe(125);
    const catalogue = resolveAbilityCatalogue();
    const rt = createRuntime(
      buildManualStatSimulationInputBase(
        { base: 1000, level: 99, accuracy: 1, critChance: 0 },
        catalogue,
        {
          cap: stats.cap,
          startingAdrenaline: stats.startingAdrenaline,
          adrenaline: stats.adrenaline,
          procs: stats.procs,
          league: stats.league,
          equipmentEffects: stats.equipmentEffects,
        },
      ),
    );
    expect(rt.state.adrenalineCap).toBe(125);
    expect(rt.state.adrenaline).toBe(125);
  });
});
