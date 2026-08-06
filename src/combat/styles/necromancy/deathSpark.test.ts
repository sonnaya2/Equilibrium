import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { createCastContext } from "../../engine/simulation/simulate";
import { necroInput } from "../../test/fixtures/inputs";
import {
  applyDeathSparkOnBasic,
  DEATH_SPARK_DAMAGE_MULT,
  DEATH_SPARK_PASSIVE_ID,
  DEATH_SPARK_STACKS_TO_EMPOWER,
  clearDeathSparkStacks,
} from "./deathSpark";

describe("Death Spark pure helpers", () => {
  it("stacks 0→1→2→3→4→5 (no empower), then empower resets to 0", () => {
    expect(DEATH_SPARK_STACKS_TO_EMPOWER).toBe(5);
    expect(DEATH_SPARK_DAMAGE_MULT).toBe(2);
    expect(DEATH_SPARK_PASSIVE_ID).toBe("death-spark");

    let stacks = 0;
    const steps: { stacks: number; empower: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const r = applyDeathSparkOnBasic(stacks);
      steps.push(r);
      stacks = r.stacks;
    }
    expect(steps).toEqual([
      { stacks: 1, empower: false },
      { stacks: 2, empower: false },
      { stacks: 3, empower: false },
      { stacks: 4, empower: false },
      { stacks: 5, empower: false },
      { stacks: 0, empower: true },
      { stacks: 1, empower: false },
    ]);
  });

  it("clamps pre-cast stacks into 0..5", () => {
    expect(applyDeathSparkOnBasic(-3)).toEqual({ stacks: 1, empower: false });
    expect(applyDeathSparkOnBasic(99)).toEqual({ stacks: 0, empower: true });
  });

  it("clearDeathSparkStacks returns 0", () => {
    expect(clearDeathSparkStacks()).toBe(0);
  });
});

describe("Death Spark sim: Omni Guard stacks and empowered basic", () => {
  const omniFromSlots = activeEquipmentEffects({
    style: "necromancy",
    equipmentSlots: { mainhand: "item:omni-guard" },
  });

  const omniEffects = {
    ...omniFromSlots,
    // Guaranteed passive for mechanic tests even if catalogue lag drops passiveId.
    passiveIds: [...new Set([...omniFromSlots.passiveIds, DEATH_SPARK_PASSIVE_ID])],
  };

  it("equipment resolves death-spark from Omni Guard", () => {
    expect(omniFromSlots.passiveIds).toContain(DEATH_SPARK_PASSIVE_ID);
  });

  it("builds stacks on basic; 6th basic is double damage and resets stacks", () => {
    const ctx = createCastContext({
      ...necroInput,
      equipmentEffects: omniEffects,
    });
    const basic = ctx.byId.get("necromancy_basic")!;

    for (let i = 0; i < 5; i++) {
      const attempt = ctx.performCast(basic, ctx.firstLegalTick("necromancy_basic"), false);
      expect(attempt.ok, `cast ${i + 1}`).toBe(true);
      expect(ctx.getState().necromancy.resources.deathSparkStacks).toBe(i + 1);
    }

    // 6th basic: empower (double band) then stacks → 0
    const empowerAttempt = ctx.performCast(basic, ctx.firstLegalTick("necromancy_basic"), false);
    expect(empowerAttempt.ok).toBe(true);
    expect(ctx.getState().necromancy.resources.deathSparkStacks).toBe(0);

    const s = ctx.finish();
    expect(s.ok).toBe(true);

    const castBasics = s.casts.filter((c) => c.abilityId === "necromancy_basic");
    expect(castBasics.length).toBeGreaterThanOrEqual(6);

    // Fixture AD 1000, band 90-110 → expected 1000; empowered → 2000.
    for (const c of castBasics.slice(0, 5)) {
      expect(c.result.hits[0]!.expected).toBeCloseTo(1000, 5);
    }
    expect(castBasics[5]!.result.hits[0]!.expected).toBeCloseTo(2000, 5);
  });

  it("without death-spark passive stacks stay 0 and damage is plain", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    for (let i = 0; i < 6; i++) {
      const attempt = ctx.performCast(basic, ctx.firstLegalTick("necromancy_basic"), false);
      expect(attempt.ok, `cast ${i + 1}`).toBe(true);
      expect(ctx.getState().necromancy.resources.deathSparkStacks).toBe(0);
    }
    const s = ctx.finish();
    const castBasics = s.casts.filter((c) => c.abilityId === "necromancy_basic");
    for (const c of castBasics.slice(0, 6)) {
      expect(c.result.hits[0]!.expected).toBeCloseTo(1000, 5);
    }
  });
});
