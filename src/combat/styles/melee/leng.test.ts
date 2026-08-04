import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { createCastContext } from "../../engine/simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "./abilities";
import {
  FROSTBLADES_AD_FRACTION,
  FROSTBLADES_DURATION_SECONDS,
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  icyTempestHits,
  icyTempestSpend,
  PRIMORDIAL_ICE_CAP,
} from "./effects";
import {
  FROSTBLADES_DURATION_TICKS,
  lengLandOutcomes,
  lengLandTableFor,
  materializeLengLandOutcomes,
} from "./lengRng";
import { createRuntime } from "../../engine/runtime/runtime";
import { performCast } from "../../engine/cast";
import { patchMelee } from "../../engine/runtime/state";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { castOutcomes } from "../../engine/simulation/branch";
import { secondsToTicks } from "../../core/ticks";

function lengEffects() {
  return activeEquipmentEffects({
    style: "melee",
    equipmentSlots: {
      mainhand: "item:dark-shard-of-leng",
      offhand: "item:dark-sliver-of-leng",
    },
  });
}

function lengRuntime(
  extra: {
    frostbladesUntilTick?: number;
    frostbladesOpenMass?: number;
    primordialIceStacks?: number;
    primordialIce?: { stackMass: number[]; expiresAtTick: number };
  } = {},
) {
  const effects = lengEffects();
  const rt = createRuntime({
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects: effects,
    weaponConfiguration: "dualwield",
  });
  const ice =
    extra.primordialIce ??
    (extra.primordialIceStacks != null
      ? {
          stackMass: (() => {
            const a = Array(11).fill(0);
            a[extra.primordialIceStacks!] = 1;
            return a;
          })(),
          expiresAtTick: 0,
        }
      : null);
  if (extra.frostbladesUntilTick != null || ice != null) {
    rt.state = patchMelee(rt.state, {
      ...(extra.frostbladesUntilTick != null
        ? {
            frostbladesUntilTick: extra.frostbladesUntilTick,
            frostbladesOpenMass: extra.frostbladesOpenMass ?? 1,
          }
        : {}),
      ...(ice != null ? { primordialIce: ice } : {}),
    });
  }
  return rt;
}

describe("Leng stack math", () => {
  it("Icy Tempest spend floors at 0 after 3 stacks", () => {
    expect(icyTempestSpend(0)).toBe(30);
    expect(icyTempestSpend(2)).toBe(6);
    expect(icyTempestSpend(3)).toBe(0);
    expect(icyTempestSpend(10)).toBe(0);
  });

  it("Icy Tempest hits scale with stacks (ST primary + secondary)", () => {
    expect(icyTempestHits(0)).toEqual([
      { band: { minPct: 115, maxPct: 135 } },
      { band: { minPct: 175, maxPct: 205 } },
    ]);
    expect(icyTempestHits(1)).toEqual([
      { band: { minPct: 133, maxPct: 157 } },
      { band: { minPct: 193, maxPct: 227 } },
    ]);
    expect(icyTempestHits(PRIMORDIAL_ICE_CAP)[0]!.band.minPct).toBe(115 + 18 * 10);
  });
});

describe("lengLandOutcomes (pure probability)", () => {
  it("enumerates independent EF 0.1 and BC 0.02 arms", () => {
    const out = lengLandOutcomes(true, true, 0, 0, 5);
    const byStacks = new Map<number, number>();
    for (const o of out) {
      byStacks.set(o.stacks, (byStacks.get(o.stacks) ?? 0) + o.weight);
    }
    // P(+0)=0.9*0.98, P(+1)=0.1*0.98+0.9*0.02, P(+2)=0.1*0.02
    expect(byStacks.get(0)).toBeCloseTo(0.9 * 0.98, 12);
    expect(byStacks.get(1)).toBeCloseTo(0.1 * 0.98 + 0.9 * 0.02, 12);
    expect(byStacks.get(2)).toBeCloseTo(0.1 * 0.02, 12);
    expect(out.reduce((s, o) => s + o.weight, 0)).toBeCloseTo(1, 12);
  });

  it("composes both procs and opens Frostblades only on Chill", () => {
    const tick = 10;
    const frostOpen = tick + secondsToTicks(FROSTBLADES_DURATION_SECONDS);
    const out = lengLandOutcomes(true, true, 0, 0, tick);
    const chillMass = out
      .filter((o) => o.frostUntil === frostOpen)
      .reduce((s, o) => s + o.weight, 0);
    expect(chillMass).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 12);
    const noChill = out.filter((o) => o.frostUntil === 0);
    expect(noChill.reduce((s, o) => s + o.weight, 0)).toBeCloseTo(
      1 - LENG_BOUNDLESS_CHILL_CHANCE,
      12,
    );
  });

  it("caps stacks at PRIMORDIAL_ICE_CAP", () => {
    const out = lengLandOutcomes(true, true, PRIMORDIAL_ICE_CAP, 0, 0);
    expect(out.every((o) => o.stacks === PRIMORDIAL_ICE_CAP)).toBe(true);
    // At cap, EF is a no-op on stacks; only Chill still forks frost window.
    expect(out).toHaveLength(2);
  });

  it("EF-only uses LENG_ENDLESS_FROST_CHANCE", () => {
    const out = lengLandOutcomes(true, false, 0, 0, 0);
    expect(out).toHaveLength(2);
    const proc = out.find((o) => o.stacks === 1)!;
    const miss = out.find((o) => o.stacks === 0)!;
    expect(proc.weight).toBeCloseTo(LENG_ENDLESS_FROST_CHANCE, 12);
    expect(miss.weight).toBeCloseTo(1 - LENG_ENDLESS_FROST_CHANCE, 12);
    expect(proc.frostUntil).toBe(0);
  });
});


describe("compiled Leng land table (parity)", () => {
  it("materialize matches lengLandOutcomes for all stacks and frost windows", () => {
    const table = lengLandTableFor(true, true)!;
    expect(table).not.toBeNull();
    for (let stacks = 0; stacks <= PRIMORDIAL_ICE_CAP; stacks++) {
      for (const frostUntil of [0, 5, 100]) {
        for (const tick of [0, 7, 20]) {
          const direct = lengLandOutcomes(true, true, stacks, frostUntil, tick);
          const fromTable = materializeLengLandOutcomes(table, stacks, frostUntil, tick);
          const key = (o: { stacks: number; frostUntil: number }) => `${o.stacks}|${o.frostUntil}`;
          const a = new Map(direct.map((o) => [key(o), o.weight]));
          const b = new Map(fromTable.map((o) => [key(o), o.weight]));
          expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
          for (const [k, w] of a) expect(b.get(k)).toBeCloseTo(w, 12);
          expect(fromTable.reduce((sum, o) => sum + o.weight, 0)).toBeCloseTo(1, 12);
        }
      }
    }
  });

  it("collapses chill arms when frostUntil already equals this land frostOpen", () => {
    const tick = 4;
    const frostOpen = tick + FROSTBLADES_DURATION_TICKS;
    const out = lengLandOutcomes(true, true, 0, frostOpen, tick);
    expect(out.every((o) => o.frostUntil === frostOpen)).toBe(true);
    const byStacks = new Map<number, number>();
    for (const o of out) byStacks.set(o.stacks, (byStacks.get(o.stacks) ?? 0) + o.weight);
    expect(byStacks.get(0)).toBeCloseTo(0.9 * 0.98, 12);
    expect(byStacks.get(1)).toBeCloseTo(0.1 * 0.98 + 0.9 * 0.02, 12);
    expect(byStacks.get(2)).toBeCloseTo(0.1 * 0.02, 12);
    expect(out.reduce((sum, o) => sum + o.weight, 0)).toBeCloseTo(1, 12);
  });

  it("createRuntime caches lengLandTable once for dual Leng equipment", () => {
    const rt = lengRuntime();
    expect(rt.lengLandTable).not.toBeNull();
    expect(rt.lengLandTable!.hasEndlessFrost).toBe(true);
    expect(rt.lengLandTable!.hasBoundlessChill).toBe(true);
    expect(rt.lengLandTable).toBe(lengLandTableFor(true, true));
  });
});

describe("Leng equipment derivation", () => {
  it("Shard + Sliver grant both passives without duplicates", () => {
    const effects = lengEffects();
    expect(effects.passiveIds).toEqual(
      expect.arrayContaining(["leng-endless-frost", "leng-boundless-chill"]),
    );
    expect(new Set(effects.passiveIds).size).toBe(effects.passiveIds.length);
  });
});

describe("Frostblades and Icy Tempest sim", () => {
  it("Frostblades adds 24% AD flat while the window is open", () => {
    const rt = lengRuntime({ frostbladesUntilTick: 100 });
    const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
    expect(performCast(rt, assault, 0, false).ok).toBe(true);
    const hits = rt.events.filter((e) => e.abilityId === "assault" && !e.attached);
    expect(hits.length).toBeGreaterThan(0);
    const flat = Math.floor(1000 * FROSTBLADES_AD_FRACTION);
    // Assault hit bands are 130-150 without frostblades; min rises by flat.
    expect(hits[0]!.damage.min).toBeGreaterThanOrEqual(1300 + flat);
  });

  it("Icy Tempest spends stacks and scales hits", () => {
    const rt = lengRuntime({ primordialIce: { stackMass: (() => { const a = Array(11).fill(0); a[3] = 1; return a; })(), expiresAtTick: 0 } });
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    expect(performCast(rt, tempest, 0, false).ok).toBe(true);
    // Cast-start spend clears stacks; single-path commitCast does not fold land EV.
    // Consume runs at cast start; Leng-eligible tempest hits may rebuild mass afterward.
    const eAfter = rt.state.melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
    expect(eAfter).toBeGreaterThanOrEqual(0);
    expect(eAfter).toBeLessThan(3); // consumed 3 then at most ~2 hit EV
    expect(rt.state.adrenaline).toBe(100); // free spend at 3 stacks
    const hits = rt.events.filter((e) => e.abilityId === "icy_tempest" && !e.attached);
    expect(hits).toHaveLength(2);
    // 3 stacks: primary 169-201% -> mid 1850 on base 1000
    expect(hits[0]!.damage.expected).toBeCloseTo((1690 + 2010) / 2, 0);
  });

  it("Icy Tempest is locked without Leng MH special or EoF", () => {
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    const ctx = createCastContext({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
    });
    expect(ctx.performCast(tempest, 0, false).ok).toBe(false);
  });

  it("manual rotation can cast Icy Tempest with Leng MH special weapon", () => {
    const effects = lengEffects();
    const s = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      equipmentIds: ["item:dark-shard-of-leng"],
      equipmentEffects: effects,
      weaponConfiguration: "dualwield",
      rotation: rotationOf("icy_tempest"),
    });
    expect(s.ok).toBe(true);
  });
});

describe("Leng land probability branching", () => {
  function expectedStacks(branches: { weight: number; rt: { state: { melee: { primordialIce: { stackMass: readonly number[] } } } } }[]) {
    const mass = branches.reduce((s, b) => s + b.weight, 0);
    return (
      branches.reduce(
        (s, b) =>
          s +
          b.weight *
            b.rt.state.melee.primordialIce.stackMass.reduce((ss, w, i) => ss + w * i, 0),
        0,
      ) / mass
    );
  }

  function frostOpenMass(branches: { weight: number; rt: { state: { melee: { frostbladesOpenMass: number; frostbladesUntilTick: number } } } }[]) {
    const mass = branches.reduce((s, b) => s + b.weight, 0);
    return (
      branches.reduce((s, b) => {
        const open =
          b.rt.state.melee.frostbladesUntilTick > 0
            ? (b.rt.state.melee.frostbladesOpenMass ?? 1)
            : 0;
        return s + b.weight * open;
      }, 0) / mass
    );
  }

  function lengCtxInput() {
    return {
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
      equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"] as const,
      equipmentEffects: lengEffects(),
      weaponConfiguration: "dualwield" as const,
    };
  }

  it("performCast lands Leng mass on the single spine (compact distribution)", () => {
    const rt = lengRuntime();
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    expect(performCast(rt, attack, 0, false).ok).toBe(true);
    const e = rt.state.melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
    expect(e).toBeCloseTo(LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE, 10);
    expect(rt.state.melee.frostbladesOpenMass).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
  });

  it("createCastContext dual Leng: stack EV on spine after attack", () => {
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const ctx = createCastContext(lengCtxInput());
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    const e = ctx.getState().melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0);
    expect(e).toBeCloseTo(0.12, 10);
    const s = ctx.finish();
    expect(s.ok).toBe(true);
  });

  it("createCastContext dual Leng: attack then Icy Tempest does not floor E[stacks]", () => {
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    const ctx = createCastContext(lengCtxInput());
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    expect(ctx.performCast(tempest, ctx.getState().tick, false).ok).toBe(true);
    const s = ctx.finish();
    expect(s.ok).toBe(true);

    const land = lengLandOutcomes(true, true, 0, 0, 0);
    const mid = (minPct: number, maxPct: number) => ((minPct + maxPct) / 2) * 10;
    let eTempest = 0;
    for (const o of land) {
      const hits = icyTempestHits(o.stacks);
      eTempest +=
        o.weight *
        (mid(hits[0]!.band.minPct, hits[0]!.band.maxPct) +
          mid(hits[1]!.band.minPct, hits[1]!.band.maxPct));
    }
    const zeroHits = icyTempestHits(0);
    const zeroTempest =
      mid(zeroHits[0]!.band.minPct, zeroHits[0]!.band.maxPct) +
      mid(zeroHits[1]!.band.minPct, zeroHits[1]!.band.maxPct);
    expect(eTempest).toBeGreaterThan(zeroTempest);

    const attackOnly = simulate({
      ...lengCtxInput(),
      rotation: rotationOf("attack"),
    });
    expect(s.totalExpected).toBeGreaterThan(attackOnly.totalExpected + zeroTempest - 50);
  });

  it("multi-hit assault: stack EV under cap on compact mass spine", () => {
    const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
    const set = castOutcomes(
      { weight: 1, rt: createRuntime(lengCtxInput()) },
      assault,
      0,
      false,
    );
    expect(set.residualWeight).toBeLessThanOrEqual(1e-12);
    expect(set.branches).toHaveLength(1);
    const eStacks = expectedStacks(set.branches);
    expect(eStacks).toBeGreaterThan(0.12);
    expect(eStacks).toBeLessThanOrEqual(PRIMORDIAL_ICE_CAP);
    const mass = set.branches[0]!.rt.state.melee.primordialIce.stackMass;
    expect(mass.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 12);
  });

  it("at stack cap EF is no-op; chill opens frost via openMass", () => {
    const rt = createRuntime(lengCtxInput());
    const a = Array(11).fill(0);
    a[PRIMORDIAL_ICE_CAP] = 1;
    rt.state = patchMelee(rt.state, { primordialIce: { stackMass: a, expiresAtTick: 0 } });
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const set = castOutcomes({ weight: 1, rt }, attack, 0, false);
    expect(set.branches).toHaveLength(1);
    expect(
      set.branches[0]!.rt.state.melee.primordialIce.stackMass.reduce((s, w, i) => s + w * i, 0),
    ).toBe(PRIMORDIAL_ICE_CAP);
    expect(frostOpenMass(set.branches)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
  });

  it("one basic hit E[stacks] = 0.1 + 0.02 with both passives", () => {
    const effects = lengEffects();
    const rt = createRuntime({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
      equipmentEffects: effects,
      weaponConfiguration: "dualwield",
    });
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const set = castOutcomes({ weight: 1, rt }, attack, 0, false);
    expect(set.residualWeight).toBeLessThanOrEqual(1e-12);
    expect(set.branches).toHaveLength(1);
    expect(expectedStacks(set.branches)).toBeCloseTo(
      LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE,
      10,
    );
    expect(frostOpenMass(set.branches)).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
  });

  it("stack EV is independent of unrelated prior damage events (no event.seq hash)", () => {
    const effects = lengEffects();
    const mk = (priorBasics: number) => {
      const rt = createRuntime({
        ...baseInput,
        abilities: MELEE_ABILITIES,
        equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
        equipmentEffects: effects,
        weaponConfiguration: "dualwield",
      });
      let branches = [{ weight: 1, rt }];
      for (let i = 0; i < priorBasics; i++) {
        const next = [];
        for (const b of branches) {
          const set = castOutcomes(
            b,
            MELEE_ABILITIES.find((a) => a.id === "attack")!,
            b.rt.state.tick,
            false,
          );
          next.push(...set.branches);
        }
        branches = next;
      }
      return expectedStacks(branches) / priorBasics;
    };
    expect(mk(1)).toBeCloseTo(0.12, 8);
    expect(mk(3)).toBeCloseTo(0.12, 8);
    expect(mk(5)).toBeCloseTo(0.12, 8);
  });

  it("simulate with Leng keeps residual-free compact mass (no Leng runtime fork)", () => {
    const effects = lengEffects();
    const s = simulate({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
      equipmentEffects: effects,
      weaponConfiguration: "dualwield",
      rotation: rotationOf("attack", "attack"),
    });
    expect(s.ok).toBe(true);
    // Leng no longer multi-arms the runtime; residual stays zero.
    expect(s.rng?.residualWeight ?? 0).toBeLessThanOrEqual(1e-9);
  });
});
