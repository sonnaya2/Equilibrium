import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../shared/equipment";
import { baseInput } from "../test/fixtures/inputs";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { resolveIcyTempest } from "../styles/melee/icyTempest";
import { createRuntime } from "../engine/runtime/runtime";
import { createCastContext } from "../engine/simulation/simulate";
import { castOutcomes, planCastOutcomes } from "../engine/simulation/branch";
import { simulateRevolution } from "../engine/simulation/revolution";
import { evaluateRevolutionBar } from "./evaluate";
import { buildCandidatePool } from "./candidatePool";

function input() {
  const equipmentIds = ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"] as const;
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: [...equipmentIds],
    equipmentEffects: activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { mainhand: equipmentIds[0], offhand: equipmentIds[1] },
    }),
    weaponConfiguration: "dualwield" as const,
  };
}

describe("Leng integration gate", () => {
  it("matches manual, Revolution, score-only, and full-analysis probability semantics", () => {
    const sim = input();
    const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
    const tempest = MELEE_ABILITIES.find((ability) => ability.id === "icy_tempest")!;
    const ctx = createCastContext(sim);
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    const spine = castOutcomes({ weight: 1, rt: createRuntime(sim) }, attack, 0, false).branches[0]!;
    const plans = planCastOutcomes(spine, tempest, spine.rt.state.tick, false);
    expect([...new Set(plans.plans.map((plan) => plan.prepared.spend))].sort((a, b) => b - a)).toEqual([
      30,
      18,
      6,
    ]);
    expect(resolveIcyTempest(spine.rt.state.melee.primordialIce, 0, false).expectedSpend).toBeCloseTo(
      28.56,
      12,
    );
    expect(ctx.performCast(tempest, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.finish().rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);

    const bar = [attack, MELEE_ABILITIES.find((ability) => ability.id === "assault")!, tempest];
    const revoInput = { ...sim, bar, style: "melee" as const, durationTicks: 40 };
    const full = simulateRevolution(revoInput, { detailLevel: "full-analysis" });
    const score = simulateRevolution(revoInput, { detailLevel: "score-only" });
    expect(full.ok).toBe(true);
    expect(score.ok).toBe(true);
    expect(full.totalExpected).toBeCloseTo(score.totalExpected, 8);

    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "dualwield",
      equipmentIds: [...sim.equipmentIds],
      passiveIds: ["leng-endless-frost", "leng-boundless-chill"],
    });
    const evalBar = ["assault", "fury", "icy_tempest"];
    const evalFull = evaluateRevolutionBar({
      bar: evalBar,
      style: "melee",
      durationTicks: 40,
      pool,
      sim,
      profileId: "balanced",
      detailLevel: "full-analysis",
    });
    const evalScore = evaluateRevolutionBar({
      bar: evalBar,
      style: "melee",
      durationTicks: 40,
      pool,
      sim,
      profileId: "balanced",
      detailLevel: "score-only",
    });
    expect(evalFull.ok).toBe(true);
    expect(evalScore.ok).toBe(true);
    expect(evalFull.summary?.totalExpected).toBeCloseTo(evalScore.summary?.totalExpected ?? -1, 8);
  });
});
