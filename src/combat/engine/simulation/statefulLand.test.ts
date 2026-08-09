import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { unitPrimordialIce } from "../../styles/melee/primordialIce";
import { baseInput } from "../../test/fixtures/inputs";
import { performCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { patchMelee } from "../runtime/state";
import { simulateRevolution } from "./revolution";

const lengIds = ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"] as const;

function lengInput() {
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: [...lengIds],
    equipmentEffects: activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { mainhand: lengIds[0], offhand: lengIds[1] },
    }),
    weaponConfiguration: "dualwield" as const,
  };
}

describe("bounded state-changing land RNG", () => {
  it("samples Icy Tempest's coupled integer outcome across fixed lanes", () => {
    const input = lengInput();
    const spends: number[] = [];
    for (let laneIndex = 0; laneIndex < 128; laneIndex++) {
      const rt = createRuntime(input, { laneIndex, laneCount: 128 });
      expect(performCast(rt, rt.byId.get("attack")!, 0, false).ok).toBe(true);
      const result = performCast(rt, rt.byId.get("icy_tempest")!, rt.state.tick, false);
      if (!result.ok) throw new Error(result.error);
      spends.push(rt.casts.at(-1)!.actualSpend);
    }

    expect([...new Set(spends)].sort((left, right) => right - left)).toEqual([30, 18]);
    expect(spends.reduce((sum, spend) => sum + spend, 0) / spends.length).toBeCloseTo(28.56, 1);
  });

  it("does not consume Primordial Ice when the cast is unaffordable", () => {
    const rt = createRuntime({ ...lengInput(), startingAdrenaline: 20 });
    rt.state = patchMelee(rt.state, { primordialIce: unitPrimordialIce(5, 999) });
    expect(performCast(rt, rt.byId.get("icy_tempest")!, 0, false).ok).toBe(false);
    expect(rt.state.melee.primordialIce).toEqual(unitPrimordialIce(5, 999));
  });

  it("keeps score-only and full-analysis stochastic physics identical", () => {
    const input = lengInput();
    const bar = [
      MELEE_ABILITIES.find((ability) => ability.id === "assault")!,
      MELEE_ABILITIES.find((ability) => ability.id === "fury")!,
      MELEE_ABILITIES.find((ability) => ability.id === "icy_tempest")!,
    ];
    const full = simulateRevolution({ ...input, bar, style: "melee", durationTicks: 60 });
    const score = simulateRevolution(
      { ...input, bar, style: "melee", durationTicks: 60 },
      { detailLevel: "score-only" },
    );

    expect(full.ok && score.ok).toBe(true);
    expect(score.totalExpected).toBe(full.totalExpected);
    expect(score.rng?.probabilityMass).toBe(1);
    expect(score.rng?.residualWeight).toBe(0);
  });
});
