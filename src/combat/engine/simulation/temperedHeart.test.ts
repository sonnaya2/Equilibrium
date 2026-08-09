import { describe, expect, it } from "vitest";
import { performCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { advanceTo } from "../runtime/clock";
import { patchMelee } from "../runtime/state";
import { rotationOf, type CastRng } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { simulateRevolution } from "./revolution";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { activeEquipmentEffects } from "../../shared/equipment";
import { resolveLeagueRules, temperedHeartAdrenalineGain } from "../../league/ruleset";
import { emptyModifierSources } from "../../model";
import {
  serializeLeague,
  buildRevolutionInput,
  reviveRevolutionBase,
} from "../../solver/worker/revive";
import type { SerializableRevolutionSimBase } from "../../solver/worker/serializable";
import { toSerializableUiRunSummary } from "../../solver/worker/uiRunTypes";
import { simulateRevolutionForUi } from "../../solver/uiRunCore";

const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
const berserk = MELEE_ABILITIES.find((ability) => ability.id === "berserk")!;
const meteorStrike = MELEE_ABILITIES.find((ability) => ability.id === "meteor_strike")!;

const temperedHeart = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Balance", "Balance", "Balance", "Balance", "Order"],
});

const temperedHeartAndJunkie = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Chaos", "Balance", "Balance", "Balance", "Balance", "Order"],
});

function firstCast(options: Parameters<typeof createCastContext>[0], forcedRng?: CastRng) {
  const context = createCastContext(options);
  const result = context.performCast(attack, 0, false, forcedRng);
  expect(result.ok).toBe(true);
  const cast = context.finish().casts[0];
  if (!cast) throw new Error("expected one cast");
  return cast;
}

function clockRuntime(league: typeof temperedHeart) {
  const rt = createRuntime({
    ...baseInput,
    league,
    context: { style: "melee", ruleset: "equilibrium" },
    startingAdrenaline: 0,
  });
  rt.state = patchMelee(rt.state, { meteorStrikeUntilTick: 10 });
  rt.state = { ...rt.state, vestmentsAdrenalineUntilTick: 10 };
  return rt;
}

function summarySlice(summary: ReturnType<typeof simulateRevolution>) {
  return {
    totalExpected: summary.totalExpected,
    damageByTick: summary.damageByTick,
    casts: summary.casts.map((cast) => ({
      tick: cast.tick,
      abilityId: cast.abilityId,
      adrenalineBefore: cast.adrenalineBefore,
      adrenalineAfterResources: cast.adrenalineAfterResources,
      adrenalineAfter: cast.adrenalineAfter,
    })),
  };
}

describe("Tempered Heart timed adrenaline", () => {
  it("uses pulses at ticks 2, 4, 6, 8 and never tick 0", () => {
    const pulseByTick = Array.from({ length: 9 }, (_, tick) =>
      tick === 0
        ? temperedHeartAdrenalineGain(temperedHeart, 0, 0)
        : temperedHeartAdrenalineGain(temperedHeart, tick - 1, tick),
    );
    expect(pulseByTick).toEqual([0, 0, 6, 0, 6, 0, 6, 0, 6]);
    expect(temperedHeartAdrenalineGain(temperedHeart, 0, 3)).toBe(6);
    expect(temperedHeartAdrenalineGain(temperedHeart, 3, 6)).toBe(12);
    expect(temperedHeartAdrenalineGain(temperedHeart, 6, 9)).toBe(6);
  });

  it("keeps each pulse at six across ability-generation modifiers", () => {
    const cases = [
      { name: "Adrenaline Junkie", league: temperedHeartAndJunkie, adrenaline: undefined },
      { name: "Invigorating", league: temperedHeart, adrenaline: { basicGainMultiplier: 1.2 } },
      {
        name: "Fury of the Small",
        league: temperedHeart,
        adrenaline: { basicAdrenalineFlatBonus: 1 },
      },
      { name: "Impatient", league: temperedHeart, adrenaline: { impatientRank: 4 } },
    ] as const;

    for (const testCase of cases) {
      const cast = firstCast(
        {
          ...baseInput,
          league: testCase.league,
          context: { style: "melee", ruleset: "equilibrium" },
          adrenaline: testCase.adrenaline,
        },
        testCase.name === "Impatient" ? { impatient: true } : undefined,
      );
      expect(cast.adrenalineAfter - cast.adrenalineAfterResources!, testCase.name).toBeCloseTo(
        6,
        10,
      );
    }
  });

  it("stays six per pulse while Meteor Strike and Vestments clocks are active", () => {
    const withHeart = clockRuntime(temperedHeart);
    const withoutHeart = clockRuntime(resolveLeagueRules({ ruleset: "base" }));
    advanceTo(withHeart, 2);
    advanceTo(withoutHeart, 2);
    expect(withHeart.state.adrenaline - withoutHeart.state.adrenaline).toBe(6);
    expect(withHeart.state.adrenaline).toBe(16);
    expect(withoutHeart.state.adrenaline).toBe(10);
  });

  it("uses the cap as the only reason a pulse is short", () => {
    const context = createCastContext({
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee", ruleset: "equilibrium" },
      startingAdrenaline: 122,
    });
    context.advanceTo(2);
    expect(context.getState().adrenalineCap).toBe(125);
    expect(context.getState().adrenaline).toBe(125);

    const full = createCastContext({
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee", ruleset: "equilibrium" },
      startingAdrenaline: 119,
    });
    full.advanceTo(2);
    expect(full.getState().adrenaline).toBe(125);
  });

  it("clips all timed grants before the exclusive horizon on a cast starting at t99", () => {
    const clockOnly = createRuntime({
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee", ruleset: "equilibrium" },
      startingAdrenaline: 0,
      horizonTicks: 100,
    });
    clockOnly.state = { ...clockOnly.state, tick: 99, adrenaline: 0 };
    advanceTo(clockOnly, 102);
    expect(clockOnly.state.adrenaline).toBe(0);

    const rt = createRuntime({
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee", ruleset: "equilibrium" },
      startingAdrenaline: 0,
      horizonTicks: 100,
    });
    rt.state = { ...rt.state, tick: 99, adrenaline: 0 };
    expect(performCast(rt, attack, 99, false).ok).toBe(true);
    const cast = rt.casts[0]!;
    expect(cast.adrenalineAfterResources).toBe(9);
    expect(cast.adrenalineAfter).toBe(9);
    expect(rt.state.adrenaline).toBe(9);
  });

  it("agrees across manual, Revolution, score-only, full-analysis, and worker serialization", () => {
    const manual = simulate({
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack", "attack", "attack", "attack", "attack"),
    });
    const revoInput = {
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee" as const, ruleset: "equilibrium" as const },
      bar: [attack],
      style: "melee" as const,
      durationTicks: 15,
    };
    const revolution = simulateRevolution(revoInput, { detailLevel: "full-analysis" });
    const scoreOnly = simulateRevolution(revoInput, { detailLevel: "score-only" });
    const fullAnalysis = simulateRevolutionForUi(revoInput).summary;

    const serialBase: SerializableRevolutionSimBase = {
      base: baseInput.base,
      level: baseInput.level,
      accuracy: baseInput.accuracy,
      crit: baseInput.crit,
      equipmentEffects: activeEquipmentEffects({ style: "melee", equipmentIds: [] }),
      league: serializeLeague(temperedHeart),
      context: { style: "melee", ruleset: "equilibrium" },
      cap: { cap: 30_000, bypass: false },
      startingAdrenaline: 0,
      equipmentIds: [],
      weaponConfiguration: "dualwield",
      modifierSources: emptyModifierSources(),
    };
    const workerBase = reviveRevolutionBase(structuredClone(serialBase));
    const workerInput = buildRevolutionInput(structuredClone(serialBase), {
      ...workerBase,
      bar: [attack],
      style: "melee",
      durationTicks: 15,
      abilities: MELEE_ABILITIES,
    });
    const worker = simulateRevolution(workerInput, { detailLevel: "full-analysis" });
    const wireWorker = structuredClone(toSerializableUiRunSummary(worker));

    expect(manual.ok && revolution.ok && scoreOnly.ok && fullAnalysis.ok && worker.ok).toBe(true);
    expect(summarySlice(manual as ReturnType<typeof simulateRevolution>)).toEqual(
      summarySlice(revolution),
    );
    expect(summarySlice(fullAnalysis)).toEqual(summarySlice(revolution));
    expect(summarySlice(worker)).toEqual(summarySlice(revolution));
    expect(scoreOnly.totalExpected).toBe(revolution.totalExpected);
    expect(scoreOnly.damageByTick).toEqual(revolution.damageByTick);
    expect(summarySlice(wireWorker)).toEqual(summarySlice(revolution));
  });

  it("does not make Meteor Strike or Vestments look like ability gains", () => {
    const meteorContext = createCastContext({
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee", ruleset: "equilibrium" },
      startingAdrenaline: 100,
    });
    expect(meteorContext.performCast(meteorStrike, 0, false).ok).toBe(true);
    const meteorAttack = meteorContext.performCast(attack, meteorContext.getState().tick, false);
    expect(meteorAttack.ok).toBe(true);
    const meteorCast = meteorContext.finish().casts.find((cast) => cast.abilityId === "attack")!;
    expect(meteorCast.adrenalineAfter - meteorCast.adrenalineAfterResources!).toBe(25.5);

    const vestmentsContext = createCastContext({
      ...baseInput,
      league: temperedHeart,
      context: { style: "melee", ruleset: "equilibrium" },
      startingAdrenaline: 100,
      equipmentEffects: activeEquipmentEffects({
        style: "melee",
        equipmentIds: ["item:vestments-of-havoc-hood", "item:vestments-of-havoc-robe-top"],
      }),
    });
    expect(vestmentsContext.performCast(berserk, 0, false).ok).toBe(true);
    expect(vestmentsContext.performCast(attack, vestmentsContext.getState().tick, false).ok).toBe(
      true,
    );
    const vestmentsCast = vestmentsContext
      .finish()
      .casts.find((cast) => cast.abilityId === "attack")!;
    expect(vestmentsCast.adrenalineAfter - vestmentsCast.adrenalineAfterResources!).toBe(13.5);
  });
});
