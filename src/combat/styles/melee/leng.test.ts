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
import { lengLandOutcomes } from "./lengRng";
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

function lengRuntime(extra: { frostbladesUntilTick?: number; primordialIceStacks?: number } = {}) {
  const effects = lengEffects();
  const rt = createRuntime({
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects: effects,
    weaponConfiguration: "dualwield",
  });
  if (extra.frostbladesUntilTick != null || extra.primordialIceStacks != null) {
    rt.state = patchMelee(rt.state, {
      ...(extra.frostbladesUntilTick != null
        ? { frostbladesUntilTick: extra.frostbladesUntilTick }
        : {}),
      ...(extra.primordialIceStacks != null
        ? { primordialIceStacks: extra.primordialIceStacks }
        : {}),
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
    const rt = lengRuntime({ primordialIceStacks: 3 });
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    expect(performCast(rt, tempest, 0, false).ok).toBe(true);
    expect(rt.state.melee.primordialIceStacks).toBe(0);
    expect(rt.state.adrenaline).toBe(100); // free spend at 3 stacks
    const hits = rt.events.filter((e) => e.abilityId === "icy_tempest" && !e.attached);
    expect(hits).toHaveLength(2);
    // 3 stacks: primary 169-201% → mid 1850 on base 1000
    expect(hits[0]!.damage.expected).toBeCloseTo((1690 + 2010) / 2, 0);
  });

  it("Icy Tempest is locked without the Shard passive", () => {
    const tempest = MELEE_ABILITIES.find((a) => a.id === "icy_tempest")!;
    const ctx = createCastContext({
      ...baseInput,
      abilities: MELEE_ABILITIES,
      startingAdrenaline: 100,
    });
    expect(ctx.performCast(tempest, 0, false).ok).toBe(false);
  });

  it("manual rotation can cast Icy Tempest with the shard passive", () => {
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
  function expectedStacks(branches: { weight: number; rt: { state: { melee: { primordialIceStacks: number } } } }[]) {
    const mass = branches.reduce((s, b) => s + b.weight, 0);
    return branches.reduce((s, b) => s + b.weight * b.rt.state.melee.primordialIceStacks, 0) / mass;
  }

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
    const branches = castOutcomes({ weight: 1, rt }, attack, 0, false);
    expect(expectedStacks(branches)).toBeCloseTo(
      LENG_ENDLESS_FROST_CHANCE + LENG_BOUNDLESS_CHILL_CHANCE,
      10,
    );
    const chillMass = branches
      .filter((b) => b.rt.state.melee.frostbladesUntilTick > 0)
      .reduce((s, b) => s + b.weight, 0);
    expect(chillMass).toBeCloseTo(LENG_BOUNDLESS_CHILL_CHANCE, 10);
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
      // Burn seq by scheduling non-Leng damage via extra basics without Leng equipment first
      // is hard mid-runtime; instead pad with zero-weight-affecting cast seq by casting
      // without passives then swap... Simpler: cast N basics with Leng and compare E[stacks]/N.
      let branches = [{ weight: 1, rt }];
      for (let i = 0; i < priorBasics; i++) {
        const next = [];
        for (const b of branches) {
          next.push(
            ...castOutcomes(
              b,
              MELEE_ABILITIES.find((a) => a.id === "attack")!,
              b.rt.state.tick,
              false,
            ),
          );
        }
        branches = next;
      }
      return expectedStacks(branches) / priorBasics;
    };
    // Under cap, each hit adds EV 0.12 independent of how many seqs already ran.
    expect(mk(1)).toBeCloseTo(0.12, 8);
    expect(mk(3)).toBeCloseTo(0.12, 8);
    expect(mk(5)).toBeCloseTo(0.12, 8);
  });

  it("simulate with Leng reports probability-weighted branching", () => {
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
    expect(s.rng?.method).toBe("probability-weighted branching");
  });
});

