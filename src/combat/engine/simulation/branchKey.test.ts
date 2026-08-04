import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { activeEquipmentEffects } from "../../shared/equipment";
import { commitCast, prepareSimulationCast } from "../cast";
import { createRuntime, enqueueEvent } from "../runtime/runtime";
import { baseInput } from "../../test/fixtures/inputs";
import type { CastContextInput } from "./contracts";
import { branchKeyJson, branchKeyStructural } from "./branchKey";
import { mergeBranches, snapshotRuntime } from "./branch";
import { patchMelee } from "../runtime/state";
import type { SimulationRuntime } from "../runtime/runtime";

const meleeInput: CastContextInput = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
  context: { style: "melee" },
};

const lengInput: CastContextInput = {
  ...baseInput,
  abilities: MELEE_ABILITIES,
  equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
  equipmentEffects: activeEquipmentEffects({
    style: "melee",
    equipmentSlots: {
      mainhand: "item:dark-shard-of-leng",
      offhand: "item:dark-sliver-of-leng",
    },
  }),
  weaponConfiguration: "dualwield",
  context: { style: "melee" },
};

const noop = () => ({ damage: { min: 0, max: 0, expected: 0 } });

/** Canonical partition of indices by key; order-independent. */
function partition(rts: readonly SimulationRuntime[], keyFn: (rt: SimulationRuntime) => string): number[][] {
  const buckets = new Map<string, number[]>();
  rts.forEach((rt, i) => {
    const k = keyFn(rt);
    const list = buckets.get(k);
    if (list) list.push(i);
    else buckets.set(k, [i]);
  });
  return [...buckets.values()]
    .map((g) => [...g].sort((a, b) => a - b))
    .sort((a, b) => a[0]! - b[0]!);
}

function castN(rt: SimulationRuntime, n: number, id = "attack"): void {
  for (let i = 0; i < n; i++) {
    const ability = rt.byId.get(id)!;
    const attempt = prepareSimulationCast(rt, ability, rt.state.tick);
    if (attempt.ok) commitCast(rt, attempt.prepared, false);
  }
}

describe("branchKey structural vs JSON partitions", () => {
  it("identical futures share a structural key; damage history alone does not split", () => {
    const a = createRuntime(meleeInput);
    castN(a, 2);
    const b = snapshotRuntime(a);
    b.totalExpected = 99_999;
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(mergeBranches([{ weight: 0.4, rt: a }, { weight: 0.6, rt: b }])).toHaveLength(1);
  });

  it("Leng stack / frost window divergence splits keys", () => {
    const base = createRuntime(lengInput);
    // CoW share: diverge via replace-style patches, never in-place nested writes.
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    const c = snapshotRuntime(base);
    a.state = patchMelee(a.state, { primordialIceStacks: 1 });
    b.state = patchMelee(b.state, { primordialIceStacks: 2 });
    c.state = patchMelee(c.state, { primordialIceStacks: 1, frostbladesUntilTick: 20 });
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(b));
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(c));
    expect(branchKeyStructural(b)).not.toBe(branchKeyStructural(c));
  });

  it("queue ability id and castSnap.searingWindsAtCast split keys", () => {
    const mk = (abilityId: string, searing: boolean) => {
      const rt = createRuntime(meleeInput);
      enqueueEvent(rt, {
        tick: 5,
        seq: 1,
        family: "hit",
        abilityId,
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        provenance: { kind: "player_direct" },
        castSnap: {
          castSeq: 0,
          critLayers: { chance: 0 },
          baseMods: [],
          chaosRoarActive: false,
          channelled: false,
          greaterFuryActive: false,
          furyActive: false,
          firstEligibleHitIndex: 0,
          empowerMult: 1,
          searingWindsAtCast: searing,
          enduringRuinBonus: 0,
        },
        resolve: noop,
      });
      rt.nextSeq = 2;
      return rt;
    };
    expect(branchKeyStructural(mk("future-a", false))).not.toBe(
      branchKeyStructural(mk("future-b", false)),
    );
    expect(branchKeyStructural(mk("attack", true))).not.toBe(
      branchKeyStructural(mk("attack", false)),
    );
  });

  it("structural and JSON keys induce the same merge partition on mixed fixtures", () => {
    const fixtures: SimulationRuntime[] = [];

    const plain = createRuntime(meleeInput);
    fixtures.push(plain);
    fixtures.push(snapshotRuntime(plain));

    const afterAttacks = createRuntime(meleeInput);
    castN(afterAttacks, 3);
    fixtures.push(afterAttacks);
    const afterAttacksTwin = snapshotRuntime(afterAttacks);
    afterAttacksTwin.totalExpected = 1;
    fixtures.push(afterAttacksTwin);

    const adrenSplit = createRuntime(meleeInput);
    castN(adrenSplit, 1);
    adrenSplit.state = { ...adrenSplit.state, adrenaline: 12 };
    fixtures.push(adrenSplit);

    const lengA = createRuntime(lengInput);
    castN(lengA, 2);
    lengA.state = patchMelee(lengA.state, { primordialIceStacks: 3 });
    fixtures.push(lengA);
    const lengB = snapshotRuntime(lengA);
    lengB.state = patchMelee(lengB.state, { frostbladesUntilTick: 15 });
    fixtures.push(lengB);

    const endTick = snapshotRuntime(afterAttacks);
    endTick.endTick = 40;
    fixtures.push(endTick);

    const nextSeq = snapshotRuntime(afterAttacks);
    nextSeq.nextSeq = afterAttacks.nextSeq + 7;
    fixtures.push(nextSeq);

    const spirit = createRuntime({
      ...meleeInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    });
    spirit.spiritHitCounts.set("track-a", 1);
    fixtures.push(spirit);
    const spiritB = snapshotRuntime(spirit);
    spiritB.scheduledSpiritTracks.add("track-a");
    fixtures.push(spiritB);

    const withHit = createRuntime(meleeInput);
    withHit.hitDetails.set(0, {
      potential: 1000,
      min: 100,
      max: 200,
      critMin: 150,
      critMax: 300,
      critChance: 0.1,
      nonCritExpected: 150,
      critExpected: 225,
      expected: 157.5,
      uncappedExpected: 157.5,
      capLoss: 0,
    });
    withHit.nextSeq = 1;
    fixtures.push(withHit);
    const withHit2 = snapshotRuntime(withHit);
    withHit2.hitDetails.set(0, {
      ...withHit.hitDetails.get(0)!,
      expected: 200,
    });
    fixtures.push(withHit2);

    const derived = snapshotRuntime(withHit);
    enqueueEvent(derived, {
      tick: 8,
      seq: 1,
      family: "dot",
      abilityId: "dismember",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: 0,
      provenance: { kind: "derived_tail", detail: "dismember" },
      resolve: noop,
    });
    derived.nextSeq = 2;
    fixtures.push(derived);
    const derivedOther = snapshotRuntime(withHit);
    enqueueEvent(derivedOther, {
      tick: 8,
      seq: 1,
      family: "dot",
      abilityId: "dismember",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: 99,
      provenance: { kind: "derived_tail", detail: "dismember" },
      resolve: noop,
    });
    derivedOther.nextSeq = 2;
    fixtures.push(derivedOther);

    expect(partition(fixtures, branchKeyStructural)).toEqual(
      partition(fixtures, branchKeyJson),
    );
  });


  it("expired frost timestamps share key with frost=0", () => {
    const base = createRuntime(lengInput);
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 25 };
    a.state = patchMelee(a.state, { primordialIceStacks: 2, frostbladesUntilTick: 10 });
    b.state = { ...b.state, tick: 25 };
    b.state = patchMelee(b.state, { primordialIceStacks: 2, frostbladesUntilTick: 0 });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(1);
  });

  it("historical hitDetails without pending derived do not split keys", () => {
    const a = createRuntime(meleeInput);
    const b = snapshotRuntime(a);
    a.hitDetails.set(0, {
      potential: 1,
      min: 1,
      max: 2,
      critMin: 1,
      critMax: 2,
      critChance: 0,
      nonCritExpected: 1.5,
      critExpected: 1.5,
      expected: 1.5,
      uncappedExpected: 1.5,
      capLoss: 0,
    });
    b.hitDetails.set(0, {
      potential: 9,
      min: 9,
      max: 9,
      critMin: 9,
      critMax: 9,
      critChance: 0,
      nonCritExpected: 9,
      critExpected: 9,
      expected: 9,
      uncappedExpected: 9,
      capLoss: 0,
    });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(mergeBranches([{ weight: 0.2, rt: a }, { weight: 0.8, rt: b }])).toHaveLength(1);
  });

  it("live derivedFrom hitDetails still split keys", () => {
    const a = createRuntime(meleeInput);
    const hit = {
      potential: 100,
      min: 10,
      max: 20,
      critMin: 15,
      critMax: 30,
      critChance: 0.1,
      nonCritExpected: 15,
      critExpected: 22.5,
      expected: 15.75,
      uncappedExpected: 15.75,
      capLoss: 0,
    };
    a.hitDetails.set(0, hit);
    enqueueEvent(a, {
      tick: 5,
      seq: 1,
      family: "dot",
      abilityId: "dismember",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: 0,
      provenance: { kind: "derived_tail", detail: "dismember" },
      resolve: noop,
    });
    a.nextSeq = 2;
    const b = snapshotRuntime(a);
    b.hitDetails.set(0, { ...hit, expected: 99 });
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(b));
  });
  it("structural keys are much shorter than JSON on a post-cast runtime", () => {
    const rt = createRuntime(meleeInput);
    castN(rt, 4);
    const structural = branchKeyStructural(rt);
    const json = branchKeyJson(rt);
    expect(structural.length).toBeLessThan(json.length / 2);
  });
});
