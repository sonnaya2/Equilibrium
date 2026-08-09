import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { unitPrimordialIce } from "../../styles/melee/primordialIce";
import { baseInput } from "../../test/fixtures/inputs";
import { performCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { patchMagic, patchMelee } from "../runtime/state";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import type { ResolvedDamage } from "../resolution/types";
import { applyStatefulLandRng } from "./statefulLand";
import { simulateRevolution } from "./revolution";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import type { CombatStyle } from "../../types";

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

function infernoRuntime(style: CombatStyle, naturalInstinctUntilTick = 0) {
  const abilities =
    style === "magic"
      ? MAGIC_ABILITIES
      : style === "ranged"
        ? RANGED_ABILITIES
        : style === "necromancy"
          ? NECROMANCY_ABILITIES
          : MELEE_ABILITIES;
  const rt = createRuntime(
    {
      ...baseInput,
      abilities,
      context: { style },
      startingAdrenaline: 0,
      naturalInstinctUntilTick,
    },
    { laneIndex: 0, laneCount: 1 },
  );
  rt.state = patchMagic(rt.state, { tsunamiCritAdrenUntilTick: 50 });
  return rt;
}

function infernoEvent(style: CombatStyle, outcome: boolean): ScheduledEvent<SimulationRuntime> {
  const damage: ResolvedDamage = {
    min: 1,
    max: 1,
    expected: 1,
    critical: { mode: "expected", chance: 0.5, contribution: 0, outcome },
  };
  return {
    tick: 10,
    seq: 1,
    family: "blessing",
    abilityId: "inferno-of-zamorak",
    sourceCast: 0,
    hitIndex: 0,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    combatStyle: style,
    resourceEligible: true,
    provenance: { kind: "blessing", detail: "inferno-of-zamorak" },
    resolve: () => ({ damage }),
  };
}

describe("bounded state-changing land RNG", () => {
  it("samples nested Surge Tsunami adrenaline at source-crit times surge-crit", () => {
    const damage: ResolvedDamage = {
      min: 0,
      max: 1,
      expected: 1,
      critical: { mode: "expected", chance: 0.5, contribution: 0 },
    };
    const event: ScheduledEvent<SimulationRuntime> = {
      tick: 10,
      seq: 1,
      family: "proc",
      abilityId: "instability_lightning_surge",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      provenance: { kind: "equipment_proc", detail: "lightning_surge" },
      resolve: () => ({ damage }),
      lightningSurgeSourceCritChance: 0.5,
    };
    let total = 0;
    for (let laneIndex = 0; laneIndex < 128; laneIndex++) {
      const rt = createRuntime(
        {
          ...baseInput,
          abilities: MAGIC_ABILITIES,
          context: { style: "magic" },
          startingAdrenaline: 0,
        },
        { laneIndex, laneCount: 128 },
      );
      rt.state = patchMagic(rt.state, { tsunamiCritAdrenUntilTick: 50 });
      applyStatefulLandRng(rt, event, damage);
      total += rt.state.adrenaline;
    }

    expect(total / 128).toBe(2);
  });

  it("uses the materialized parent crit for Tsunami adrenaline", () => {
    for (const outcome of [false, true]) {
      const rt = createRuntime(
        {
          ...baseInput,
          abilities: MAGIC_ABILITIES,
          context: { style: "magic" },
          startingAdrenaline: 0,
        },
        { laneIndex: 0, laneCount: 1 },
      );
      rt.state = patchMagic(rt.state, { tsunamiCritAdrenUntilTick: 50 });
      const damage: ResolvedDamage = {
        min: 1,
        max: 1,
        expected: 1,
        critical: { mode: "expected", chance: 0.5, contribution: 0, outcome },
      };
      const event: ScheduledEvent<SimulationRuntime> = {
        tick: 10,
        seq: 1,
        family: "hit",
        abilityId: MAGIC_ABILITIES[0]!.id,
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        provenance: { kind: "player_direct" },
        resolve: () => ({ damage }),
      };
      applyStatefulLandRng(rt, event, damage);
      expect(rt.state.adrenaline).toBe(outcome ? 8 : 0);
    }
  });

  it("grants Tsunami adrenaline for a critical Magic Inferno", () => {
    const rt = infernoRuntime("magic");
    const event = infernoEvent("magic", true);

    applyStatefulLandRng(rt, event, event.resolve(rt, event.tick).damage);

    expect(rt.state.adrenaline).toBe(8);
  });

  it("does not grant Tsunami adrenaline for a noncritical Magic Inferno", () => {
    const rt = infernoRuntime("magic");
    const event = infernoEvent("magic", false);

    applyStatefulLandRng(rt, event, event.resolve(rt, event.tick).damage);

    expect(rt.state.adrenaline).toBe(0);
  });

  it.each(["melee", "ranged", "necromancy"] as const)(
    "does not grant Tsunami adrenaline for a critical %s Inferno",
    (style) => {
      const rt = infernoRuntime(style);
      const event = infernoEvent(style, true);

      applyStatefulLandRng(rt, event, event.resolve(rt, event.tick).damage);

      expect(rt.state.adrenaline).toBe(0);
    },
  );

  it("doubles the Magic Inferno Tsunami grant under Natural Instinct", () => {
    const rt = infernoRuntime("magic", 50);
    const event = infernoEvent("magic", true);

    applyStatefulLandRng(rt, event, event.resolve(rt, event.tick).damage);

    expect(rt.state.adrenaline).toBe(16);
  });

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
