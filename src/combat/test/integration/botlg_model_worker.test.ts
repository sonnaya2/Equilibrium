import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "../../abilities/catalogue";
import { buildSimulationInputBase, toRevolutionInput } from "../../model";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { packSimBaseFromModel } from "../../solver/packRequest";
import { reviveRevolutionBase } from "../../solver/worker/revive";
import { DEFAULT_LOADOUT, type Loadout } from "../../../components/combat/loadout/model";
import { resolveLoadoutCombat } from "../../../components/combat/toResolvedCombatModel";

const NOW = 1_700_000_000_000;

function botlgLoadout(useSpecial: boolean): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    style: "ranged",
    startingAdrenaline: 100,
    buffs: {
      ...DEFAULT_LOADOUT.buffs,
      useEquippedWeaponSpecial: useSpecial,
    },
    equipmentSlots: {
      ...DEFAULT_LOADOUT.equipmentSlots,
      twohand: "item:bow-of-the-last-guardian",
      ammo: "item:ful-arrows",
    },
  };
}

function projectedRevolution(model: ReturnType<typeof resolveLoadoutCombat>["model"]) {
  const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
  const bar = [catalogue.byId.get("ranged_attack")!];
  const direct = simulateRevolution(
    toRevolutionInput(buildSimulationInputBase(model, catalogue), {
      bar,
      style: "ranged",
      durationTicks: 120,
    }),
    { stochasticSeed: 1, stochasticLanes: 128 },
  );
  const revived = reviveRevolutionBase(packSimBaseFromModel(model));
  const worker = simulateRevolution(
    {
      ...revived,
      abilities: catalogue.catalogue,
      abilityRegistry: catalogue.abilityRegistry,
      bar,
      style: "ranged",
      durationTicks: 120,
    },
    { stochasticSeed: 1, stochasticLanes: 128 },
  );
  return { direct, worker };
}

function positivePerfectEquilibriumEvents(result: ReturnType<typeof simulateRevolution>) {
  return result.events.filter(
    (event) => event.abilityId === "perfect_equilibrium" && event.damage.expected > 0,
  );
}

describe("BotLG resolved-loadout projection", () => {
  it("carries the canonical bow passive and special into Revolution and the worker", () => {
    const on = resolveLoadoutCombat(botlgLoadout(true), { now: NOW });
    const off = resolveLoadoutCombat(botlgLoadout(false), { now: NOW });
    expect(on.model.equipmentEffects.activeWeapon).toMatchObject({
      id: "item:bow-of-the-last-guardian",
      specialAttackId: "balance_by_force",
    });
    expect(on.model.equipmentEffects.activeWeapon?.passiveIds).toContain("perfect-equilibrium");
    expect(on.model.base).toBeGreaterThan(0);
    expect(on.model.ammunition?.projectile).toMatchObject({ itemId: "item:ful-arrows" });
    const packed = packSimBaseFromModel(on.model);
    expect(packed.equipmentEffects.activeWeapon).toMatchObject({
      passiveIds: ["perfect-equilibrium"],
      specialAttackId: "balance_by_force",
    });
    expect(packed.ammunition?.projectile).toMatchObject({ itemId: "item:ful-arrows" });

    const onRuns = projectedRevolution(on.model);
    const offRuns = projectedRevolution(off.model);
    expect(onRuns.direct.ok).toBe(true);
    expect(onRuns.worker.ok).toBe(true);
    expect(offRuns.direct.ok).toBe(true);
    expect(offRuns.worker.ok).toBe(true);
    expect(onRuns.direct.casts.some((cast) => cast.abilityId === "balance_by_force")).toBe(true);
    expect(offRuns.direct.casts.some((cast) => cast.abilityId === "balance_by_force")).toBe(false);
    for (const [label, result] of [
      ["on-direct", onRuns.direct],
      ["on-worker", onRuns.worker],
      ["off-direct", offRuns.direct],
      ["off-worker", offRuns.worker],
    ] as const) {
      expect(positivePerfectEquilibriumEvents(result), label).not.toHaveLength(0);
    }
    expect(
      onRuns.direct.casts.some(
        (cast) => cast.abilityId === "balance_by_force" && cast.result.expected > 0,
      ),
    ).toBe(true);
    expect(onRuns.worker.totalExpected).toBeCloseTo(onRuns.direct.totalExpected, 8);
    expect(onRuns.worker.damageByTick).toEqual(onRuns.direct.damageByTick);
    expect(
      onRuns.worker.casts.map((cast) => [cast.abilityId, cast.actualSpend, cast.adrenalineAfter]),
    ).toEqual(
      onRuns.direct.casts.map((cast) => [cast.abilityId, cast.actualSpend, cast.adrenalineAfter]),
    );
    expect(onRuns.worker.events.map((event) => event.abilityId)).toEqual(
      onRuns.direct.events.map((event) => event.abilityId),
    );
  });
});
