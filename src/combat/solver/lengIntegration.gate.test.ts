import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { activeEquipmentEffects } from "../shared/equipment";
import { baseInput } from "../test/fixtures/inputs";
import { createCastContext } from "../engine/simulation/simulate";
import { planCastOutcomes, castOutcomes } from "../engine/simulation/branch";
import { createRuntime } from "../engine/runtime/runtime";
import { simulateRevolution } from "../engine/simulation/revolution";
import { resolveIcyTempest } from "../styles/melee/icyTempest";
import {
  LENG_ENDLESS_FROST_CHANCE,
  LENG_BOUNDLESS_CHILL_CHANCE,
} from "../styles/melee/effects";
import { performCast, prepareSimulationCast, commitCast } from "../engine/cast";
import { evaluateRevolutionBar } from "./evaluate";
import { buildCandidatePool } from "./candidatePool";

const SCRATCH =
  process.env.GROK_SCRATCH ??
  "C:/Users/Sonnaya/AppData/Local/Temp/grok-goal-1154c38349fb/implementer";

describe("Leng integration gate (Manual / plan / single-rt / Revolution / solver)", () => {
  it("agrees on mass, integer spend forks, and rankable revo/solver", () => {
    const lengIds = ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"] as const;
    const effects = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: {
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    });
    const input = {
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      equipmentIds: [...lengIds],
      equipmentEffects: effects,
      weaponConfiguration: "dualwield" as const,
    };
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
    const fury = MELEE_ABILITIES.find((a) => a.id === "fury")!;
    const eStacks = (mass: readonly number[]) => mass.reduce((s, w, i) => s + w * i, 0);

    // --- Manual createCastContext ---
    const ctx = createCastContext(input);
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    const stacksAfterAttack = eStacks(ctx.getState().melee.primordialIce.stackMass);
    expect(stacksAfterAttack).toBeCloseTo(
      LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE,
      10,
    );
    expect(ctx.performCast(tempest, ctx.getState().tick, false).ok).toBe(true);
    const manualAdren = ctx.getState().adrenaline;
    expect(Math.abs(manualAdren - Math.round(manualAdren))).toBeLessThan(1e-9);
    expect(manualAdren).toBe(70);
    expect(manualAdren).not.toBeCloseTo(71.44, 1);
    const manualSummary = ctx.finish();
    expect(manualSummary.ok).toBe(true);

    // --- planCastOutcomes spend groups ---
    const attackSet = castOutcomes({ weight: 1, rt: createRuntime(input) }, attack, 0, false);
    const spine = attackSet.branches[0]!;
    const tPlans = planCastOutcomes(spine, tempest, spine.rt.state.tick, false);
    const spends = tPlans.plans.map((p) => ({ spend: p.prepared.spend, w: p.weight }));
    expect(spends.every((p) => Number.isInteger(p.spend))).toBe(true);
    const eSpend = spends.reduce((s, p) => s + p.spend * p.w, 0);
    expect(eSpend).toBeCloseTo(28.56, 1);
    const resolved = resolveIcyTempest(
      spine.rt.state.melee.primordialIce,
      spine.rt.state.tick,
      false,
    );
    expect(resolved.expectedSpend).toBeCloseTo(eSpend, 10);

    // --- Single-runtime engine/cast performCast ---
    const rtSolo = createRuntime(input);
    expect(performCast(rtSolo, attack, 0, false).ok).toBe(true);
    const soloBefore = rtSolo.state.adrenaline;
    expect(performCast(rtSolo, tempest, rtSolo.state.tick, false).ok).toBe(true);
    const soloSpent = soloBefore - rtSolo.state.adrenaline;
    expect(soloSpent).toBe(30);
    expect(rtSolo.state.adrenaline).not.toBeCloseTo(soloBefore - 28.56, 1);

    // --- prepareSimulationCast + commitCast ---
    const rtPrep = createRuntime(input);
    expect(performCast(rtPrep, attack, 0, false).ok).toBe(true);
    const prep = prepareSimulationCast(rtPrep, tempest, rtPrep.state.tick);
    expect(prep.ok).toBe(true);
    if (!prep.ok) throw new Error("prep failed");
    expect(prep.prepared.spend).toBe(30);
    expect(Number.isInteger(prep.prepared.spend)).toBe(true);
    const prepBefore = rtPrep.state.adrenaline;
    commitCast(rtPrep, prep.prepared, false);
    expect(rtPrep.state.adrenaline).toBe(prepBefore - 30);

    // --- Revolution score-only vs full ---
    const revoBase = {
      ...input,
      bar: [attack, assault, tempest, fury],
      style: "melee" as const,
      durationTicks: 40,
    };
    const revoFull = simulateRevolution(revoBase, { detailLevel: "full-analysis" });
    const revoScore = simulateRevolution(revoBase, { detailLevel: "score-only" });
    expect(revoFull.ok).toBe(true);
    expect(revoScore.ok).toBe(true);
    expect(revoFull.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-9);
    expect(revoScore.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-9);
    expect(revoFull.totalExpected).toBeCloseTo(revoScore.totalExpected, 4);

    // --- Solver evaluateRevolutionBar (search eval + full re-sim style) ---
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "dualwield",
      equipmentIds: [...lengIds],
      passiveIds: ["leng-endless-frost", "leng-boundless-chill"],
    });
    expect(pool.ids).toContain("icy_tempest");
    const barIds = ["assault", "icy_tempest", "fury", "dismember"];
    const evalFull = evaluateRevolutionBar({
      bar: barIds,
      style: "melee",
      durationTicks: 40,
      pool,
      sim: input,
      profileId: "balanced",
      detailLevel: "full-analysis",
    });
    const evalScore = evaluateRevolutionBar({
      bar: barIds,
      style: "melee",
      durationTicks: 40,
      pool,
      sim: input,
      profileId: "balanced",
      detailLevel: "score-only",
    });
    expect(evalFull.ok).toBe(true);
    expect(evalScore.ok).toBe(true);
    expect(evalFull.summary?.totalExpected).toBeCloseTo(evalScore.summary?.totalExpected ?? -1, 4);

    const report = {
      stacksAfterAttack,
      manualHeaviestAdren: manualAdren,
      spendGroups: spends,
      expectedSpend: eSpend,
      singleRuntimeSpent: soloSpent,
      prepareCommitSpend: prep.prepared.spend,
      revoFullTotal: revoFull.totalExpected,
      revoScoreTotal: revoScore.totalExpected,
      revoFullExactness: revoFull.rng?.exactness,
      revoScoreExactness: revoScore.rng?.exactness,
      solverPoolHasIcy: pool.ids.includes("icy_tempest"),
      evalFullTotal: evalFull.summary?.totalExpected,
      evalScoreTotal: evalScore.summary?.totalExpected,
      evalFullOk: evalFull.ok,
      evalScoreOk: evalScore.ok,
      gates: {
        massOk: Math.abs(stacksAfterAttack - 0.12) < 1e-9,
        manualIntegerNotFractional: manualAdren === 70,
        spendGroupsInteger: spends.every((p) => Number.isInteger(p.spend)),
        expectedSpendCorrect: Math.abs(eSpend - 28.56) < 0.05,
        singleRuntimeInteger: soloSpent === 30,
        prepareCommitInteger: prep.prepared.spend === 30,
        revoOk: revoFull.ok && revoScore.ok,
        revoTotalsAgree: Math.abs(revoFull.totalExpected - revoScore.totalExpected) < 1,
        solverEvalAgree:
          evalFull.ok &&
          evalScore.ok &&
          Math.abs(
            (evalFull.summary?.totalExpected ?? 0) - (evalScore.summary?.totalExpected ?? 1),
          ) < 1,
        solverPoolOk: pool.ids.includes("icy_tempest"),
      },
    };
    writeFileSync(join(SCRATCH, "leng-integration.log"), JSON.stringify(report, null, 2), "utf8");

    expect(report.gates.massOk).toBe(true);
    expect(report.gates.manualIntegerNotFractional).toBe(true);
    expect(report.gates.spendGroupsInteger).toBe(true);
    expect(report.gates.expectedSpendCorrect).toBe(true);
    expect(report.gates.singleRuntimeInteger).toBe(true);
    expect(report.gates.prepareCommitInteger).toBe(true);
    expect(report.gates.revoOk).toBe(true);
    expect(report.gates.revoTotalsAgree).toBe(true);
    expect(report.gates.solverEvalAgree).toBe(true);
    expect(report.gates.solverPoolOk).toBe(true);
  });
});
