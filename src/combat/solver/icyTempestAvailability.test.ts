import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../shared/equipment";
import { baseInput } from "../test/fixtures/inputs";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { expectedStacksFromAtoms, unitPrimordialIce } from "../styles/melee/primordialIce";
import { resolveIcyTempest } from "../styles/melee/icyTempest";
import { createRuntime } from "../engine/runtime/runtime";
import { performCast, prepareSimulationCast } from "../engine/cast";
import { spendOf } from "../engine/cast/rules";
import { createCastContext } from "../engine/simulation/simulate";
import { planCastOutcomes } from "../engine/simulation/branch";
import { buildCandidatePool } from "./candidatePool";
import { entryByEngineId } from "../abilities/registry";
import { resolveAbilityCastAvailability } from "../shared/requirements";
import { resolveLoadoutCombat } from "../../components/combat/toResolvedCombatModel";
import { DEFAULT_LOADOUT, type Loadout } from "../../components/combat/loadout/model";
import { toHybridManualCombatModel } from "../model/simulationBase";

const lengIds = ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"] as const;

function lengEffects() {
  return activeEquipmentEffects({
    style: "melee",
    equipmentSlots: { mainhand: lengIds[0], offhand: lengIds[1] },
  });
}

function lengInput() {
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: [...lengIds],
    equipmentEffects: lengEffects(),
    weaponConfiguration: "dualwield" as const,
  };
}

function withLoadout(patch: Partial<Loadout> = {}): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
  };
}

describe("Icy Tempest solver and availability", () => {
  it("is solver-eligible and appears with Leng dual-wield", () => {
    expect(entryByEngineId("icy_tempest")?.solverEligibleDefault).toBe(true);
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "dualwield",
      equipmentIds: [...lengIds],
      passiveIds: ["leng-endless-frost", "leng-boundless-chill"],
    });
    expect(pool.ids).toContain("icy_tempest");
  });

  it("hybrid loadout preserves weapon shape and Leng passives", () => {
    const { model } = resolveLoadoutCombat(
      withLoadout({
        equipmentSlots: {
          ...DEFAULT_LOADOUT.equipmentSlots,
          mainhand: lengIds[0],
          offhand: lengIds[1],
        },
      }),
      { now: Date.parse("2026-04-01T00:00:00Z") },
    );
    const hybrid = toHybridManualCombatModel(model, {
      base: 1500,
      level: 99,
      accuracy: 1,
      critChance: 0,
    });
    expect(hybrid.weaponConfiguration).toBe("dualwield");
    expect(hybrid.equipmentEffects.passiveIds).toEqual(
      expect.arrayContaining(["leng-endless-frost", "leng-boundless-chill"]),
    );
  });

  it("pre-cast advance keeps the exact mixed state and expected spend", () => {
    const rt = createRuntime(lengInput());
    const attack = rt.byId.get("attack")!;
    expect(performCast(rt, attack, 0, false).ok).toBe(true);
    expect(expectedStacksFromAtoms(rt.state.melee.primordialIce.atoms)).toBeCloseTo(0.12, 12);
    const resolved = resolveIcyTempest(rt.state.melee.primordialIce, rt.state.tick, false);
    expect(resolved.expectedSpend).toBeCloseTo(28.56, 12);
  });

  it("failed requirement does not consume the atom state", () => {
    const rt = createRuntime({ ...lengInput(), startingAdrenaline: 20 });
    rt.state = {
      ...rt.state,
      melee: { ...rt.state.melee, primordialIce: unitPrimordialIce(5, 999) },
    };
    const tempest = rt.byId.get("icy_tempest")!;
    expect(performCast(rt, tempest, 0, false).ok).toBe(false);
    expect(rt.state.melee.primordialIce.atoms).toEqual([
      { weight: 1, stacks: 5, stacksExpireAtTick: 999, frostbladesExpireAtTick: 0 },
    ]);
  });

  it("branched manual planning retains coupled integer outcomes", () => {
    const input = lengInput();
    const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
    const tempest = MELEE_ABILITIES.find((ability) => ability.id === "icy_tempest")!;
    const ctx = createCastContext(input);
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    const rt = createRuntime(input);
    rt.state = structuredClone(ctx.getState());
    const plans = planCastOutcomes({ weight: 1, rt }, tempest, rt.state.tick, false);
    expect(
      [...new Set(plans.plans.map((plan) => plan.prepared.spend))].sort((a, b) => b - a),
    ).toEqual([30, 18, 6]);
    expect(plans.plans.every((plan) => Number.isInteger(plan.prepared.spend))).toBe(true);
    const bySpend = new Map(plans.plans.map((plan) => [plan.prepared.spend, plan.prepared]));
    expect(bySpend.get(30)!.working.hits[0]!.band).toEqual({ minPct: 115, maxPct: 135 });
    expect(bySpend.get(18)!.working.hits[0]!.band).toEqual({ minPct: 133, maxPct: 157 });
    expect(bySpend.get(6)!.working.hits[0]!.band).toEqual({ minPct: 151, maxPct: 179 });
    expect(plans.plans.reduce((sum, plan) => sum + plan.weight, 0)).toBeCloseTo(1, 12);
    expect(
      plans.plans.reduce((sum, plan) => sum + plan.weight * plan.prepared.spend, 0),
    ).toBeCloseTo(28.56, 12);
    expect(ctx.performCast(tempest, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.finish().rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
  });

  it("single-runtime helper refuses a mixed spend instead of picking a representative arm", () => {
    const rt = createRuntime(lengInput());
    const attack = rt.byId.get("attack")!;
    expect(performCast(rt, attack, 0, false).ok).toBe(true);
    const tempest = rt.byId.get("icy_tempest")!;
    expect(() => spendOf(rt.state, tempest, rt.state.tick)).toThrow("resolved outcome");
    const prepared = prepareSimulationCast(rt, tempest, rt.state.tick);
    if (prepared.ok) throw new Error("mixed Icy Tempest unexpectedly prepared on one runtime");
    expect(prepared.error).toContain("branched cast context");
  });

  it("single-runtime helper refuses equal-hit arms with different future Frostblades state", () => {
    const rt = createRuntime(lengInput());
    rt.state = {
      ...rt.state,
      melee: {
        ...rt.state.melee,
        primordialIce: {
          atoms: [
            { weight: 0.5, stacks: 2, stacksExpireAtTick: 999, frostbladesExpireAtTick: 0 },
            { weight: 0.5, stacks: 2, stacksExpireAtTick: 999, frostbladesExpireAtTick: 200 },
          ],
        },
      },
    };
    const tempest = rt.byId.get("icy_tempest")!;
    expect(performCast(rt, tempest, 0, false)).toEqual({
      ok: false,
      error: "Icy Tempest mixed stack state requires a branched cast context",
    });
  });

  it("native and EoF special access remain separate from passive ownership", () => {
    const tempest = MELEE_ABILITIES.find((ability) => ability.id === "icy_tempest")!;
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "dualwield",
        equipmentIds: [],
        passiveIds: ["leng-endless-frost"],
      }).available,
    ).toBe(false);
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "twohand",
        equipmentIds: ["item:essence-of-finality"],
      }).available,
    ).toBe(true);
  });
});
