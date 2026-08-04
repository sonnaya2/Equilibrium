import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { buildCandidatePool } from "./candidatePool";
import { entryByEngineId } from "../abilities/registry";
import { toHybridManualCombatModel } from "../model/simulationBase";
import { resolveLoadoutCombat } from "../../components/combat/toResolvedCombatModel";
import { DEFAULT_LOADOUT, type Loadout } from "../../components/combat/loadout/model";
import { createRuntime } from "../engine/runtime/runtime";
import { performCast, prepareSimulationCast, commitCast } from "../engine/cast";
import { prepareCast } from "../engine/cast/prepare";
import { scheduleCastEvents as schedule } from "../engine/cast/schedule";
import { advanceTo } from "../engine/runtime/clock";
import { snapshotRuntime } from "../engine/simulation/branchCore";
import { baseInput } from "../test/fixtures/inputs";
import { activeEquipmentEffects } from "../shared/equipment";
import { resolveIcyTempest } from "../styles/melee/icyTempest";
import { LENG_ENDLESS_FROST_CHANCE, LENG_BOUNDLESS_CHILL_CHANCE } from "../styles/melee/effects";
import { createCastContext } from "../engine/simulation/simulate";
import { planCastOutcomes } from "../engine/simulation/branch";
import { resolveAbilityCastAvailability } from "../shared/requirements";
import { patchMelee } from "../engine/runtime/state";

const lengIds = ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"] as const;
const NOW = Date.parse("2026-04-01T00:00:00Z");

function lengEffects() {
  return activeEquipmentEffects({
    style: "melee",
    equipmentSlots: {
      mainhand: "item:dark-shard-of-leng",
      offhand: "item:dark-sliver-of-leng",
    },
  });
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

describe("Icy Tempest solver + hybrid availability", () => {
  it("is solver-eligible by default (primary-target form fully modeled)", () => {
    const entry = entryByEngineId("icy_tempest");
    expect(entry?.solverEligibleDefault).toBe(true);
    expect(entry?.support.status).toBe("full");
  });

  it("appears in default candidate pool with Leng mainhand + dualwield", () => {
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "dualwield",
      equipmentIds: [...lengIds],
      passiveIds: ["leng-endless-frost", "leng-boundless-chill"],
    });
    expect(pool.ids).toContain("icy_tempest");
  });

  it("hybrid Use Loadout off preserves weapon shape and Leng capability", () => {
    const { model: scaffold } = resolveLoadoutCombat(
      withLoadout({
        equipmentSlots: {
          ...DEFAULT_LOADOUT.equipmentSlots,
          mainhand: "item:dark-shard-of-leng",
          offhand: "item:dark-sliver-of-leng",
        },
      }),
      { now: NOW },
    );
    const hybrid = toHybridManualCombatModel(scaffold, {
      base: 1500,
      level: 99,
      accuracy: 1,
      critChance: 0,
    });
    expect(hybrid.weaponConfiguration).toBe(scaffold.weaponConfiguration);
    expect(hybrid.weaponConfiguration).not.toBe("twohand");
    expect(hybrid.equipmentIds).toEqual([...scaffold.equipmentIds]);
    expect(hybrid.equipmentEffects.passiveIds).toEqual(
      expect.arrayContaining(["leng-endless-frost", "leng-boundless-chill"]),
    );
    expect(hybrid.base).toBe(1500);
  });
});

describe("pre-cast advance applies Leng mass", () => {
  it("prepareSimulationCast lands pending hits into Primordial Ice mass", () => {
    const effects = lengEffects();
    const rt = createRuntime({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      equipmentIds: [...lengIds],
      equipmentEffects: effects,
      weaponConfiguration: "dualwield",
    });
    const attack = rt.byId.get("attack")!;
    const prepared = prepareCast(rt, attack, 0);
    schedule(rt, prepared, false);
    expect(rt.queue.length).toBeGreaterThan(0);

    const plain = snapshotRuntime(rt);
    advanceTo(plain, plain.queue.maxTick());
    const plainE = plain.state.melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
    expect(plainE).toBe(0);

    const tempest = rt.byId.get("icy_tempest")!;
    const prep = prepareSimulationCast(rt, tempest, rt.queue.maxTick());
    expect(prep.ok).toBe(true);
    const e = rt.state.melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
    expect(e).toBeCloseTo(LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE, 10);
    if (prep.ok) {
      const resolved = resolveIcyTempest(rt.state.melee.primordialIce, prep.prepared.candidate, false);
      expect(resolved.expectedSpend).toBeCloseTo(28.56, 1);
      expect(resolved.expectedSpend).toBeLessThan(30);
    }
  });
});

describe("Icy Tempest consumption boundaries", () => {
  it("failed requirement cast does not consume stacks", () => {
    const effects = lengEffects();
    const rt = createRuntime({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 20,
      equipmentIds: [...lengIds],
      equipmentEffects: effects,
      weaponConfiguration: "dualwield",
    });
    const mass = Array(11).fill(0);
    mass[5] = 1;
    rt.state = patchMelee(rt.state, { primordialIce: { stackMass: mass, expiresAtTick: 999 } });
    const tempest = rt.byId.get("icy_tempest")!;
    expect(performCast(rt, tempest, 0, false).ok).toBe(false);
    expect(rt.state.melee.primordialIce.stackMass[5]).toBe(1);
    expect(rt.state.adrenaline).toBe(20);
  });
});

describe("Manual createCastContext Icy Tempest spend forks", () => {
  it("after one dual-Leng land, performCast forks integer spends (never fractional adren 28.56)", () => {
    const effects = lengEffects();
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

    const ctx = createCastContext(input);
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);

    // Use createCastContext state after attack
    const afterStacks = ctx.getState().melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
    expect(afterStacks).toBeCloseTo(0.12, 10);

    // Build a runtime snapshot of post-attack mass by cloning empty runtime and patching
    const rt2 = createRuntime(input);
    rt2.state = {
      ...rt2.state,
      melee: { ...ctx.getState().melee },
      tick: ctx.getState().tick,
      adrenaline: ctx.getState().adrenaline,
    };
    const tPlans = planCastOutcomes({ weight: 1, rt: rt2 }, tempest, rt2.state.tick, false);
    const spends = [...new Set(tPlans.plans.map((p) => p.prepared.spend))].sort((a, b) => b - a);
    expect(spends).toEqual([30, 18, 6]);
    for (const p of tPlans.plans) {
      expect(Number.isInteger(p.prepared.spend)).toBe(true);
    }
    const eSpend = tPlans.plans.reduce((s, p) => s + p.weight * p.prepared.spend, 0);
    expect(eSpend).toBeCloseTo(28.56, 1);

    expect(ctx.performCast(tempest, ctx.getState().tick, false).ok).toBe(true);
    const adren = ctx.getState().adrenaline;
    // Representative heaviest arm uses integer spend (30 for miss mass 0.882)
    expect(Math.abs(adren - Math.round(adren))).toBeLessThan(1e-9);
    expect(adren).toBe(70); // 100 - 30
    expect(adren).not.toBeCloseTo(71.44, 1);

    const summary = ctx.finish();
    expect(summary.ok).toBe(true);
    expect(summary.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-9);
  });
});

describe("Single-runtime performCast Icy Tempest spend (engine/cast)", () => {
  it("after dual-Leng land, performCast commits heaviest integer spend (not E[spend]=28.56)", () => {
    const effects = lengEffects();
    const mk = () =>
      createRuntime({
        ...baseInput,
        abilities: MELEE_ABILITIES,
        startingAdrenaline: 100,
        equipmentIds: [...lengIds],
        equipmentEffects: effects,
        weaponConfiguration: "dualwield",
      });
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;

    const rt = mk();
    expect(performCast(rt, attack, 0, false).ok).toBe(true);
    const e = rt.state.melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
    expect(e).toBeCloseTo(0.12, 10);

    const before = rt.state.adrenaline;
    expect(performCast(rt, tempest, rt.state.tick, false).ok).toBe(true);
    const after = rt.state.adrenaline;
    const spent = before - after;
    expect(Math.abs(spent - Math.round(spent))).toBeLessThan(1e-9);
    expect(spent).toBe(30);
    expect(after).toBe(before - 30);
    expect(after).not.toBeCloseTo(before - 28.56, 1);

    // prepareSimulationCast + commitCast: same heaviest integer spend
    const rt2 = mk();
    expect(performCast(rt2, attack, 0, false).ok).toBe(true);
    const prep = prepareSimulationCast(rt2, tempest, rt2.state.tick);
    expect(prep.ok).toBe(true);
    if (prep.ok) {
      expect(Number.isInteger(prep.prepared.spend)).toBe(true);
      expect(prep.prepared.spend).toBe(30);
      expect(prep.prepared.spend).not.toBeCloseTo(28.56, 1);
      const adrenBefore = rt2.state.adrenaline;
      commitCast(rt2, prep.prepared, false);
      expect(rt2.state.adrenaline).toBe(adrenBefore - 30);
    }
  });
});

describe("Icy Tempest special-attack access", () => {
  it("is a weapon special requiring special access", () => {
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    expect(tempest.weaponSpecial).toBe(true);
    expect(tempest.requiresSpecialAccess).toBe(true);
  });

  it("native access: Dark Shard of Leng grants cast; passive alone does not", () => {
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "dualwield",
        equipmentIds: [],
        passiveIds: ["leng-endless-frost"],
      }).available,
    ).toBe(false);
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "dualwield",
        equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
        passiveIds: ["leng-endless-frost", "leng-boundless-chill"],
      }).available,
    ).toBe(true);
  });

  it("EoF access: Essence of Finality enables cast without Leng weapon", () => {
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "twohand",
        equipmentIds: ["item:essence-of-finality"],
      }).available,
    ).toBe(true);
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "twohand",
        equipmentIds: [],
      }).available,
    ).toBe(false);
  });
});
