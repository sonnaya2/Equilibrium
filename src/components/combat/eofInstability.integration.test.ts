/**
 * EoF-stored Instability through the /combat UI chain:
 * equipInSlot + store -> toResolvedCombatModel -> pack -> revo / manual simulate.
 */
import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import {
  buildSimulationInputBase,
  toHybridManualCombatModel,
  toManualSimulateInput,
  toRevolutionInput,
} from "@/combat/model";
import { simulate } from "@/combat/engine/simulation/simulate";
import { simulateRevolution } from "@/combat/engine/simulation/revolution";
import { rotationOf } from "@/combat/engine/simulation/contracts";
import {
  INSTABILITY_DURATION_TICKS,
  instabilityActive,
} from "@/combat/styles/magic/effects";
import { packSimBaseFromModel, runUiRevolution } from "@/combat/solver";
import { reviveRevolutionBase } from "@/combat/solver/worker/revive";
import { createCastContext } from "@/combat/engine/simulation/context";
import {
  DEFAULT_LOADOUT,
  equipInSlot,
  type Loadout,
} from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { toResolvedCombatModel } from "./toResolvedCombatModel";
import { filterAbilitiesForLoadout } from "./abilityLoadoutFilter";

const NOW = 1_700_000_000_000;
const STAFF = "item:staff-of-light";
const EOF = "item:essence-of-finality";

function eofInstabilityLoadout(policyOn: boolean): Loadout {
  let loadout = equipInSlot(DEFAULT_LOADOUT, "twohand", STAFF);
  loadout = equipInSlot(loadout, "amulet", EOF);
  return {
    ...loadout,
    style: "magic",
    startingAdrenaline: 100,
    eofStoredSpecialId: "instability",
    buffs: {
      ...loadout.buffs,
      useEquippedWeaponSpecial: policyOn,
    },
  };
}

describe("EoF Instability UI path", () => {
  it("packs store through model and nativeSpecial auto-casts + arms buff", async () => {
    const loadout = eofInstabilityLoadout(true);
    expect(loadout.equipmentIds).toEqual(expect.arrayContaining([STAFF, EOF]));
    expect(loadout.eofStoredSpecialId).toBe("instability");

    const stats = loadoutStats(loadout, { now: NOW });
    const model = toResolvedCombatModel(loadout, { now: NOW }, stats);
    expect(model.eofStoredSpecialId).toBe("instability");
    expect(model.nativeSpecialPolicy.useEquippedWeaponSpecial).toBe(true);
    expect(model.equipmentEffects.activeWeapon?.specialAttackId).toBeNull();
    expect(model.equipmentEffects.activeWeapon?.style).toBe("magic");
    expect(model.equipmentIds).toEqual(expect.arrayContaining([STAFF, EOF]));

    const packed = packSimBaseFromModel(model);
    expect(packed.eofStoredSpecialId).toBe("instability");
    expect(packed.nativeSpecialPolicy?.useEquippedWeaponSpecial).toBe(true);

    const hybrid = toHybridManualCombatModel(model, {
      base: model.base,
      level: model.level,
      accuracy: model.accuracy,
      critChance: model.crit.chance,
    });
    expect(hybrid.eofStoredSpecialId).toBe("instability");
    expect(packSimBaseFromModel(hybrid).eofStoredSpecialId).toBe("instability");

    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const bar = [catalogue.byId.get("magic_attack")!];
    const direct = simulateRevolution(
      toRevolutionInput(buildSimulationInputBase(model, catalogue), {
        bar,
        style: "magic",
        durationTicks: 20,
      }),
    );
    expect(direct.ok).toBe(true);
    expect(direct.casts[0]).toMatchObject({ abilityId: "instability", tick: 0 });

    const revived = reviveRevolutionBase(packed);
    expect(revived.eofStoredSpecialId).toBe("instability");
    const worker = simulateRevolution({
      ...revived,
      abilities: catalogue.catalogue,
      abilityRegistry: catalogue.abilityRegistry,
      bar,
      style: "magic",
      durationTicks: 20,
    });
    expect(worker.ok).toBe(true);
    expect(worker.casts[0]?.abilityId).toBe("instability");

    const { summary: uiSummary } = await runUiRevolution(
      {
        loadout: packed,
        barIds: ["magic_attack"],
        style: "magic",
        durationTicks: 20,
      },
      { forceMainThread: true },
    );
    expect(uiSummary.ok).toBe(true);
    expect(uiSummary.casts[0]?.abilityId).toBe("instability");

    // Cast arms the 50-tick Instability window (buff, not only the cast hit).
    const ctx = createCastContext(buildSimulationInputBase(model, catalogue));
    const attempt = ctx.performCast(ctx.byId.get("instability")!, 0, false);
    expect(attempt.ok).toBe(true);
    expect(ctx.getState().magic.instability.expiresAtTick).toBe(INSTABILITY_DURATION_TICKS);
    expect(instabilityActive(ctx.getState().magic.instability, 0)).toBe(true);
    expect(instabilityActive(ctx.getState().magic.instability, INSTABILITY_DURATION_TICKS)).toBe(
      false,
    );
  });

  it("manual rotation casts EoF Instability and schedules Lightning Surge on magic crit", () => {
    const loadout = eofInstabilityLoadout(false);
    const stats = loadoutStats(loadout, { now: NOW });
    const model = toResolvedCombatModel(loadout, { now: NOW }, stats);
    expect(model.nativeSpecialPolicy.useEquippedWeaponSpecial).toBe(false);
    expect(model.eofStoredSpecialId).toBe("instability");

    const displayCatalogue = resolveAbilityCatalogue();
    const palette = filterAbilitiesForLoadout(
      displayCatalogue.catalogue.filter((a) => a.style === "magic"),
      {
        weaponConfiguration: stats.weaponConfiguration,
        equipmentIds: stats.equipmentIds,
        activeWeapon: stats.equipmentEffects.activeWeapon,
        passiveIds: stats.equipmentEffects.passiveIds,
        eofStoredSpecialId: loadout.eofStoredSpecialId,
        league: stats.league,
      },
    );
    expect(palette.some((a) => a.id === "instability")).toBe(true);

    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const simBase = buildSimulationInputBase(model, catalogue);
    expect(simBase.eofStoredSpecialId).toBe("instability");

    const summary = simulate(
      toManualSimulateInput(
        { ...simBase, crit: { chance: 1 } },
        {
          rotation: rotationOf("instability", "magic_attack"),
          autoWeave: false,
          horizonTicks: 40,
        },
      ),
    );
    expect(summary.ok).toBe(true);
    expect(summary.casts[0]?.abilityId).toBe("instability");
    expect(summary.casts[1]?.abilityId).toBe("magic_attack");

    const followSeq = 1;
    const followEvents = summary.events.filter((e) => e.sourceCast === followSeq);
    expect(followEvents.map((e) => e.family)).toEqual(["hit", "proc"]);
    expect(followEvents[0]!.lightningSurge).toBe(true);
    expect(followEvents[1]!.provenance).toEqual({
      kind: "equipment_proc",
      detail: "lightning_surge",
    });
  });

  it("bar-placed Instability casts with EoF store even when auto-special policy is off", () => {
    const loadout = eofInstabilityLoadout(false);
    const stats = loadoutStats(loadout, { now: NOW });
    const model = toResolvedCombatModel(loadout, { now: NOW }, stats);
    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const bar = [
      catalogue.byId.get("instability")!,
      catalogue.byId.get("magic_attack")!,
    ];
    const summary = simulateRevolution(
      toRevolutionInput(buildSimulationInputBase(model, catalogue), {
        bar,
        style: "magic",
        durationTicks: 20,
      }),
    );
    expect(summary.ok).toBe(true);
    expect(summary.casts[0]).toMatchObject({ abilityId: "instability", tick: 0 });
  });
});
