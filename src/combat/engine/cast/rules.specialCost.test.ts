import { describe, expect, it } from "vitest";
import { createRuntime } from "../runtime/runtime";
import { patchMelee } from "../runtime/state";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { icyTempestSpend } from "../../styles/melee/effects";
import { activeEquipmentEffects } from "../../shared/equipment";
import {
  isWeaponSpecialAbility,
  resolveSpecialAttackAdrenalineCost,
} from "../../shared/ringOfVigour";
import { costOf, spendOf } from "./rules";
import { prepareCast } from "./prepare";
import type { AbilitySpec } from "../../pipeline/calculateAbility";

function unitIce(stacks: number) {
  const a = Array(11).fill(0);
  a[Math.max(0, Math.min(10, Math.floor(stacks)))] = 1;
  return { stackMass: a, expiresAtTick: 0 };
}

function runtime(opts: {
  ringOfVigour?: boolean;
  primordialIceStacks?: number;
  primordialIce?: { stackMass: number[]; expiresAtTick: number };
  startingAdrenaline?: number;
}) {
  const equipmentEffects = activeEquipmentEffects({
    style: "melee",
    equipmentSlots: {
      mainhand: "item:dark-shard-of-leng",
      offhand: "item:dark-sliver-of-leng",
    },
  });
  const rt = createRuntime({
    ...baseInput,
    abilities: [...MELEE_ABILITIES, ...MAGIC_ABILITIES, ...NECROMANCY_ABILITIES],
    startingAdrenaline: opts.startingAdrenaline ?? 100,
    adrenaline: opts.ringOfVigour ? { ringOfVigour: true } : undefined,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects,
    weaponConfiguration: "dualwield",
  });
  if (opts.primordialIce != null) {
    rt.state = patchMelee(rt.state, { primordialIce: opts.primordialIce });
  } else if (opts.primordialIceStacks != null) {
    rt.state = patchMelee(rt.state, { primordialIce: unitIce(opts.primordialIceStacks) });
  }
  // createRuntime seeds ringOfVigour from adrenaline rules.
  expect(rt.state.ringOfVigour).toBe(opts.ringOfVigour === true);
  return rt;
}

function byId(id: string): AbilitySpec {
  const found = [...MELEE_ABILITIES, ...MAGIC_ABILITIES, ...NECROMANCY_ABILITIES].find(
    (a) => a.id === id,
  );
  if (!found) throw new Error(`missing ability ${id}`);
  return found;
}

describe("special cost: requirement = spend under Vigour", () => {
  it.each([
    ["instability", 50, 45],
    ["claws_of_guthix", 25, 23],
    ["death_grasp", 25, 23],
    ["icy_tempest", 30, 27],
  ] as const)("%s listed %i -> effective %i for both costOf and spendOf", (id, listed, effective) => {
    const ability = byId(id);
    expect(isWeaponSpecialAbility(ability)).toBe(true);
    expect(ability.adrenaline?.cost).toBe(listed);

    const off = runtime({ ringOfVigour: false });
    expect(costOf(off.state, ability, 0)).toBe(listed);
    expect(spendOf(off.state, ability, 0)).toBe(listed);

    const on = runtime({ ringOfVigour: true });
    expect(costOf(on.state, ability, 0)).toBe(effective);
    expect(spendOf(on.state, ability, 0)).toBe(effective);
    expect(costOf(on.state, ability, 0)).toBe(spendOf(on.state, ability, 0));
    // Same pure discount both paths use.
    expect(resolveSpecialAttackAdrenalineCost(listed, true)).toBe(effective);
  });

  it("prepareCast cost and spend match for normal specials under Vigour", () => {
    const ability = byId("instability");
    const rt = runtime({ ringOfVigour: true });
    const prepared = prepareCast(rt, ability, 0);
    expect(prepared.cost).toBe(45);
    expect(prepared.spend).toBe(45);
  });

  it("non-special thresholds keep listed cost under Vigour", () => {
    const assault = byId("assault");
    expect(isWeaponSpecialAbility(assault)).toBe(false);
    const listed = assault.adrenaline?.cost ?? 0;
    expect(listed).toBeGreaterThan(0);

    const rt = runtime({ ringOfVigour: true });
    expect(costOf(rt.state, assault, 0)).toBe(listed);
    expect(spendOf(rt.state, assault, 0)).toBe(listed);
    expect(costOf(rt.state, assault, 0)).toBe(spendOf(rt.state, assault, 0));
  });

  it("ultimates keep full 100 requirement and spend under Vigour", () => {
    const berserk = byId("berserk");
    expect(berserk.category).toBe("ultimate");
    const rt = runtime({ ringOfVigour: true });
    expect(costOf(rt.state, berserk, 0)).toBe(100);
    expect(spendOf(rt.state, berserk, 0)).toBe(100);
  });
});

describe("Icy Tempest: stacks then Vigour; requirement unchanged by stacks", () => {
  const tempest = () => byId("icy_tempest");

  it("0 stacks: cost and spend both 27 under Vigour", () => {
    const rt = runtime({ ringOfVigour: true, primordialIce: { stackMass: (() => { const a = Array(11).fill(0); a[0] = 1; return a; })(), expiresAtTick: 0 } });
    expect(costOf(rt.state, tempest(), 0)).toBe(27);
    expect(spendOf(rt.state, tempest(), 0)).toBe(27);
  });

  it("1 stack: requirement 27, spend 17 (18 then floor-discount)", () => {
    // stack spend 30-12=18; Vigour 18-floor(1.8)=17
    const rt = runtime({ ringOfVigour: true, primordialIce: { stackMass: (() => { const a = Array(11).fill(0); a[1] = 1; return a; })(), expiresAtTick: 0 } });
    expect(icyTempestSpend(1)).toBe(18);
    expect(resolveSpecialAttackAdrenalineCost(18, true)).toBe(17);
    expect(costOf(rt.state, tempest(), 0)).toBe(27);
    expect(spendOf(rt.state, tempest(), 0)).toBe(17);
  });

  it("2 stacks: requirement 27, spend 6 (floor(6*0.1)=0 so no further cut)", () => {
    const rt = runtime({ ringOfVigour: true, primordialIce: { stackMass: (() => { const a = Array(11).fill(0); a[2] = 1; return a; })(), expiresAtTick: 0 } });
    expect(icyTempestSpend(2)).toBe(6);
    expect(resolveSpecialAttackAdrenalineCost(6, true)).toBe(6);
    expect(costOf(rt.state, tempest(), 0)).toBe(27);
    expect(spendOf(rt.state, tempest(), 0)).toBe(6);
  });

  it("3+ stacks: requirement still 27 under Vigour; spend 0", () => {
    const rt = runtime({ ringOfVigour: true, primordialIce: { stackMass: (() => { const a = Array(11).fill(0); a[3] = 1; return a; })(), expiresAtTick: 0 } });
    expect(icyTempestSpend(3)).toBe(0);
    expect(costOf(rt.state, tempest(), 0)).toBe(27);
    expect(spendOf(rt.state, tempest(), 0)).toBe(0);
  });

  it("without Vigour: requirement 30, spend stack-reduced only", () => {
    const rt = runtime({ ringOfVigour: false, primordialIce: { stackMass: (() => { const a = Array(11).fill(0); a[2] = 1; return a; })(), expiresAtTick: 0 } });
    expect(costOf(rt.state, tempest(), 0)).toBe(30);
    expect(spendOf(rt.state, tempest(), 0)).toBe(6);
  });

  it("prepareCast mirrors costOf/spendOf for stacked tempest", () => {
    const rt = runtime({ ringOfVigour: true, primordialIce: { stackMass: (() => { const a = Array(11).fill(0); a[1] = 1; return a; })(), expiresAtTick: 0 } });
    const prepared = prepareCast(rt, tempest(), 0);
    expect(prepared.cost).toBe(27);
    expect(prepared.spend).toBe(17);
  });
});
