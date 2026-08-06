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
import {
  patchConjures,
  patchMagic,
  patchMelee,
  patchNecro,
  patchRanged,
  patchTarget,
} from "../runtime/state";
import type { SimulationRuntime } from "../runtime/runtime";
import { newHaunted } from "../../styles/necromancy/haunted";
import { newInstability, newSunshine } from "../../styles/magic/effects";
import { newPuncture } from "../../styles/ranged/puncture";
import { newSearingWinds } from "../../styles/ranged/onHit";

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

  it("endTick twins merge; survivor keeps max endTick", () => {
    const a = createRuntime(meleeInput);
    const b = snapshotRuntime(a);
    a.endTick = 5;
    b.endTick = 40;
    a.totalExpected = 100;
    b.totalExpected = 300;
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    const merged = mergeBranches([
      { weight: 0.25, rt: a },
      { weight: 0.75, rt: b },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.rt.endTick).toBe(40);
    expect(merged[0]!.rt.totalExpected).toBe(250);
  });

  it("nextSeq / nextCastSeq twins merge; survivor keeps max allocators", () => {
    const a = createRuntime(meleeInput);
    const b = snapshotRuntime(a);
    a.nextSeq = 3;
    a.nextCastSeq = 1;
    b.nextSeq = 12;
    b.nextCastSeq = 7;
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    const merged = mergeBranches([
      { weight: 0.4, rt: a },
      { weight: 0.6, rt: b },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.rt.nextSeq).toBe(12);
    expect(merged[0]!.rt.nextCastSeq).toBe(7);
  });

  it("merge preserves future physics when only damage ledgers differ", () => {
    const a = createRuntime(meleeInput);
    a.state = { ...a.state, adrenaline: 42 };
    enqueueEvent(a, {
      tick: 9,
      seq: 1,
      family: "hit",
      abilityId: "assault",
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
        searingWindsAtCast: false,
        hauntedAtCast: false,
        hauntedCapAd: 0,
        enduringRuinBonus: 0,
      },
      resolve: noop,
    });
    a.nextSeq = 2;
    const b = snapshotRuntime(a);
    a.totalExpected = 10;
    a.totalMin = 5;
    a.totalMax = 15;
    a.perAbility.attack = 10;
    a.damageByTick[0] = 10;
    b.totalExpected = 90;
    b.totalMin = 80;
    b.totalMax = 100;
    b.perAbility.attack = 90;
    b.damageByTick[0] = 90;
    const sig = a.queue.signature();
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    const merged = mergeBranches([
      { weight: 0.5, rt: a },
      { weight: 0.5, rt: b },
    ]);
    expect(merged).toHaveLength(1);
    const rt = merged[0]!.rt;
    expect(rt.state.adrenaline).toBe(42);
    expect(rt.queue.signature()).toBe(sig);
    expect(rt.totalExpected).toBe(50);
  });

  it("Leng stack / frost window divergence splits keys", () => {
    const base = createRuntime(lengInput);
    // CoW share: diverge via replace-style patches, never in-place nested writes.
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    const c = snapshotRuntime(base);
    a.state = patchMelee(a.state, {
      primordialIce: { atoms: [{ weight: 1, stacks: 1, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 }] },
    });
    b.state = patchMelee(b.state, {
      primordialIce: { atoms: [{ weight: 1, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 }] },
    });
    c.state = patchMelee(c.state, {
      primordialIce: { atoms: [{ weight: 1, stacks: 1, stacksExpireAtTick: 100, frostbladesExpireAtTick: 20 }] },
    });
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(b));
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(c));
    expect(branchKeyStructural(b)).not.toBe(branchKeyStructural(c));
  });

  it("two different primordialIce mass distributions differ keys", () => {
    const base = createRuntime(lengInput);
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    // Same E[stacks]=1 but different atom shape.
    a.state = patchMelee(a.state, {
      primordialIce: {
        atoms: [{ weight: 1, stacks: 1, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 }],
      },
    });
    b.state = patchMelee(b.state, {
      primordialIce: {
        atoms: [
          { weight: 0.5, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 },
          { weight: 0.5, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 },
        ],
      },
    });
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(2);
  });

  it("same atom distribution merges", () => {
    const base = createRuntime(lengInput);
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    const atoms = [
      { weight: 0.88, stacks: 0, stacksExpireAtTick: 200, frostbladesExpireAtTick: 30 },
      { weight: 0.11, stacks: 1, stacksExpireAtTick: 200, frostbladesExpireAtTick: 30 },
      { weight: 0.01, stacks: 2, stacksExpireAtTick: 200, frostbladesExpireAtTick: 30 },
    ];
    a.state = patchMelee(a.state, {
      primordialIce: { atoms },
    });
    b.state = patchMelee(b.state, {
      primordialIce: { atoms: [...atoms].reverse() },
    });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(mergeBranches([{ weight: 0.4, rt: a }, { weight: 0.6, rt: b }])).toHaveLength(1);
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
          hauntedAtCast: false,
          hauntedCapAd: 0,
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
    lengA.state = patchMelee(lengA.state, { primordialIce: { atoms: [{ weight: 1, stacks: 3, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 }] } });
    fixtures.push(lengA);
    const lengB = snapshotRuntime(lengA);
    lengB.state = patchMelee(lengB.state, { primordialIce: { atoms: [{ weight: 1, stacks: 3, stacksExpireAtTick: 0, frostbladesExpireAtTick: 15 }] } });
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

    const structuralPart = partition(fixtures, branchKeyStructural);
    const jsonPart = partition(fixtures, branchKeyJson);
    expect(structuralPart).toEqual(jsonPart);

    // Golden groups (indices) under future-only key:
    // 0,1,11,12: plain twins + historical hitDetails (not live-derived) + nextSeq
    // 2,3,7,8: afterAttacks + damage twin + endTick + nextSeq
    // 4 / 5 / 6 / 9 / 10 / 13 / 14: distinct futures
    const groups = structuralPart.map((g) => g.join(","));
    expect(groups).toContain("0,1,11,12");
    expect(groups).toContain("2,3,7,8");
    expect(groups).toContain("4");
    expect(groups).toContain("5");
    expect(groups).toContain("6");
    expect(groups).toContain("9");
    expect(groups).toContain("10");
    expect(groups).toContain("13");
    expect(groups).toContain("14");
  });

  it("expired frost timestamps share key with frost=0", () => {
    const base = createRuntime(lengInput);
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 25 };
    a.state = patchMelee(a.state, {
      primordialIce: {
        atoms: [{ weight: 1, stacks: 2, stacksExpireAtTick: 0, frostbladesExpireAtTick: 10 }],
      },
    });
    b.state = { ...b.state, tick: 25 };
    b.state = patchMelee(b.state, {
      primordialIce: {
        atoms: [{ weight: 1, stacks: 2, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 }],
      },
    });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(1);
  });

  it("expired primordial ice mass shares key with empty ice (structural + JSON)", () => {
    const base = createRuntime(lengInput);
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 200 };
    a.state = patchMelee(a.state, {
      primordialIce: {
        atoms: [{ weight: 1, stacks: 5, stacksExpireAtTick: 100, frostbladesExpireAtTick: 0 }],
      },
    });
    b.state = { ...b.state, tick: 200 };
    b.state = patchMelee(b.state, {
      primordialIce: {
        atoms: [{ weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 }],
      },
    });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(1);
  });

  it("expired haunted with residual cap merges with newHaunted()", () => {
    const base = createRuntime(meleeInput);
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 25 };
    a.state = patchTarget(a.state, {
      haunted: { untilTick: 10, capAbilityDamage: 1000 },
    });
    b.state = { ...b.state, tick: 25 };
    b.state = patchTarget(b.state, { haunted: newHaunted() });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(1);
  });

  it("expired blastInfusedUntilTick merges with zero (mirror tsunami)", () => {
    const base = createRuntime(meleeInput);
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    a.state = { ...a.state, tick: 30 };
    a.state = patchMagic(a.state, { blastInfusedUntilTick: 10 });
    b.state = { ...b.state, tick: 30 };
    b.state = patchMagic(b.state, { blastInfusedUntilTick: 0 });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(1);

    // Live window still splits.
    const live = snapshotRuntime(base);
    live.state = { ...live.state, tick: 5 };
    live.state = patchMagic(live.state, { blastInfusedUntilTick: 20 });
    const zero = snapshotRuntime(base);
    zero.state = { ...zero.state, tick: 5 };
    zero.state = patchMagic(zero.state, { blastInfusedUntilTick: 0 });
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(zero));
  });

  it("expired ghost commanding true vs false share key when untilTick is past", () => {
    const base = createRuntime({
      ...meleeInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    });
    const a = snapshotRuntime(base);
    const b = snapshotRuntime(base);
    const expiredGhost = {
      id: "vengeful_ghost" as const,
      untilTick: 50,
      auto: { nextTick: 40 },
    };
    a.state = { ...a.state, tick: 100 };
    a.state = patchConjures(a.state, {
      spirits: [{ ...expiredGhost, commanding: true }],
    });
    b.state = { ...b.state, tick: 100 };
    b.state = patchConjures(b.state, {
      spirits: [{ ...expiredGhost, commanding: false }],
    });
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(1);
  });

  it("expired burn residue merges with missing burn; live until still splits", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 40 };
    expired.state = patchTarget(expired.state, {
      burns: { active: { combust: 30 } },
    });
    clean.state = { ...clean.state, tick: 40 };
    clean.state = patchTarget(clean.state, { burns: { active: {} } });
    live.state = { ...live.state, tick: 40 };
    live.state = patchTarget(live.state, {
      burns: { active: { combust: 50 } },
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired bleed residue merges with missing bleed; live until still splits", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 40 };
    expired.state = patchTarget(expired.state, {
      melee: {
        ...expired.state.target.melee,
        bleeds: { dismember: 25 },
      },
    });
    clean.state = { ...clean.state, tick: 40 };
    clean.state = patchTarget(clean.state, {
      melee: { ...clean.state.target.melee, bleeds: {} },
    });
    live.state = { ...live.state, tick: 40 };
    live.state = patchTarget(live.state, {
      melee: {
        ...live.state.target.melee,
        bleeds: { dismember: 55 },
      },
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired puncture residue merges via activePuncture; live window still splits", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 100 };
    expired.state = patchRanged(expired.state, {
      puncture: {
        stacks: 12,
        expiresAtTick: 40,
        storedDamage: 120,
        generation: 3,
        pendingOwnerCast: 7,
        lastCompletedCastSeq: 2,
      },
    });
    clean.state = { ...clean.state, tick: 100 };
    clean.state = patchRanged(clean.state, {
      puncture: {
        ...newPuncture(),
        generation: 3,
        lastCompletedCastSeq: 2,
      },
    });
    live.state = { ...live.state, tick: 100 };
    live.state = patchRanged(live.state, {
      puncture: {
        stacks: 12,
        expiresAtTick: 150,
        storedDamage: 120,
        generation: 3,
        pendingOwnerCast: 7,
        lastCompletedCastSeq: 2,
      },
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired berserk residue merges with endBerserk state; live window still splits", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    // stacks 6 under berserk cap; endBerserk clamps to BLOODLUST_CAP 4.
    expired.state = { ...expired.state, tick: 50 };
    expired.state = patchMelee(expired.state, {
      bloodlust: { stacks: 6, berserk: true },
      berserkUntilTick: 20,
    });
    clean.state = { ...clean.state, tick: 50 };
    clean.state = patchMelee(clean.state, {
      bloodlust: { stacks: 4, berserk: false },
      berserkUntilTick: 0,
    });
    live.state = { ...live.state, tick: 50 };
    live.state = patchMelee(live.state, {
      bloodlust: { stacks: 6, berserk: true },
      berserkUntilTick: 80,
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired melee half-open untils merge with zero; live windows still split", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 40 };
    expired.state = patchMelee(expired.state, {
      chaosRoarUntilTick: 12,
      greaterFuryUntilTick: 25,
      meteorStrikeUntilTick: 30,
      endlessAssaultUntilTick: 18,
    });
    clean.state = { ...clean.state, tick: 40 };
    clean.state = patchMelee(clean.state, {
      chaosRoarUntilTick: 0,
      greaterFuryUntilTick: 0,
      meteorStrikeUntilTick: 0,
      endlessAssaultUntilTick: 0,
    });
    live.state = { ...live.state, tick: 40 };
    live.state = patchMelee(live.state, {
      chaosRoarUntilTick: 50,
      greaterFuryUntilTick: 55,
      meteorStrikeUntilTick: 60,
      endlessAssaultUntilTick: 48,
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired NI/vestments/relentless untils merge with zero; live windows still split", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = {
      ...expired.state,
      tick: 50,
      naturalInstinctUntilTick: 20,
      vestmentsAdrenalineUntilTick: 30,
      relentlessUntilTick: 40,
    };
    clean.state = {
      ...clean.state,
      tick: 50,
      naturalInstinctUntilTick: 0,
      vestmentsAdrenalineUntilTick: 0,
      relentlessUntilTick: 0,
    };
    live.state = {
      ...live.state,
      tick: 50,
      naturalInstinctUntilTick: 80,
      vestmentsAdrenalineUntilTick: 70,
      relentlessUntilTick: 90,
    };
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired livingDeath and flow (zeros reduction) merge with clean; live still splits", () => {
    const base = createRuntime({
      ...meleeInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    });
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 60 };
    expired.state = patchNecro(expired.state, { livingDeathUntilTick: 40 });
    expired.state = patchMagic(expired.state, {
      flowUntilTick: 25,
      flowReduction: 15,
    });
    clean.state = { ...clean.state, tick: 60 };
    clean.state = patchNecro(clean.state, { livingDeathUntilTick: 0 });
    clean.state = patchMagic(clean.state, { flowUntilTick: 0, flowReduction: 0 });
    live.state = { ...live.state, tick: 60 };
    live.state = patchNecro(live.state, { livingDeathUntilTick: 90 });
    live.state = patchMagic(live.state, { flowUntilTick: 80, flowReduction: 15 });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired searing/sunshine/instability clear granted and merge with clean; live granted kept", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 100 };
    expired.state = patchRanged(expired.state, {
      searingWinds: { expiresAtTick: 40, grantedByCast: 3 },
    });
    expired.state = patchMagic(expired.state, {
      sunshine: { startsAtTick: 21, expiresAtTick: 71, grantedByCast: 5 },
      instability: { expiresAtTick: 50, grantedByCast: 7 },
    });
    clean.state = { ...clean.state, tick: 100 };
    clean.state = patchRanged(clean.state, { searingWinds: newSearingWinds() });
    clean.state = patchMagic(clean.state, {
      sunshine: newSunshine(),
      instability: newInstability(),
    });
    live.state = { ...live.state, tick: 30 };
    live.state = patchRanged(live.state, {
      searingWinds: { expiresAtTick: 50, grantedByCast: 3 },
    });
    live.state = patchMagic(live.state, {
      sunshine: { startsAtTick: 21, expiresAtTick: 71, grantedByCast: 5 },
      instability: { expiresAtTick: 80, grantedByCast: 7 },
    });
    // Different live granted must still split (do not drop while window open).
    const liveAlt = snapshotRuntime(live);
    liveAlt.state = patchRanged(liveAlt.state, {
      searingWinds: { expiresAtTick: 50, grantedByCast: 9 },
    });
    liveAlt.state = patchMagic(liveAlt.state, {
      sunshine: { startsAtTick: 21, expiresAtTick: 71, grantedByCast: 11 },
      instability: { expiresAtTick: 80, grantedByCast: 13 },
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(liveAlt));
    expect(branchKeyJson(live)).not.toBe(branchKeyJson(liveAlt));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired enduringRuin clears granted/bonus/vuln and merges with clean; live still splits", () => {
    const base = createRuntime(meleeInput);
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 80 };
    expired.state = patchMelee(expired.state, {
      enduringRuin: { nextAttackBonus: 0.1, untilTick: 40, grantedByCast: 4 },
    });
    expired.state = patchTarget(expired.state, {
      melee: {
        ...expired.state.target.melee,
        enduringRuin: { bleedVulnerability: 0.2, untilTick: 50 },
      },
    });
    clean.state = { ...clean.state, tick: 80 };
    clean.state = patchMelee(clean.state, {
      enduringRuin: { nextAttackBonus: 0, untilTick: 0, grantedByCast: -1 },
    });
    clean.state = patchTarget(clean.state, {
      melee: {
        ...clean.state.target.melee,
        enduringRuin: { bleedVulnerability: 0, untilTick: 0 },
      },
    });
    live.state = { ...live.state, tick: 30 };
    live.state = patchMelee(live.state, {
      enduringRuin: { nextAttackBonus: 0.1, untilTick: 50, grantedByCast: 4 },
    });
    live.state = patchTarget(live.state, {
      melee: {
        ...live.state.target.melee,
        enduringRuin: { bleedVulnerability: 0.2, untilTick: 60 },
      },
    });
    const liveAlt = snapshotRuntime(live);
    liveAlt.state = patchMelee(liveAlt.state, {
      enduringRuin: { nextAttackBonus: 0.16, untilTick: 50, grantedByCast: 9 },
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(liveAlt));
    expect(branchKeyJson(live)).not.toBe(branchKeyJson(liveAlt));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("expired spectral scythe windows merge with zero; live windows still split", () => {
    const base = createRuntime({
      ...meleeInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    });
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    expired.state = { ...expired.state, tick: 50 };
    expired.state = patchNecro(expired.state, {
      spectralScythe2UntilTick: 20,
      spectralScythe3UntilTick: 30,
    });
    clean.state = { ...clean.state, tick: 50 };
    clean.state = patchNecro(clean.state, {
      spectralScythe2UntilTick: 0,
      spectralScythe3UntilTick: 0,
    });
    live.state = { ...live.state, tick: 10 };
    live.state = patchNecro(live.state, {
      spectralScythe2UntilTick: 35,
      spectralScythe3UntilTick: 0,
    });
    const live3 = snapshotRuntime(base);
    live3.state = { ...live3.state, tick: 10 };
    live3.state = patchNecro(live3.state, {
      spectralScythe2UntilTick: 0,
      spectralScythe3UntilTick: 35,
    });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(live3));
    expect(branchKeyJson(live)).not.toBe(branchKeyJson(live3));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
  });

  it("fully expired spirits prune and merge with empty; live spirits still split", () => {
    const base = createRuntime({
      ...meleeInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
    });
    const expired = snapshotRuntime(base);
    const clean = snapshotRuntime(base);
    const live = snapshotRuntime(base);
    const deadSkel = {
      id: "skeleton_warrior" as const,
      untilTick: 40,
      auto: { nextTick: 38 },
      rageStacks: 12,
    };
    const deadGhost = {
      id: "vengeful_ghost" as const,
      untilTick: 45,
      auto: { nextTick: 42 },
      commanding: true,
    };
    expired.state = { ...expired.state, tick: 100 };
    expired.state = patchConjures(expired.state, {
      spirits: [deadSkel, deadGhost],
    });
    clean.state = { ...clean.state, tick: 100 };
    clean.state = patchConjures(clean.state, { spirits: [] });
    live.state = { ...live.state, tick: 20 };
    live.state = patchConjures(live.state, {
      spirits: [
        {
          id: "skeleton_warrior",
          untilTick: 120,
          auto: { nextTick: 25 },
          rageStacks: 3,
        },
      ],
    });
    // Poison tail past until still has future; must not prune.
    const poisonTail = snapshotRuntime(base);
    poisonTail.state = { ...poisonTail.state, tick: 50 };
    poisonTail.state = patchConjures(poisonTail.state, {
      spirits: [
        {
          id: "putrid_zombie",
          untilTick: 50,
          auto: { nextTick: 49 },
          poison: { nextTick: 52 },
        },
      ],
    });
    const poisonClean = snapshotRuntime(base);
    poisonClean.state = { ...poisonClean.state, tick: 50 };
    poisonClean.state = patchConjures(poisonClean.state, { spirits: [] });
    expect(branchKeyStructural(expired)).toBe(branchKeyStructural(clean));
    expect(branchKeyJson(expired)).toBe(branchKeyJson(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: expired }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(1);
    expect(branchKeyStructural(live)).not.toBe(branchKeyStructural(clean));
    expect(
      mergeBranches([{ weight: 0.5, rt: live }, { weight: 0.5, rt: clean }]),
    ).toHaveLength(2);
    expect(branchKeyStructural(poisonTail)).not.toBe(branchKeyStructural(poisonClean));
    expect(branchKeyJson(poisonTail)).not.toBe(branchKeyJson(poisonClean));
    expect(
      mergeBranches([
        { weight: 0.5, rt: poisonTail },
        { weight: 0.5, rt: poisonClean },
      ]),
    ).toHaveLength(2);
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

  it("equivalent pending graphs with different absolute seqs merge (structural + JSON)", () => {
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
    const mk = (parentSeq: number, childSeq: number, cast: number) => {
      const rt = createRuntime(meleeInput);
      rt.hitDetails.set(parentSeq, hit);
      enqueueEvent(rt, {
        tick: 5,
        seq: parentSeq,
        family: "hit",
        abilityId: "bloat",
        sourceCast: cast,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        provenance: { kind: "player_direct" },
        castSnap: {
          castSeq: cast,
          critLayers: { chance: 0 },
          baseMods: [],
          chaosRoarActive: false,
          channelled: false,
          greaterFuryActive: false,
          furyActive: false,
          firstEligibleHitIndex: 0,
          empowerMult: 1,
          searingWindsAtCast: false,
          hauntedAtCast: false,
          hauntedCapAd: 0,
          enduringRuinBonus: 0,
        },
        resolve: noop,
      });
      enqueueEvent(rt, {
        tick: 8,
        seq: childSeq,
        family: "dot",
        abilityId: "bloat",
        sourceCast: cast,
        hitIndex: 1,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
        derivedFrom: parentSeq,
        provenance: { kind: "derived_tail", detail: "bloat" },
        resolve: noop,
      });
      rt.nextSeq = childSeq + 1;
      rt.nextCastSeq = cast + 1;
      return rt;
    };
    const a = mk(2, 3, 1);
    const b = mk(20, 21, 7);
    expect(a.queue.signature()).toBe(b.queue.signature());
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    expect(mergeBranches([{ weight: 0.4, rt: a }, { weight: 0.6, rt: b }])).toHaveLength(1);
  });

  it("different derivedFrom relative graphs still split after seq rank normalize", () => {
    const hit = {
      potential: 50,
      min: 5,
      max: 10,
      critMin: 5,
      critMax: 10,
      critChance: 0,
      nonCritExpected: 7.5,
      critExpected: 7.5,
      expected: 7.5,
      uncappedExpected: 7.5,
      capLoss: 0,
    };
    const fromFirst = createRuntime(meleeInput);
    fromFirst.hitDetails.set(1, hit);
    fromFirst.hitDetails.set(2, { ...hit, expected: 9 });
    enqueueEvent(fromFirst, {
      tick: 1,
      seq: 1,
      family: "hit",
      abilityId: "h0",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      resolve: noop,
    });
    enqueueEvent(fromFirst, {
      tick: 1,
      seq: 2,
      family: "hit",
      abilityId: "h1",
      sourceCast: 0,
      hitIndex: 1,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      resolve: noop,
    });
    enqueueEvent(fromFirst, {
      tick: 4,
      seq: 3,
      family: "dot",
      abilityId: "tail",
      sourceCast: 0,
      hitIndex: 2,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: 1,
      provenance: { kind: "derived_tail", detail: "tail" },
      resolve: noop,
    });
    const fromSecond = snapshotRuntime(fromFirst);
    // Replace tail to derive from second parent instead of first.
    fromSecond.queue.shift();
    fromSecond.queue.shift();
    fromSecond.queue.shift();
    enqueueEvent(fromSecond, {
      tick: 1,
      seq: 1,
      family: "hit",
      abilityId: "h0",
      sourceCast: 0,
      hitIndex: 0,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      resolve: noop,
    });
    enqueueEvent(fromSecond, {
      tick: 1,
      seq: 2,
      family: "hit",
      abilityId: "h1",
      sourceCast: 0,
      hitIndex: 1,
      attached: false,
      procEligible: true,
      recursionAllowed: false,
      provenance: { kind: "player_direct" },
      resolve: noop,
    });
    enqueueEvent(fromSecond, {
      tick: 4,
      seq: 3,
      family: "dot",
      abilityId: "tail",
      sourceCast: 0,
      hitIndex: 2,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      derivedFrom: 2,
      provenance: { kind: "derived_tail", detail: "tail" },
      resolve: noop,
    });
    expect(fromFirst.queue.signature()).not.toBe(fromSecond.queue.signature());
    expect(branchKeyStructural(fromFirst)).not.toBe(branchKeyStructural(fromSecond));
    expect(branchKeyJson(fromFirst)).not.toBe(branchKeyJson(fromSecond));
    expect(
      mergeBranches([{ weight: 0.5, rt: fromFirst }, { weight: 0.5, rt: fromSecond }]),
    ).toHaveLength(2);
  });

  it("historical derivedFrom + hitDetails with different abs seqs merge when content matches", () => {
    const hit = {
      potential: 100,
      min: 10,
      max: 20,
      critMin: 15,
      critMax: 30,
      critChance: 0,
      nonCritExpected: 15,
      critExpected: 22.5,
      expected: 15,
      uncappedExpected: 15,
      capLoss: 0,
    };
    const mk = (histSeq: number, childSeq: number) => {
      const rt = createRuntime(meleeInput);
      rt.hitDetails.set(histSeq, hit);
      enqueueEvent(rt, {
        tick: 8,
        seq: childSeq,
        family: "dot",
        abilityId: "dismember",
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
        derivedFrom: histSeq,
        provenance: { kind: "derived_tail", detail: "dismember" },
        resolve: noop,
      });
      rt.nextSeq = childSeq + 1;
      return rt;
    };
    const a = mk(3, 10);
    const b = mk(30, 100);
    expect(branchKeyStructural(a)).toBe(branchKeyStructural(b));
    expect(branchKeyJson(a)).toBe(branchKeyJson(b));
    expect(mergeBranches([{ weight: 0.5, rt: a }, { weight: 0.5, rt: b }])).toHaveLength(1);

    const c = mk(3, 10);
    c.hitDetails.set(3, { ...hit, expected: 99 });
    expect(branchKeyStructural(a)).not.toBe(branchKeyStructural(c));
  });

  it("structural keys are much shorter than JSON on a post-cast runtime", () => {
    const rt = createRuntime(meleeInput);
    castN(rt, 4);
    const structural = branchKeyStructural(rt);
    const json = branchKeyJson(rt);
    expect(structural.length).toBeLessThan(json.length / 2);
  });
});
