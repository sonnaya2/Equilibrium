import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { createCastContext } from "../../engine/simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "./abilities";
import {
  FROSTBLADES_AD_FRACTION,
  icyTempestHits,
  icyTempestSpend,
  PRIMORDIAL_ICE_CAP,
} from "./effects";
import { createRuntime } from "../../engine/runtime/runtime";
import { performCast } from "../../engine/cast";
import { patchMelee } from "../../engine/runtime/state";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";

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
    // Assault hit bands are 130–150 without frostblades; min rises by flat.
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
    // 3 stacks: primary 169–201% → mid 1850 on base 1000
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
