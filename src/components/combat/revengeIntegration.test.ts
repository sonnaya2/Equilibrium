import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import { allEngineSpecs } from "@/combat/abilities/registry";
import { simulateRevolution } from "@/combat/engine/simulation/revolution";
import { buildSimulationInputBase, toRevolutionInput } from "@/combat/model";
import { packSimBase } from "@/combat/solver/packRequest";
import { solveFromRequest } from "@/combat/solver/solveFromRequest";
import { runUiRevolution } from "@/combat/solver/worker/uiRunHost";
import { emptyBuild, type BuildState } from "@/league";
import { resolveLoadoutCombat } from "@/components/combat/toResolvedCombatModel";
import { DEFAULT_LOADOUT, normalizeLoadout } from "./loadout/model";
import { solverSnapshotFromResolvedModel } from "./solverSnapshot";
import { packSolverRequestFromUi } from "./useRevolutionSolver";

describe("Revenge loadout integration", () => {
  it("surfaces stacks and beats attack-only through Run and solver worker inputs", async () => {
    const run = (incomingHitIntervalSeconds?: number) => {
      const loadout = normalizeLoadout({
        ...DEFAULT_LOADOUT,
        style: "melee",
        startingAdrenaline: 100,
        equipmentSlots: {
          mainhand: "item:drygore-mace",
          offhand: "item:malevolent-kiteshield",
        },
        target: {
          defenceLevel: 80,
          affinity: 70,
          ...(incomingHitIntervalSeconds ? { incomingHitIntervalSeconds } : {}),
        },
      });
      const { model } = resolveLoadoutCombat(loadout, {
        blessingPicks: ["Order", "Order", "Order"],
      });
      const catalogue = resolveAbilityCatalogue();
      const input = buildSimulationInputBase(model, catalogue);
      return {
        input,
        solverBase: packSimBase(solverSnapshotFromResolvedModel(model)),
        catalogue,
        summary: simulateRevolution(
          toRevolutionInput(input, {
            bar: [catalogue.byId.get("revenge")!, catalogue.byId.get("attack")!],
            style: "melee",
            durationTicks: 100,
          }),
        ),
      };
    };

    const noIncoming = run();
    const incoming = run(2.4);
    const withoutRevenge = simulateRevolution(
      toRevolutionInput(incoming.input, {
        bar: [incoming.catalogue.byId.get("attack")!],
        style: "melee",
        durationTicks: 100,
      }),
    );

    expect(incoming.input.incomingHitIntervalSeconds).toBe(2.4);
    expect(incoming.solverBase.incomingHitIntervalSeconds).toBe(2.4);
    expect(incoming.summary.casts.some((cast) => cast.abilityId === "revenge")).toBe(true);
    expect(incoming.summary.totalExpected).toBeGreaterThan(noIncoming.summary.totalExpected);
    expect(incoming.summary.perAbility.attack).toBeGreaterThan(
      noIncoming.summary.perAbility.attack,
    );
    expect(incoming.summary.totalExpected).toBeGreaterThan(withoutRevenge.totalExpected);
    const revengeStates = incoming.summary.events.flatMap(
      (event) => event.appliedEffects?.filter((effect) => effect.id === "revenge") ?? [],
    );
    expect(revengeStates.length).toBeGreaterThan(0);
    expect(Math.max(...revengeStates.map((effect) => effect.stackCount ?? 0))).toBe(16);
    expect(Math.max(...revengeStates.map((effect) => effect.damageMultiplier ?? 1))).toBe(1.8);
    expect(
      noIncoming.summary.events.some((event) =>
        event.appliedEffects?.some((effect) => effect.id === "revenge"),
      ),
    ).toBe(false);

    const workerRun = async (
      loadout: typeof incoming.solverBase,
      barIds: readonly string[] = ["revenge", "attack"],
    ) =>
      runUiRevolution(
        {
          loadout,
          barIds,
          style: "melee",
          durationTicks: 100,
        },
        { forceMainThread: true },
      );
    const [workerNoIncoming, workerIncoming, workerWithoutRevenge] = await Promise.all([
      workerRun(noIncoming.solverBase),
      workerRun(incoming.solverBase),
      workerRun(incoming.solverBase, ["attack"]),
    ]);
    expect(workerIncoming.summary.perAbility.attack).toBeGreaterThan(
      workerNoIncoming.summary.perAbility.attack,
    );
    expect(workerIncoming.summary.totalExpected).toBeGreaterThan(
      workerWithoutRevenge.summary.totalExpected,
    );
  });

  it("scores Revenge in the production Revo++ search", async () => {
    const loadout = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      style: "melee",
      startingAdrenaline: 100,
      equipmentSlots: {
        mainhand: "item:drygore-mace",
        offhand: "item:malevolent-kiteshield",
      },
      target: {
        defenceLevel: 80,
        affinity: 70,
        incomingHitIntervalSeconds: 2.4,
      },
    });
    const build: BuildState = {
      ...emptyBuild(),
      blessingPicks: ["Order", "Order", "Order"],
    };
    const { model } = resolveLoadoutCombat(loadout, {
      blessingPicks: ["Order", "Order", "Order"],
    });
    const request = packSolverRequestFromUi({
      combatModel: model,
      loadout,
      build,
      modelled: [],
      solverTier: "thorough",
      solverProfile: "balanced",
      limitToRegions: false,
      barSizePreset: "range8_11",
      now: 1_700_000_000_000,
    });

    const result = await solveFromRequest(request);

    expect(request.permittedCategories).toContain("threshold");
    expect(result.bar).toContain("revenge");
  }, 120_000);

  it("scores Preparation when its cooldown reduction beats a damage filler", async () => {
    const loadout = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      style: "melee",
      startingAdrenaline: 100,
      equipmentSlots: {
        mainhand: "item:drygore-mace",
        offhand: "item:malevolent-kiteshield",
      },
    });
    const build: BuildState = {
      ...emptyBuild(),
      blessingPicks: ["Order", "Order", "Order"],
    };
    const { model } = resolveLoadoutCombat(loadout, {
      blessingPicks: ["Order", "Order", "Order"],
    });
    const request = packSolverRequestFromUi({
      combatModel: model,
      loadout,
      build,
      modelled: [],
      solverTier: "thorough",
      solverProfile: "balanced",
      limitToRegions: false,
      barSizePreset: "fixed4",
      now: 1_700_000_000_000,
    });
    const allowed = new Set(["berserk", "preparation", "overpower", "meteor_strike", "debilitate"]);

    const result = await solveFromRequest({
      ...request,
      disabledAbilityIds: allEngineSpecs()
        .map((ability) => ability.id)
        .filter((id) => !allowed.has(id)),
    });

    expect(result.bar).toContain("preparation");
  }, 120_000);
});
