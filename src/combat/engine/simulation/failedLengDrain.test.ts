/**
 * Failed terminal Leng drain: bank damage without inventing success or double-count.
 */
import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { expectedStacksFromAtoms } from "../../styles/melee/primordialIce";
import { prepareCast } from "../cast/prepare";
import { scheduleCastEvents } from "../cast/schedule";
import { createRuntime } from "../runtime/runtime";
import { baseInput } from "../../test/fixtures/inputs";
import { capBranches, snapshotRuntime, type Branch } from "./branchCore";
import { rotationOf } from "./contracts";
import { drainBranchToEnd, expandLengOnLand } from "./lengLandBranch";
import { simulate } from "./simulate";
import { isNearOne, PROB_TOLERANCE } from "./stats";
import { combineBranchSummaries, finish } from "./summary";

function lengEffects() {
  return activeEquipmentEffects({
    style: "melee",
    equipmentSlots: {
      mainhand: "item:dark-shard-of-leng",
      offhand: "item:dark-sliver-of-leng",
    },
  });
}

function lengBase() {
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects: lengEffects(),
    weaponConfiguration: "dualwield" as const,
  };
}

function pendingAttack(error?: string): Branch {
  const rt = createRuntime(lengBase());
  const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
  scheduleCastEvents(rt, prepareCast(rt, attack, 0), false);
  return { weight: 1, rt, ...(error !== undefined ? { error } : {}) };
}

describe("failed terminal Leng drain", () => {
  it("expandLengOnLand keeps failed error on single compact spine", () => {
    const b = pendingAttack("unpayable");
    const set = expandLengOnLand(b, 0);
    expect(set.branches).toHaveLength(1);
    expect(set.branches[0]!.error).toBe("unpayable");
    expect(set.branches[0]!.weight).toBeCloseTo(1, 10);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("exact");
    // Still applies stack mass even when the branch is failed.
    const eStacks = expectedStacksFromAtoms(set.branches[0]!.rt.state.melee.primordialIce.atoms);
    expect(eStacks).toBeCloseTo(0.12, 10);
  });

  it("drain+finish on failed pending matches finish-only (no double-count)", () => {
    const seed = pendingAttack("unpayable assault");
    expect(seed.rt.queue.length).toBeGreaterThan(0);
    expect(seed.rt.totalExpected).toBe(0);

    const set = drainBranchToEnd({
      weight: 0.95,
      rt: snapshotRuntime(seed.rt),
      error: "unpayable assault",
    });
    expect(set.branches.every((b) => b.error === "unpayable assault")).toBe(true);
    expect(set.branches.some((b) => b.error === undefined)).toBe(false);

    const mass = set.branches.reduce((s, b) => s + b.weight, 0);
    let finishSum = 0;
    for (const b of set.branches) {
      const fin = finish(b.rt, b.error);
      expect(fin.ok).toBe(false);
      finishSum += b.weight * fin.totalExpected;
    }
    const avgDrainFinish = finishSum / mass;

    const only = finish(snapshotRuntime(seed.rt), "unpayable assault");
    expect(only.ok).toBe(false);
    expect(avgDrainFinish).toBeCloseTo(only.totalExpected, 6);
  });

  it("combineBranchSummaries keeps ok false when failed mass remains", () => {
    const seed = pendingAttack();
    const s = combineBranchSummaries(
      [
        { weight: 0.05, rt: snapshotRuntime(seed.rt) },
        { weight: 0.95, rt: snapshotRuntime(seed.rt), error: "unpayable assault" },
      ],
      undefined,
      undefined,
      true,
    );
    expect(s.ok).toBe(false);
    expect(s.failure!.failedWeight).toBeCloseTo(0.95, 8);
    expect(s.failure!.successfulWeight).toBeCloseTo(0.05, 8);
    expect(s.failure!.failedWeight + s.failure!.successfulWeight).toBeCloseTo(
      s.rng!.probabilityMass,
      8,
    );
    expect(isNearOne(s.rng!.probabilityMass + s.rng!.residualWeight)).toBe(true);
  });

  it("capBranches retains a failed survivor when heaviest cut would drop all failed", () => {
    const mk = (weight: number, error?: string): Branch => ({
      weight,
      rt: createRuntime(lengBase()),
      ...(error !== undefined ? { error } : {}),
    });
    // Three heavy success arms + one light failed; max=3 would drop failed without guard.
    const capped = capBranches(
      [mk(0.4), mk(0.3), mk(0.2), mk(0.1, "no adren")],
      3,
    );
    expect(capped.branches.some((b) => b.error === "no adren")).toBe(true);
    expect(capped.branches.every((b) => b.error === undefined)).toBe(false);
    expect(capped.residualWeight).toBeCloseTo(0.2, 10);
    expect(
      capped.branches.reduce((s, b) => s + b.weight, 0) + capped.residualWeight,
    ).toBeCloseTo(1, 10);
  });

  it("Leng + Relentless: ok false; failed mass not reclassified as success", () => {
    const s = simulate({
      ...lengBase(),
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault", "assault"),
    });
    expect(s.ok).toBe(false);
    expect(s.failure).toBeDefined();
    expect(s.failure!.failedWeight).toBeGreaterThan(s.failure!.successfulWeight);
    expect(s.failure!.successfulWeight).toBeLessThan(0.5);
    expect(s.failure!.failedWeight + s.failure!.successfulWeight).toBeCloseTo(
      s.rng!.probabilityMass,
      8,
    );
    expect(isNearOne(s.rng!.probabilityMass + (s.rng!.residualWeight ?? 0))).toBe(true);
    // Residual is not folded into success.
    if ((s.rng!.residualWeight ?? 0) > PROB_TOLERANCE) {
      expect(s.rng!.exactness).toBe("approximated");
      expect(s.failure!.successfulWeight).toBeLessThan(0.05 + s.rng!.residualWeight);
    }
  });

  it("all-failed Leng pending stays failedWeight 1 after terminal drain", () => {
    const seed = pendingAttack("starved");
    const s = combineBranchSummaries(
      [{ weight: 1, rt: snapshotRuntime(seed.rt), error: "starved" }],
      undefined,
      undefined,
      false,
    );
    expect(s.ok).toBe(false);
    expect(s.failure!.failedWeight).toBeCloseTo(1, 10);
    expect(s.failure!.successfulWeight).toBe(0);
    expect(s.rng?.successfulClasses ?? 0).toBe(0);
  });
});
